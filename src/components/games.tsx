"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import type { GameId } from "@/lib/games";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ── Falling petals: catch them softly. No score, no clock. ── */
function Petals() {
  const t = useT();
  const [items, setItems] = useState<{ id: number; x: number; s: number; d: number; c: string }[]>([]);
  const [caught, setCaught] = useState(0);
  const id = useRef(0);
  useEffect(() => {
    const iv = setInterval(() => {
      setItems((cur) => [...cur.slice(-18), { id: id.current++, x: rand(4, 92), s: rand(26, 44), d: rand(7, 12), c: ["🌸", "🌷", "🌺", "🪷"][Math.floor(rand(0, 4))] }]);
    }, 1100);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="relative h-[60dvh] overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-surface2 to-transparent touch-manipulation select-none">
      {items.map((p) => (
        <button key={p.id} aria-label={t("games.petal")} onClick={() => { setItems((c) => c.filter((x) => x.id !== p.id)); setCaught((n) => n + 1); }}
          className="absolute top-0" style={{ left: `${p.x}%`, fontSize: p.s, animation: `drift ${p.d}s linear forwards` }}>{p.c}</button>
      ))}
      <p className="absolute bottom-3 inset-x-0 text-center text-sm text-muted">{t("games.petalsCount", { n: caught })}</p>
    </div>
  );
}

/* ── Bubbles ── */
function Bubbles() {
  const t = useT();
  const [items, setItems] = useState<{ id: number; x: number; s: number; d: number }[]>([]);
  const [popped, setPopped] = useState<{ id: number; x: number; y: number }[]>([]);
  const id = useRef(0);
  useEffect(() => {
    const iv = setInterval(() => setItems((cur) => [...cur.slice(-14), { id: id.current++, x: rand(5, 88), s: rand(38, 84), d: rand(8, 14) }]), 900);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="relative h-[60dvh] overflow-hidden rounded-3xl border border-line bg-gradient-to-t from-surface2 to-transparent select-none">
      {items.map((b) => (
        <button key={b.id} aria-label={t("games.bubble")}
          onClick={(e) => {
            const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
            const bb = e.currentTarget.getBoundingClientRect();
            setPopped((p) => [...p, { id: b.id, x: bb.left - r.left + b.s / 2, y: bb.top - r.top + b.s / 2 }]);
            setTimeout(() => setPopped((p) => p.filter((x) => x.id !== b.id)), 600);
            setItems((c) => c.filter((x) => x.id !== b.id));
          }}
          className="absolute bottom-0 rounded-full border border-white/40"
          style={{ left: `${b.x}%`, width: b.s, height: b.s, background: "radial-gradient(circle at 30% 28%, rgb(255 255 255 / .55), rgb(184 110 125 / .18) 60%, transparent 72%)", animation: `bubble-up ${b.d}s ease-in forwards` }} />
      ))}
      {popped.map((p) => (
        <span key={p.id} className="absolute size-10 -ml-5 -mt-5 rounded-full border-2 border-white/60 pointer-events-none" style={{ left: p.x, top: p.y, animation: "pop 0.6s ease-out forwards" }} />
      ))}
      <style>{`@keyframes bubble-up{from{transform:translateY(0) translateX(0)}50%{transform:translateY(-32dvh) translateX(14px)}to{transform:translateY(-70dvh) translateX(-8px)}}@keyframes pop{from{transform:scale(.4);opacity:.9}to{transform:scale(1.8);opacity:0}}`}</style>
    </div>
  );
}

/* ── Memory cards: no timer, no move counter ── */
function Memory() {
  const t = useT();
  const faces = ["🌙", "🌷", "🕊️", "🍓", "⭐", "🫖"];
  const make = useCallback(() => [...faces, ...faces].map((f, i) => ({ i, f })).sort(() => Math.random() - 0.5), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [deck, setDeck] = useState(make);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const flip = (idx: number) => {
    if (open.length === 2 || open.includes(idx) || found.includes(deck[idx].f)) return;
    const next = [...open, idx];
    setOpen(next);
    if (next.length === 2) {
      const [a, b] = next;
      if (deck[a].f === deck[b].f) { setFound((f) => [...f, deck[a].f]); setTimeout(() => setOpen([]), 350); }
      else setTimeout(() => setOpen([]), 900);
    }
  };
  const done = found.length === faces.length;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-4 gap-2.5">
        {deck.map((c, idx) => {
          const shown = open.includes(idx) || found.includes(c.f);
          return (
            <button key={c.i} onClick={() => flip(idx)} aria-label={shown ? c.f : t("games.hiddenCard")}
              className={`aspect-[3/4] rounded-2xl border text-3xl transition-all duration-300 ${shown ? "bg-surface2 border-accent/50" : "bg-accent/15 border-line"}`}>
              {shown ? c.f : ""}
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm text-muted" role="status">{done ? t("games.memoryDone") : t("games.pairs", { n: found.length, total: faces.length })}</p>
      {done && <button className="btn btn-primary" onClick={() => { setDeck(make()); setFound([]); setOpen([]); }}>{t("games.again")}</button>}
    </div>
  );
}

/* ── Zen garden: rake the sand ── */
function Zen() {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const paint = useCallback(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, "#e8d8b8"); g.addColorStop(1, "#d8c39b");
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#8a7f75"; ctx.beginPath(); ctx.ellipse(c.width * 0.7, c.height * 0.3, 34, 24, 0.4, 0, 7); ctx.fill();
    ctx.fillStyle = "#a09488"; ctx.beginPath(); ctx.ellipse(c.width * 0.3, c.height * 0.65, 26, 18, -0.3, 0, 7); ctx.fill();
  }, []);
  useEffect(() => {
    const c = ref.current!; const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr; paint();
  }, [paint]);
  const draw = (e: React.PointerEvent) => {
    if (!last.current) return;
    const c = ref.current!; const r = c.getBoundingClientRect(); const dpr = c.width / r.width;
    const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    const ctx = c.getContext("2d")!;
    const dx = x - last.current.x, dy = y - last.current.y; const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (const o of [-9, 0, 9]) {
      ctx.strokeStyle = o === 0 ? "rgb(120 95 60 / .35)" : "rgb(255 250 235 / .5)";
      ctx.lineWidth = 2.2 * dpr; ctx.lineCap = "round"; ctx.beginPath();
      ctx.moveTo(last.current.x + nx * o * dpr, last.current.y + ny * o * dpr);
      ctx.lineTo(x + nx * o * dpr, y + ny * o * dpr); ctx.stroke();
    }
    last.current = { x, y };
  };
  return (
    <div className="grid gap-3">
      <canvas ref={ref} aria-label={t("games.zenLabel")} className="w-full h-[55dvh] rounded-3xl border border-line touch-none"
        onPointerDown={(e) => { const r = ref.current!.getBoundingClientRect(); const dpr = ref.current!.width / r.width; last.current = { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={draw} onPointerUp={() => (last.current = null)} onPointerCancel={() => (last.current = null)} />
      <button className="btn" onClick={paint}>{t("games.smooth")}</button>
    </div>
  );
}

/* ── Clouds hiding little messages ── */
function Clouds() {
  const t = useT();
  const msgs = useMemo(() => t.arr("games.cloudMessages"), [t]);
  const [shown, setShown] = useState<Record<number, boolean>>({});
  return (
    <div className="grid gap-3">
      {msgs.map((m, i) => (
        <button key={i} onClick={() => setShown((s) => ({ ...s, [i]: !s[i] }))} aria-expanded={!!shown[i]}
          className="card p-5 text-center transition min-h-24" style={{ marginLeft: `${(i % 3) * 8}%`, marginRight: `${((i + 1) % 3) * 8}%` }}>
          {shown[i] ? <span className="font-display text-xl rise">{m}</span> : <span className="text-4xl" aria-label={t("games.cloud")}>☁️</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Stars + a little companion that keeps you company ── */
function Stars() {
  const t = useT();
  const stars = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ i, x: rand(6, 94), y: rand(8, 88), s: rand(14, 26) })), []);
  const [lit, setLit] = useState<number[]>([]);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  return (
    <div className="relative h-[60dvh] overflow-hidden rounded-3xl border border-line bg-[#140a1f] select-none"
      onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}>
      <svg className="absolute inset-0 size-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {lit.slice(1).map((s, k) => <line key={s} x1={stars[lit[k]].x} y1={stars[lit[k]].y} x2={stars[s].x} y2={stars[s].y} stroke="#e8d3b0" strokeOpacity=".55" strokeWidth=".35" />)}
      </svg>
      {stars.map((s) => (
        <button key={s.i} aria-label={t("games.star")} onClick={() => { setLit((l) => (l.includes(s.i) ? l : [...l, s.i])); setPos({ x: s.x, y: s.y }); }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 ${lit.includes(s.i) ? "" : "twinkle"}`} style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: s.s, color: lit.includes(s.i) ? "#f6e7c8" : "#a98cc0", animationDelay: `${s.i * 0.2}s` }}>
          {lit.includes(s.i) ? "★" : "✦"}
        </button>
      ))}
      <span className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-[1400ms] ease-out text-2xl" style={{ left: `${pos.x}%`, top: `${pos.y - 4}%` }} aria-hidden>🌙</span>
      <p className="absolute bottom-3 inset-x-0 text-center text-xs text-[#b9a5c4]">{t("games.starsHint")}</p>
    </div>
  );
}

/* ── Glow drawing: strokes fade softly away ── */
function Glow() {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const hue = useRef(300);
  useEffect(() => {
    const c = ref.current!; const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const fade = () => { ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgb(0 0 0 / .025)"; ctx.fillRect(0, 0, c.width, c.height); ctx.globalCompositeOperation = "source-over"; raf = requestAnimationFrame(fade); };
    fade();
    return () => cancelAnimationFrame(raf);
  }, []);
  const dot = (e: React.PointerEvent) => {
    if (!down.current) return;
    const c = ref.current!; const r = c.getBoundingClientRect(); const dpr = c.width / r.width; const ctx = c.getContext("2d")!;
    hue.current = (hue.current + 2) % 360;
    ctx.fillStyle = `hsl(${hue.current} 70% 75% / .9)`; ctx.shadowColor = `hsl(${hue.current} 80% 70%)`; ctx.shadowBlur = 24 * dpr;
    ctx.beginPath(); ctx.arc((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr, 7 * dpr, 0, 7); ctx.fill();
  };
  return (
    <div className="relative rounded-3xl border border-line bg-[#140a1f] overflow-hidden">
      <canvas ref={ref} aria-label={t("games.glowLabel")} className="w-full h-[60dvh] touch-none"
        onPointerDown={(e) => { down.current = true; e.currentTarget.setPointerCapture(e.pointerId); dot(e); }}
        onPointerMove={dot} onPointerUp={() => (down.current = false)} onPointerCancel={() => (down.current = false)} />
      <p className="absolute bottom-3 inset-x-0 text-center text-xs text-[#b9a5c4] pointer-events-none">{t("games.glowHint")}</p>
    </div>
  );
}

export function GamePlayer({ id }: { id: GameId }) {
  return { petals: <Petals />, bubbles: <Bubbles />, memory: <Memory />, zen: <Zen />, clouds: <Clouds />, stars: <Stars />, glow: <Glow /> }[id];
}
