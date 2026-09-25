"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Portal } from "@/components/Portal";
import { AppIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import {
  decryptFile, decryptText, deriveShared, encryptFile, encryptText, generateIdentity, keyFingerprint, messageAad,
  safetyNumber, signSdp, unwrapPrivate, verifySdp, wrapPrivate, type Shared,
} from "@/lib/e2ee/crypto";
import { clearIdentity, loadIdentity, readPinned, saveIdentity, writePinned, type LocalIdentity } from "@/lib/e2ee/store";

/**
 * off          neither of us has turned encryption on
 * needs-setup  the other person has, I have not
 * locked       I have a key on the server but this device does not hold it yet (needs the passphrase)
 * waiting      my key is ready, the other person's is not: messages stay readable by the server until they are
 * ready        both keys exist and this device holds mine: everything is end-to-end encrypted
 */
export type E2eePhase = "loading" | "unsupported" | "off" | "needs-setup" | "locked" | "waiting" | "ready";
type DialogMode = "setup" | "restore" | "reset" | "disable";
type KeyRow = { public_key: string; wrapped_private: string; kdf_salt: string; kdf_iterations: number };

type E2ee = {
  phase: E2eePhase;
  /** Both people have a key: the database refuses plaintext, so nothing can be sent without unlocking. */
  mustEncrypt: boolean;
  /** Encryption keys are usable on this device. */
  keys: boolean;
  /** Old messages can be opened (the shared key exists), even while a changed key waits for confirmation. */
  canDecrypt: boolean;
  /** encrypted: send as ciphertext; plain: encryption is not on yet; blocked: unlock / confirm first. */
  sendMode: "encrypted" | "plain" | "blocked";
  /** The other person's key differs from the one first seen and has not been confirmed. */
  partnerChanged: boolean;
  safety: string | null;
  confirmPartnerKey: () => void;
  /** Re-read the keys from the server (the other person may have just turned encryption on). */
  recheck: () => void;
  openDialog: (mode: DialogMode) => void;
  encryptMessage: (kind: string, text: string) => Promise<string>;
  decryptMessage: (authorId: string, kind: string, packed: string) => Promise<string>;
  encryptBlob: (blob: Blob) => Promise<{ cipher: Blob; key: string }>;
  decryptBlob: (cipher: ArrayBuffer, key: string, type: string) => Promise<Blob>;
  signCallSdp: (callId: string, role: "offer" | "answer", sdp: string) => Promise<string | undefined>;
  verifyCallSdp: (callId: string, role: "offer" | "answer", sdp: string, mac: string | undefined) => Promise<boolean>;
};

const noop = async () => { throw new Error("e2ee_unavailable"); };
const E2eeCtx = createContext<E2ee>({
  phase: "off", mustEncrypt: false, keys: false, canDecrypt: false, sendMode: "plain", partnerChanged: false, safety: null,
  confirmPartnerKey: () => {}, recheck: () => {}, openDialog: () => {},
  encryptMessage: noop, decryptMessage: noop, encryptBlob: noop, decryptBlob: noop,
  signCallSdp: async () => undefined, verifyCallSdp: async () => true,
});
export const useE2ee = () => useContext(E2eeCtx);

type Snapshot = { phase: E2eePhase; mine: KeyRow | null; partnerPub: string | null; shared: Shared | null; safety: string | null; changed: boolean };
const INITIAL: Snapshot = { phase: "loading", mine: null, partnerPub: null, shared: null, safety: null, changed: false };

export function E2eeProvider({ userId, coupleId, partnerId, children }: { userId: string; coupleId: string; partnerId: string | null; children: React.ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(INITIAL);
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const partnerFp = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!coupleId || !partnerId) { setSnap({ ...INITIAL, phase: "off" }); return; }
    if (typeof globalThis.crypto?.subtle === "undefined" || typeof indexedDB === "undefined") { setSnap({ ...INITIAL, phase: "unsupported" }); return; }
    const supabase = createClient();
    const [{ data: mine }, { data: partner }, local] = await Promise.all([
      supabase.from("e2ee_keys").select("public_key, wrapped_private, kdf_salt, kdf_iterations").maybeSingle(),
      supabase.rpc("partner_public_key"),
      loadIdentity(userId),
    ]);
    const partnerPub = (partner as { public_key: string }[] | null)?.[0]?.public_key ?? null;
    let identity: LocalIdentity | null = local;
    // Another device reset the key: the copy held here is stale.
    if (identity && (!mine || identity.publicKey !== mine.public_key)) { await clearIdentity(userId); identity = null; }

    let shared: Shared | null = null;
    let safety: string | null = null;
    let changed = false;
    if (partnerPub) {
      const fp = await keyFingerprint(partnerPub);
      partnerFp.current = fp;
      const pinned = readPinned(partnerId);
      if (!pinned) writePinned(partnerId, fp); else changed = pinned !== fp;
    }
    if (mine && identity && partnerPub) {
      shared = await deriveShared(identity.privateKey, partnerPub);
      safety = await safetyNumber(mine.public_key, partnerPub);
    }
    const phase: E2eePhase = !mine ? (partnerPub ? "needs-setup" : "off") : !identity ? "locked" : !partnerPub ? "waiting" : "ready";
    setSnap({ phase, mine: (mine as KeyRow | null) ?? null, partnerPub, shared, safety, changed });
  }, [coupleId, partnerId, userId]);

  useEffect(() => {
    const first = setTimeout(() => { void refresh(); }, 0);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    // The other person can turn encryption on at any moment and nothing pushes that to this device: look now and then.
    const poll = setInterval(onVisible, 45_000);
    return () => { clearTimeout(first); clearInterval(poll); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  const shared = snap.shared;
  const usable = !!shared && !snap.changed;

  const value = useMemo<E2ee>(() => ({
    phase: snap.phase,
    mustEncrypt: !!snap.mine && !!snap.partnerPub,
    keys: usable,
    canDecrypt: !!shared,
    sendMode: usable ? "encrypted" : snap.phase === "locked" || snap.phase === "needs-setup" || snap.changed ? "blocked" : "plain",
    partnerChanged: snap.changed,
    safety: snap.safety,
    confirmPartnerKey: () => { if (partnerId && partnerFp.current) { writePinned(partnerId, partnerFp.current); void refresh(); } },
    recheck: () => { void refresh(); },
    openDialog: setDialog,
    encryptMessage: async (kind, text) => {
      if (!shared || snap.changed) throw new Error("e2ee_locked");
      return encryptText(shared.msg, text, messageAad(coupleId, userId, kind));
    },
    decryptMessage: async (authorId, kind, packed) => {
      if (!shared) throw new Error("e2ee_locked");
      return decryptText(shared.msg, packed, messageAad(coupleId, authorId, kind));
    },
    encryptBlob: async (blob) => {
      const { cipher, key } = await encryptFile(await blob.arrayBuffer());
      return { cipher: new Blob([cipher], { type: "application/octet-stream" }), key };
    },
    decryptBlob: async (cipher, key, type) => new Blob([await decryptFile(cipher, key)], { type }),
    signCallSdp: async (callId, role, sdp) => (shared && !snap.changed ? signSdp(shared.mac, callId, role, sdp) : undefined),
    verifyCallSdp: async (callId, role, sdp, mac) => {
      // Only enforced when the database itself enforces encryption for this couple.
      if (!snap.mine || !snap.partnerPub) return true;
      if (!shared || !mac) return false;
      return verifySdp(shared.mac, callId, role, sdp, mac);
    },
  }), [snap, shared, usable, coupleId, userId, partnerId, refresh]);

  return (
    <E2eeCtx.Provider value={value}>
      {children}
      {dialog && <E2eeDialog mode={dialog} mine={snap.mine} userId={userId} coupleId={coupleId} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void refresh(); }} />}
    </E2eeCtx.Provider>
  );
}

/* ── setup / restore / reset / disable ─────────────────────────────────── */

const MIN_PASSPHRASE = 8;

function E2eeDialog({ mode, mine, userId, coupleId, onClose, onDone }: {
  mode: DialogMode; mine: KeyRow | null; userId: string; coupleId: string; onClose: () => void; onDone: () => void;
}) {
  const { t } = useI18n();
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creating = mode === "setup" || mode === "reset";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode !== "disable" && pass.length < MIN_PASSPHRASE) { setError(t("e2ee.tooShort", { n: MIN_PASSPHRASE })); return; }
    if (creating && pass !== again) { setError(t("e2ee.mismatch")); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "restore") {
        if (!mine) throw new Error("no_key");
        const privateKey = await unwrapPrivate(mine.wrapped_private, mine.kdf_salt, mine.kdf_iterations, pass);
        await saveIdentity(userId, { privateKey, publicKey: mine.public_key });
      } else if (mode === "disable") {
        const { error: del } = await supabase.from("e2ee_keys").delete().eq("user_id", userId);
        if (del) throw del;
        await clearIdentity(userId);
      } else {
        const id = await generateIdentity();
        const w = await wrapPrivate(id.pkcs8, pass);
        const { error: up } = await supabase.from("e2ee_keys").upsert(
          { user_id: userId, couple_id: coupleId, public_key: id.publicKey, wrapped_private: w.wrapped, kdf_salt: w.salt, kdf_iterations: w.iterations },
          { onConflict: "user_id" },
        );
        if (up) throw up;
        await saveIdentity(userId, { privateKey: id.privateKey, publicKey: id.publicKey });
      }
      onDone();
    } catch (err) {
      setError(t((err as Error).message === "wrong_passphrase" ? "e2ee.wrongPassphrase" : "errors.generic"));
      setBusy(false);
    }
  };

  return (
    <Portal>
      <div role="dialog" aria-modal="true" aria-labelledby="e2ee-h" className="fixed inset-0 z-[70] grid place-items-center p-5 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <form onSubmit={submit} className="card w-full max-w-sm p-6 grid gap-4 pop-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-3">
            <span className="grid place-items-center size-10 rounded-full bg-accent/15 text-accent shrink-0"><AppIcon name="lock" size={18} /></span>
            <div>
              <h2 id="e2ee-h" className="text-xl leading-tight">{t(`e2ee.${mode}Title`)}</h2>
              <p className="text-sm text-muted mt-1 text-balance">{t(`e2ee.${mode}Body`)}</p>
            </div>
          </div>
          {mode !== "disable" && (
            <>
              <input type="password" autoComplete="off" autoFocus className="field" placeholder={t("e2ee.passphrase")} aria-label={t("e2ee.passphrase")} value={pass} onChange={(e) => setPass(e.target.value)} />
              {creating && <input type="password" autoComplete="off" className="field" placeholder={t("e2ee.passphraseAgain")} aria-label={t("e2ee.passphraseAgain")} value={again} onChange={(e) => setAgain(e.target.value)} />}
            </>
          )}
          {creating && <p className="text-xs text-muted">{t("e2ee.forgetWarning")}</p>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" onClick={onClose}>{t("common.cancel")}</button>
            <button className={`btn ${mode === "disable" || mode === "reset" ? "btn-danger" : "btn-primary"}`} disabled={busy}>{busy ? t("common.loading") : t(`e2ee.${mode}Action`)}</button>
          </div>
        </form>
      </div>
    </Portal>
  );
}
