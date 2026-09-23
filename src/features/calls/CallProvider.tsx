"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getIceServersAction, myActiveCallAction, startCallAction, updateCallStatusAction } from "@/actions/calls";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { CallOverlay, type CallPerson, type CallPhase } from "@/features/calls/CallOverlay";
import { useRing } from "@/features/calls/use-ring";
import { playSfx, type Sfx } from "@/lib/sfx";

type Kind = "audio" | "video";
type Signal = { callId: string; from: string; type: "ringing" | "offer" | "answer" | "ice" | "hangup" | "reject" | "media"; sdp?: string; candidate?: RTCIceCandidateInit; muted?: boolean; cameraOff?: boolean; kind?: Kind };
type CallRow = { id: string; caller_id: string; callee_id: string; kind: Kind; status: string; started_at: string };

/** Everything one live call needs that shouldn't cause a re-render when it changes. */
type Live = {
  id: string; kind: Kind; role: "caller" | "callee";
  answered: boolean; acked: boolean; offerSdp: string | null; lastOffer: string | null;
  sentIce: RTCIceCandidateInit[]; remoteIce: RTCIceCandidateInit[];
  connectedAt: number | null; iceRestarts: number;
  timers: ReturnType<typeof setTimeout>[]; intervals: ReturnType<typeof setInterval>[];
};

const RING_TIMEOUT_MS = 45_000;
const STALE_RING_MS = 60_000;

const CallCtx = createContext<{ startCall: (kind: Kind) => void; inCall: boolean }>({ startCall: () => {}, inCall: false });
export const useCall = () => useContext(CallCtx);

const closedStatuses = ["cancelled", "missed", "rejected", "ended", "failed"];

export function CallProvider({ coupleId, myId, other, children }: { coupleId: string; myId: string; other: CallPerson | null; children: React.ReactNode }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<CallPhase | "idle">("idle");
  const [kind, setKind] = useState<Kind>("audio");
  const [ringing, setRinging] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [outputs, setOutputs] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(false);
  // The call and its screen are separate: the screen can shrink to a floating palette while the call carries on.
  const [minimized, setMinimized] = useState(false);
  const [remoteCameraOff, setRemoteCameraOff] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [facingUser, setFacingUser] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const live = useRef<Live | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const chan = useRef<RealtimeChannel | null>(null);
  const facing = useRef<"user" | "environment">("user");
  const outputIdx = useRef(0);
  const closedIds = useRef<Set<string>>(new Set());
  const ice = useRef<{ servers: RTCIceServer[]; at: number } | null>(null);
  const dismiss = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSignal = useRef<(s: Signal) => void>(() => {});
  const endRef = useRef<(reason?: "hangup" | "failed" | "missed") => void>(() => {});
  const otherName = other?.name ?? "";

  useRing(phase === "incoming" ? "incoming" : phase === "outgoing" && ringing ? "ringback" : null);

  const send = useCallback((type: Signal["type"], extra: Partial<Signal> = {}) => {
    const c = live.current;
    if (!c) return;
    void chan.current?.send({ type: "broadcast", event: "signal", payload: { callId: c.id, from: myId, type, kind: c.kind, ...extra } satisfies Signal });
  }, [myId]);

  const cleanup = useCallback((message: string | null, sfx?: Sfx) => {
    const c = live.current;
    if (c && sfx) playSfx(sfx);
    c?.timers.forEach(clearTimeout);
    c?.intervals.forEach(clearInterval);
    live.current = null;
    const p = pc.current;
    if (p) { p.onicecandidate = null; p.ontrack = null; p.onconnectionstatechange = null; p.close(); }
    pc.current = null;
    local.current?.getTracks().forEach((tr) => tr.stop());
    local.current = null;
    facing.current = "user";
    outputIdx.current = 0;
    if (c) closedIds.current.add(c.id);
    setLocalStream(null); setRemoteStream(null);
    setRinging(false); setReconnecting(false); setMuted(false); setCameraOff(false); setElapsed(0); setOutputs(0); setSpeakerOn(false);
    setRemoteCameraOff(false); setRemoteMuted(false); setFacingUser(true);
    if (dismiss.current) clearTimeout(dismiss.current);
    if (message) {
      setNotice(message); setPhase("ended");
      dismiss.current = setTimeout(() => { setPhase("idle"); setNotice(null); setMinimized(false); }, 3200);
    } else { setNotice(null); setPhase("idle"); setMinimized(false); }
  }, []);

  const getMedia = useCallback((k: Kind, face: "user" | "environment" = "user") =>
    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: k === "video" ? { facingMode: face, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    }), []);

  /** TURN credentials last hours: fetched once ahead of time instead of on the critical path of every call. */
  const getIce = useCallback(async () => {
    const cached = ice.current;
    if (cached && Date.now() - cached.at < 2 * 3600_000) return cached.servers;
    const r = await getIceServersAction();
    if (!r.ok) return [{ urls: "stun:stun.l.google.com:19302" }] as RTCIceServer[];
    ice.current = { servers: r.data as RTCIceServer[], at: Date.now() };
    return ice.current.servers;
  }, []);

  /** Builds the peer connection with STUN + short-lived TURN credentials minted server-side. */
  const buildPeer = useCallback(async (stream: MediaStream) => {
    const iceServers = await getIce();
    // A small candidate pool is gathered up front, so the media path is ready sooner once the call is answered.
    const p = new RTCPeerConnection({ iceServers, bundlePolicy: "max-bundle", iceCandidatePoolSize: 2 });
    const fallback = new MediaStream();
    stream.getTracks().forEach((tr) => p.addTrack(tr, stream));
    // The browser hands over the remote party's own stream (audio + video together); building one by hand
    // is the fallback and was the fragile part on Safari, where a track added afterwards may never render.
    p.ontrack = (e) => {
      const incoming = e.streams[0];
      if (incoming) { setRemoteStream(incoming); return; }
      if (!fallback.getTracks().includes(e.track)) fallback.addTrack(e.track);
      setRemoteStream(fallback);
    };
    p.onicecandidate = (e) => {
      if (!e.candidate || !live.current) return;
      const cand = e.candidate.toJSON();
      live.current.sentIce.push(cand);
      send("ice", { candidate: cand });
    };
    p.onconnectionstatechange = () => {
      const c = live.current;
      if (!c) return;
      if (p.connectionState === "connected") {
        setReconnecting(false);
        if (!c.connectedAt) {
          playSfx("connect");
          c.connectedAt = Date.now();
          c.timers.forEach(clearTimeout); c.timers = [];
          c.intervals.forEach(clearInterval);
          c.intervals = [setInterval(() => setElapsed(Math.floor((Date.now() - (live.current?.connectedAt ?? Date.now())) / 1000)), 1000)];
          navigator.mediaDevices.enumerateDevices().then((d) => setOutputs(d.filter((x) => x.kind === "audiooutput").length)).catch(() => {});
        }
        setPhase("connected");
        const audio = local.current?.getAudioTracks()[0];
        const video = local.current?.getVideoTracks()[0];
        send("media", { muted: audio ? !audio.enabled : false, cameraOff: video ? !video.enabled : false });
      } else if (p.connectionState === "disconnected" || p.connectionState === "failed") {
        setReconnecting(true);
        // The caller drives ICE restarts (new network, Wi-Fi ↔ 4G); if nothing recovers in time, the call ends honestly.
        if (c.role === "caller" && c.iceRestarts < 3) {
          c.iceRestarts += 1;
          void p.createOffer({ iceRestart: true }).then(async (offer) => {
            await p.setLocalDescription(offer);
            send("offer", { sdp: offer.sdp });
          }).catch(() => {});
        }
        const id = c.id;
        c.timers.push(setTimeout(() => {
          if (live.current?.id === id && pc.current && pc.current.connectionState !== "connected") endRef.current("failed");
        }, 20_000));
      }
    };
    pc.current = p;
    return p;
  }, [getIce, send]);

  const flushRemoteIce = useCallback(async (p: RTCPeerConnection) => {
    const c = live.current;
    if (!c) return;
    const queued = c.remoteIce.splice(0);
    for (const cand of queued) await p.addIceCandidate(cand).catch(() => {});
  }, []);

  /** Ends the call from either side, recording how it ended in the call history. */
  const endCall = useCallback((reason: "hangup" | "failed" | "missed" = "hangup") => {
    const c = live.current;
    if (!c) return;
    const status = reason === "failed" ? "failed" : reason === "missed" ? "missed" : c.role === "caller" && !c.answered ? "cancelled" : "ended";
    send("hangup");
    void updateCallStatusAction({ id: c.id, status });
    cleanup(reason === "failed" ? t("call.failed") : reason === "missed" ? t(c.acked ? "call.noAnswer" : "call.unreachable", { name: otherName }) : null, reason === "hangup" ? "hangup" : "dropped");
  }, [cleanup, otherName, send, t]);

  useEffect(() => { endRef.current = endCall; }, [endCall]);
  useEffect(() => { if (other) void getIce(); }, [other, getIce]);

  // Coming back from the background: if the system ended the microphone capture, take it up again on the same call.
  useEffect(() => {
    if (phase !== "connected") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const old = local.current?.getAudioTracks()[0];
      if (!old || old.readyState !== "ended") return;
      const sender = pc.current?.getSenders().find((s) => s.track === old);
      if (!sender) return;
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(async (fresh) => {
        const track = fresh.getAudioTracks()[0];
        track.enabled = old.enabled;
        await sender.replaceTrack(track);
        local.current?.removeTrack(old);
        local.current?.addTrack(track);
      }).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase]);

  // A screen that dims or locks mid-call suspends the page and cuts the audio: keep it awake while connected.
  useEffect(() => {
    if (phase !== "connected" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = () => navigator.wakeLock.request("screen").then((l) => { if (stopped) void l.release(); else lock = l; }).catch(() => {});
    void acquire();
    const onVisible = () => { if (document.visibilityState === "visible") void acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; document.removeEventListener("visibilitychange", onVisible); void lock?.release().catch(() => {}); };
  }, [phase]);

  const startCall = useCallback(async (k: Kind) => {
    if (live.current || (phase !== "idle" && phase !== "ended")) return;
    if (dismiss.current) clearTimeout(dismiss.current);
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") { cleanup(t("call.unsupported")); return; }
    setKind(k); setPhase("outgoing"); setNotice(null); setMinimized(false);
    let stream: MediaStream;
    try { stream = await getMedia(k); } catch { cleanup(t("call.permission")); return; }
    const created = await startCallAction({ kind: k });
    if (!created.ok) { stream.getTracks().forEach((tr) => tr.stop()); cleanup(t(`errors.${created.error}`)); return; }
    const id = (created.data as { id: string }).id;
    live.current = { id, kind: k, role: "caller", answered: false, acked: false, offerSdp: null, lastOffer: null, sentIce: [], remoteIce: [], connectedAt: null, iceRestarts: 0, timers: [], intervals: [] };
    local.current = stream;
    setLocalStream(stream);
    try {
      const p = await buildPeer(stream);
      const offer = await p.createOffer();
      await p.setLocalDescription(offer);
      const c = live.current;
      if (!c) return;
      c.offerSdp = offer.sdp ?? null;
      send("offer", { sdp: offer.sdp });
      // The other phone may only be waking up: keep offering until it answers, then give up honestly.
      c.intervals.push(setInterval(() => {
        const cur = live.current;
        if (cur && !cur.answered && cur.offerSdp) { send("offer", { sdp: cur.offerSdp }); cur.sentIce.forEach((cand) => send("ice", { candidate: cand })); }
      }, 3000));
      c.timers.push(setTimeout(() => { if (live.current && !live.current.answered) endCall("missed"); }, RING_TIMEOUT_MS));
    } catch {
      void updateCallStatusAction({ id, status: "failed" });
      cleanup(t("call.failed"), "dropped");
    }
  }, [buildPeer, cleanup, endCall, getMedia, phase, send, t]);

  const accept = useCallback(async () => {
    const c = live.current;
    if (!c || c.role !== "callee" || phase !== "incoming") return;
    setPhase("connecting");
    let stream: MediaStream;
    try { stream = await getMedia(c.kind); } catch {
      send("reject"); void updateCallStatusAction({ id: c.id, status: "rejected" });
      cleanup(t("call.permission")); return;
    }
    local.current = stream;
    setLocalStream(stream);
    void updateCallStatusAction({ id: c.id, status: "accepted" });
    try {
      const p = await buildPeer(stream);
      for (let i = 0; i < 100 && live.current?.id === c.id && !live.current.offerSdp; i++) await new Promise((r) => setTimeout(r, 100));
      const sdp = live.current?.id === c.id ? live.current.offerSdp : null;
      if (!sdp) throw new Error("no offer");
      live.current!.lastOffer = sdp;
      live.current!.answered = true;
      await p.setRemoteDescription({ type: "offer", sdp });
      await flushRemoteIce(p);
      const answer = await p.createAnswer();
      await p.setLocalDescription(answer);
      send("answer", { sdp: answer.sdp });
      live.current!.timers.push(setTimeout(() => {
        if (live.current?.id === c.id && !live.current.connectedAt) endCall("failed");
      }, 30_000));
    } catch {
      send("hangup"); void updateCallStatusAction({ id: c.id, status: "failed" });
      cleanup(t("call.failed"));
    }
  }, [buildPeer, cleanup, endCall, flushRemoteIce, getMedia, phase, send, t]);

  const decline = useCallback(() => {
    const c = live.current;
    if (!c) return;
    send("reject");
    void updateCallStatusAction({ id: c.id, status: "rejected" });
    cleanup(null, "hangup");
  }, [cleanup, send]);

  const showIncoming = useCallback((row: CallRow) => {
    if (live.current || row.callee_id !== myId || row.status !== "ringing" || closedIds.current.has(row.id)) return;
    if (dismiss.current) clearTimeout(dismiss.current);
    live.current = { id: row.id, kind: row.kind, role: "callee", answered: false, acked: false, offerSdp: null, lastOffer: null, sentIce: [], remoteIce: [], connectedAt: null, iceRestarts: 0, timers: [], intervals: [] };
    setKind(row.kind); setNotice(null); setPhase("incoming"); setMinimized(false);
    send("ringing");
    live.current.timers.push(setTimeout(() => { if (live.current?.id === row.id && !live.current.answered) cleanup(t("call.missed", { name: otherName }), "dropped"); }, STALE_RING_MS));
  }, [cleanup, myId, otherName, send, t]);

  useEffect(() => {
    onSignal.current = (m: Signal) => {
      if (m.from === myId) return;
      // The first offer over the broadcast channel rings the phone at once; the database row only backs it up.
      if (!live.current && m.type === "offer" && m.kind && m.sdp && !closedIds.current.has(m.callId)) {
        showIncoming({ id: m.callId, caller_id: m.from, callee_id: myId, kind: m.kind, status: "ringing", started_at: new Date().toISOString() });
        if (live.current) (live.current as Live).offerSdp = m.sdp;
        return;
      }
      const c = live.current;
      if (!c || m.callId !== c.id) return;
      const p = pc.current;
      switch (m.type) {
        case "ringing":
          if (c.role === "caller" && !c.answered) {
            c.acked = true;
            setRinging(true);
            if (c.offerSdp) { send("offer", { sdp: c.offerSdp }); c.sentIce.forEach((cand) => send("ice", { candidate: cand })); }
          }
          break;
        case "offer":
          if (c.role !== "callee" || !m.sdp || m.sdp === c.lastOffer) break;
          if (!c.answered) { c.offerSdp = m.sdp; break; }
          // A later offer on a live call is the caller restarting ICE after a network change.
          if (p) {
            c.lastOffer = m.sdp;
            void p.setRemoteDescription({ type: "offer", sdp: m.sdp }).then(async () => {
              await flushRemoteIce(p);
              const ans = await p.createAnswer();
              await p.setLocalDescription(ans);
              send("answer", { sdp: ans.sdp });
            }).catch(() => {});
          }
          break;
        case "answer":
          if (c.role !== "caller" || !p || !m.sdp) break;
          if (c.answered && p.signalingState === "stable") break;
          c.answered = true;
          setRinging(false);
          setPhase((cur) => (cur === "outgoing" ? "connecting" : cur));
          void p.setRemoteDescription({ type: "answer", sdp: m.sdp }).then(() => flushRemoteIce(p)).catch(() => {});
          break;
        case "ice":
          if (!m.candidate) break;
          if (p && p.remoteDescription) void p.addIceCandidate(m.candidate).catch(() => {});
          else c.remoteIce.push(m.candidate);
          break;
        case "media":
          if (m.muted !== undefined) setRemoteMuted(m.muted);
          if (m.cameraOff !== undefined) setRemoteCameraOff(m.cameraOff);
          break;
        case "reject":
          if (c.role === "caller") cleanup(t("call.declined", { name: otherName }), "hangup");
          break;
        case "hangup":
          cleanup(c.role === "callee" && !c.answered ? t("call.missed", { name: otherName }) : t("call.ended"), c.answered || c.role === "caller" ? "hangup" : "dropped");
          break;
      }
    };
  });

  // One private channel per couple carries the signaling; the calls table is the durable record.
  useEffect(() => {
    if (!other) return;
    const supabase = createClient();
    const ch = supabase.channel(`call:${coupleId}`, { config: { private: true } });
    ch.on("broadcast", { event: "signal" }, (msg) => onSignal.current(msg.payload as Signal))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `couple_id=eq.${coupleId}` }, (p) => showIncoming(p.new as CallRow))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `couple_id=eq.${coupleId}` }, (p) => {
        const row = p.new as CallRow;
        const c = live.current;
        if (!c || c.id !== row.id || !closedStatuses.includes(row.status)) return;
        if (c.role === "callee" && !c.answered) cleanup(t("call.missed", { name: otherName }), "dropped");
        else if (c.role === "caller" && row.status === "rejected") cleanup(t("call.declined", { name: otherName }), "hangup");
        else if (row.status === "ended" || row.status === "failed") cleanup(t("call.ended"), "hangup");
      })
      .subscribe();
    chan.current = ch;

    // A call that started while this device was closed or asleep (the push woke it): pick it up now.
    const catchUp = async () => {
      const r = await myActiveCallAction();
      const row = r.ok ? (r.data as CallRow | null) : null;
      if (!row || row.status !== "ringing" || row.callee_id !== myId) return;
      if (Date.now() - new Date(row.started_at).getTime() > STALE_RING_MS) { void updateCallStatusAction({ id: row.id, status: "missed" }); return; }
      showIncoming(row);
    };
    void catchUp();
    const onVisible = () => { if (document.visibilityState === "visible") void catchUp(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
      chan.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, myId, other?.id]);

  const toggleMute = () => {
    const tr = local.current?.getAudioTracks()[0];
    if (!tr) return;
    tr.enabled = !tr.enabled;
    setMuted(!tr.enabled);
    send("media", { muted: !tr.enabled });
  };
  const toggleCamera = () => {
    const tr = local.current?.getVideoTracks()[0];
    if (!tr) return;
    tr.enabled = !tr.enabled;
    setCameraOff(!tr.enabled);
    send("media", { cameraOff: !tr.enabled });
  };
  const flipCamera = async () => {
    const stream = local.current;
    const sender = pc.current?.getSenders().find((s) => s.track?.kind === "video");
    if (!stream || !sender) return;
    const next = facing.current === "user" ? "environment" : "user";
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next } });
      const track = fresh.getVideoTracks()[0];
      track.enabled = !cameraOff;
      await sender.replaceTrack(track);
      stream.getVideoTracks().forEach((old) => { stream.removeTrack(old); old.stop(); });
      stream.addTrack(track);
      facing.current = next;
      setFacingUser(next === "user");
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch { /* keep the current camera */ }
  };
  const cycleOutput = async () => {
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audiooutput");
      if (devices.length < 2) return;
      const next = (outputIdx.current + 1) % devices.length;
      const el = document.querySelector<HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }>('video[data-stream="audible"]');
      if (!el?.setSinkId) return;
      await el.setSinkId(devices[next].deviceId);
      outputIdx.current = next;
      setSpeakerOn(next !== 0);
    } catch { /* unsupported on this browser */ }
  };

  const value = useMemo(() => ({ startCall: (k: Kind) => void startCall(k), inCall: phase !== "idle" }), [startCall, phase]);

  return (
    <CallCtx.Provider value={value}>
      {children}
      {other && phase !== "idle" && (
        <CallOverlay
          phase={phase} kind={kind} other={other} ringing={ringing} reconnecting={reconnecting} elapsed={elapsed} notice={notice}
          muted={muted} cameraOff={cameraOff} minimized={minimized} onMinimize={() => setMinimized(true)} onExpand={() => setMinimized(false)} speakerOn={speakerOn} canSwitchOutput={outputs > 1 && typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype}
          localStream={localStream} remoteStream={remoteStream} remoteCameraOff={remoteCameraOff} remoteMuted={remoteMuted} facingUser={facingUser}
          onAccept={() => void accept()} onDecline={decline} onHangup={() => endCall("hangup")}
          onToggleMute={toggleMute} onToggleCamera={toggleCamera} onFlipCamera={() => void flipCamera()} onCycleOutput={() => void cycleOutput()}
        />
      )}
    </CallCtx.Provider>
  );
}
