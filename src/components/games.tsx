"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import type { GameId } from "@/lib/games";
import { AppIcon, type IconName } from "@/components/icons";
import { haptic, useGameLevel, useIsClient } from "@/lib/local-pref";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/* ══════════ Petals — catch the colours in the shown order ══════════
   A little sequence (3–6 colours) is shown at the top. Falling petals carry one of a few colours;
   tap the one that matches the NEXT colour in the sequence. A wrong tap just gently resets the
   sequence — never a "loss" — and completing it grows the next one a little. */
const PETAL_COLORS = ["var(--rose)", "var(--mauve)", "var(--gold)", "var(--accent)", "var(--good)"];

function petalLevelFor(round: number) {
  const length = clamp(3 + Math.floor(round / 2), 3, 6);
  const palette = clamp(3 + Math.floor(round / 3), 3, PETAL_COLORS.length);
  const spawnMs = clamp(1050 - round * 25, 520, 1050);
  const fallS = clamp(11 - round * 0.2, 6, 11);
  return { length, palette, spawnMs, fallS };
}

function Petals() {
  const t = useT();
  const [level, setLevel] = useGameLevel("petals");
  const [round, setRound] = useState(level);
  const cfg = useMemo(() => petalLevelFor(round), [round]);
  const [sequence, setSequence] = useState<number[]>(() => Array.from({ length: cfg.length }, () => Math.floor(rand(0, cfg.palette))));
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<"ok" | "miss" | null>(null);
  const [items, setItems] = useState<{ id: number; x: number; s: number; d: number; c: number }[]>([]);
  const id = useRef(0);

  const newSequence = useCallback((r: number) => {
    const c = petalLevelFor(r);
    setSequence(Array.from({ length: c.length }, () => Math.floor(rand(0, c.palette))));
    setProgress(0);
  }, []);

  useEffect(() => {
    const c = petalLevelFor(round);
    const iv = setInterval(() => {
      setItems((cur) => [...cur.slice(-16), { id: id.current++, x: rand(4, 92), s: rand(26, 40), d: rand(c.fallS * 0.8, c.fallS), c: Math.floor(rand(0, c.palette)) }]);
    }, c.spawnMs);
    return () => clearInterval(iv);
  }, [round]);

  const tap = (petalId: number, colour: number) => {
    setItems((cur) => cur.filter((x) => x.id !== petalId));
    if (colour === sequence[progress]) {
      haptic(8);
      setFlash("ok");
      if (progress + 1 >= sequence.length) {
        const next = round + 1;
        setRound(next); setLevel(next); newSequence(next);
      } else setProgress((p) => p + 1);
    } else {
      setFlash("miss");
      setProgress(0);
    }
    setTimeout(() => setFlash(null), 260);
  };

  return (
    <div className="grid gap-3">
      <div className="card p-3 flex items-center justify-center gap-2 flex-wrap" role="status" aria-label={t("games.petals.sequenceLabel")}>
        <span className="eyebrow mr-1">{t("games.petals.next")}</span>
        {sequence.map((c, i) => (
          <span key={i} className="size-6 rounded-full border-2 transition" style={{ background: PETAL_COLORS[c], borderColor: i < progress ? "transparent" : i === progress ? "#fff" : "var(--line)", opacity: i < progress ? 0.3 : 1, transform: i === progress ? "scale(1.15)" : "scale(1)" }} />
        ))}
        <span className="eyebrow ml-2">{t("games.level", { n: round + 1 })}</span>
      </div>
      <div className={`relative h-[54dvh] overflow-hidden rounded-3xl border touch-manipulation select-none transition-colors ${flash === "ok" ? "border-good" : flash === "miss" ? "border-danger" : "border-line"} bg-gradient-to-b from-surface2 to-transparent`}>
        {items.map((p) => (
          <button key={p.id} aria-label={t("games.petals.petalOf", { colour: p.c + 1 })} onClick={() => tap(p.id, p.c)}
            className="absolute top-0" style={{ left: `${p.x}%`, color: PETAL_COLORS[p.c], animation: `drift ${p.d}s linear forwards` }}>
            <AppIcon name="petals" size={Math.round(p.s)} />
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted">{t("games.petals.hint")}</p>
    </div>
  );
}

/* ══════════ Bubbles — pop them in ascending order ══════════
   Bubbles rise carrying a number; pop 1, then 2, then 3… A wrong bubble is simply ignored (no
   penalty) — but if the RIGHT one drifts off the top uncaught, that is a gentle miss. Three
   misses gently restarts the round; the level (how high the count goes) keeps growing. */
function bubbleLevelFor(round: number) {
  const max = clamp(6 + round, 6, 18);
  const spawnMs = clamp(1000 - round * 20, 480, 1000);
  const riseS = clamp(9 - round * 0.15, 5.5, 9);
  return { max, spawnMs, riseS };
}

function shuffledPool(max: number) {
  return Array.from({ length: max }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
}

function Bubbles() {
  const [level, setLevel] = useGameLevel("bubbles");
  const [round, setRound] = useState(level);
  const advance = useCallback(() => { const next = round + 1; setRound(next); setLevel(next); }, [round, setLevel]);
  return <BubblesRound key={round} round={round} onLevelUp={advance} />;
}

function BubblesRound({ round, onLevelUp }: { round: number; onLevelUp: () => void }) {
  const t = useT();
  const cfg = useMemo(() => bubbleLevelFor(round), [round]);
  const [need, setNeed] = useState(1);
  const missesRef = useRef(0);
  const [items, setItems] = useState<{ id: number; n: number; x: number; s: number; d: number }[]>([]);
  const [popped, setPopped] = useState<{ id: number; x: number; y: number; ok: boolean }[]>([]);
  const id = useRef(0);
  const pool = useRef<number[]>(shuffledPool(cfg.max));

  useEffect(() => {
    const iv = setInterval(() => {
      if (!pool.current.length) return;
      const n = pool.current.shift()!;
      setItems((cur) => [...cur.slice(-13), { id: id.current++, n, x: rand(6, 88), s: rand(40, 78), d: rand(cfg.riseS * 0.8, cfg.riseS) }]);
    }, cfg.spawnMs);
    return () => clearInterval(iv);
  }, [cfg.spawnMs, cfg.riseS]);

  const escape = (n: number, bid: number) => {
    setItems((cur) => cur.filter((x) => x.id !== bid));
    if (n !== need) return;
    missesRef.current += 1;
    if (missesRef.current >= 3) { missesRef.current = 0; pool.current = shuffledPool(cfg.max); setNeed(1); setItems([]); }
  };

  const pop = (e: React.MouseEvent<HTMLButtonElement>, b: { id: number; n: number }) => {
    const parent = e.currentTarget.parentElement as HTMLElement;
    const r = parent.getBoundingClientRect(), bb = e.currentTarget.getBoundingClientRect();
    const ok = b.n === need;
    setPopped((p) => [...p, { id: b.id, x: bb.left - r.left + bb.width / 2, y: bb.top - r.top + bb.height / 2, ok }]);
    setTimeout(() => setPopped((p) => p.filter((x) => x.id !== b.id)), 550);
    setItems((cur) => cur.filter((x) => x.id !== b.id));
    if (ok) {
      haptic(8);
      if (need >= cfg.max) onLevelUp();
      else setNeed((v) => v + 1);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="card p-3 flex items-center justify-center gap-4">
        <span className="text-sm text-muted">{t("games.bubbles.find")}</span>
        <span className="font-display text-3xl leading-none">{need}</span>
        <span className="eyebrow">{t("games.level", { n: round + 1 })}</span>
      </div>
      <div className="relative h-[54dvh] overflow-hidden rounded-3xl border border-line bg-gradient-to-t from-surface2 to-transparent select-none">
        {items.map((b) => (
          <button key={b.id} aria-label={t("games.bubbles.bubbleOf", { n: b.n })}
            onAnimationEnd={() => escape(b.n, b.id)}
            onClick={(e) => pop(e, b)}
            className="absolute bottom-0 rounded-full border border-white/40 grid place-items-center font-display text-lg"
            style={{ left: `${b.x}%`, width: b.s, height: b.s, color: "var(--accent-ink)", background: "radial-gradient(circle at 30% 28%, rgb(255 255 255 / .8), var(--rose) 70%)", animation: `bubble-up ${b.d}s ease-in forwards` }}>
            {b.n}
          </button>
        ))}
        {popped.map((p) => (
          <span key={p.id} className={`absolute size-10 -ml-5 -mt-5 rounded-full border-2 pointer-events-none ${p.ok ? "border-good" : "border-white/50"}`} style={{ left: p.x, top: p.y, animation: "pop 0.55s ease-out forwards" }} />
        ))}
        <style>{`@keyframes bubble-up{from{transform:translateY(0) translateX(0)}50%{transform:translateY(-32dvh) translateX(14px)}to{transform:translateY(-70dvh) translateX(-8px)}}@keyframes pop{from{transform:scale(.4);opacity:.9}to{transform:scale(1.8);opacity:0}}`}</style>
      </div>
      <p className="text-center text-xs text-muted">{t("games.bubbles.hint")}</p>
    </div>
  );
}

/* ══════════ Memory — pairs, then a peek phase, then a flip budget ══════════
   Grows to 10 pairs, then keeps evolving instead of growing forever: a brief peek before the
   cards turn face-down, then a limited number of flips to encourage remembering over guessing. */
const MEMORY_FACES: IconName[] = ["moon", "her", "tender", "us", "star", "sun", "joy", "sparkle", "gem", "compass"];
const MEMORY_LEVELS = 50;

function memoryLevelFor(round: number) {
  const r = clamp(round, 0, MEMORY_LEVELS - 1);
  const pairs = clamp(6 + Math.floor(r / 2), 6, 10);
  const peekMs = r >= 15 ? clamp(2400 - (r - 15) * 35, 900, 2400) : 0;
  const flipBudget = r >= 30 ? clamp(pairs * 3 - Math.floor((r - 30) / 2), pairs * 2, pairs * 3) : Infinity;
  return { pairs, peekMs, flipBudget };
}

function Memory() {
  const [level, setLevel] = useGameLevel("memory");
  const [round, setRound] = useState(Math.min(level, MEMORY_LEVELS - 1));
  const advance = useCallback(() => { const next = Math.min(round + 1, MEMORY_LEVELS - 1); setRound(next); setLevel(next); }, [round, setLevel]);
  return <MemoryRound key={round} round={round} onLevelUp={advance} />;
}

function MemoryRound({ round, onLevelUp }: { round: number; onLevelUp: () => void }) {
  const t = useT();
  const cfg = useMemo(() => memoryLevelFor(round), [round]);
  const faces = useMemo(() => MEMORY_FACES.slice(0, cfg.pairs), [cfg.pairs]);
  const shuffle = useCallback(() => [...faces, ...faces].map((f, i) => ({ i, f })).sort(() => Math.random() - 0.5), [faces]);
  const [deck, setDeck] = useState(shuffle);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [flips, setFlips] = useState(0);
  const [peeking, setPeeking] = useState(cfg.peekMs > 0);

  useEffect(() => {
    if (cfg.peekMs <= 0) return;
    const timer = setTimeout(() => setPeeking(false), cfg.peekMs);
    return () => clearTimeout(timer);
  }, [cfg.peekMs]);

  const restart = () => { setDeck(shuffle()); setOpen([]); setFound([]); setFlips(0); setPeeking(cfg.peekMs > 0); };

  const flip = (idx: number) => {
    if (peeking || open.length === 2 || open.includes(idx) || found.includes(deck[idx].f)) return;
    const next = [...open, idx];
    setOpen(next);
    if (next.length === 2) {
      setFlips((f) => f + 1);
      const [a, b] = next;
      if (deck[a].f === deck[b].f) { haptic(8); setFound((f) => [...f, deck[a].f]); setTimeout(() => setOpen([]), 350); }
      else setTimeout(() => setOpen([]), 900);
    }
  };

  const done = found.length === faces.length;
  const stuck = !done && !peeking && Number.isFinite(cfg.flipBudget) && flips >= cfg.flipBudget && open.length < 2;
  const gridCols = faces.length > 8 ? "grid-cols-5" : "grid-cols-4";

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <p className="eyebrow">{t("games.level", { n: round + 1 })}</p>
        {Number.isFinite(cfg.flipBudget) && <p className="eyebrow">{t("games.memory.flipsLeft", { n: Math.max(0, cfg.flipBudget - flips) })}</p>}
      </div>
      <div className={`grid ${gridCols} gap-2.5`}>
        {deck.map((c, idx) => {
          const shown = peeking || open.includes(idx) || found.includes(c.f);
          return (
            <button key={c.i} onClick={() => flip(idx)} disabled={peeking || stuck} aria-label={shown ? t("games.card") : t("games.hiddenCard")}
              className={`aspect-[3/4] rounded-2xl border grid place-items-center transition-all duration-300 ${shown ? "bg-surface2 border-accent/50" : "bg-accent/15 border-line"}`}>
              {shown ? <AppIcon name={c.f} size={26} className="text-accent" /> : null}
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm text-muted" role="status">
        {peeking ? t("games.memory.peek") : done ? t("games.memoryDone") : stuck ? t("games.memory.outOfFlips") : t("games.pairs", { n: found.length, total: faces.length })}
      </p>
      {done && <button className="btn btn-primary" onClick={onLevelUp}>{t("games.again")}</button>}
      {stuck && <button className="btn btn-primary" onClick={restart}>{t("games.again")}</button>}
    </div>
  );
}

/* ══════════ Zen Garden — recreate the marked pattern in the sand ══════════
   A faint outline of the target pattern is always visible; rake (tap) the marked cells and
   nothing else. Calm, no timer, no misses — just careful, deliberate matching. */
const ZEN_LEVELS = 30;

function zenLevelFor(round: number) {
  const r = clamp(round, 0, ZEN_LEVELS - 1);
  const size = clamp(3 + Math.floor(r / 6), 3, 6);
  const density = clamp(0.3 + r * 0.006, 0.3, 0.5);
  return { size, density };
}

function makeZenTarget(size: number, density: number) {
  const total = size * size;
  const count = clamp(Math.round(total * density), 3, total - 2);
  const idx = Array.from({ length: total }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, count);
  return new Set(idx);
}

function Zen() {
  const [level, setLevel] = useGameLevel("zen");
  const [round, setRound] = useState(Math.min(level, ZEN_LEVELS - 1));
  const advance = useCallback(() => { const next = Math.min(round + 1, ZEN_LEVELS - 1); setRound(next); setLevel(next); }, [round, setLevel]);
  return <ZenRound key={round} round={round} onLevelUp={advance} />;
}

function ZenRound({ round, onLevelUp }: { round: number; onLevelUp: () => void }) {
  const t = useT();
  const cfg = useMemo(() => zenLevelFor(round), [round]);
  const [target] = useState(() => makeZenTarget(cfg.size, cfg.density));
  const [raked, setRaked] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    haptic(6);
    setRaked((r) => { const n = new Set(r); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  };

  const done = raked.size === target.size && [...target].every((i) => raked.has(i));

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(onLevelUp, 1500);
    return () => clearTimeout(timer);
  }, [done, onLevelUp]);

  return (
    <div className="grid gap-3">
      <p className="text-center eyebrow">{t("games.level", { n: round + 1 })}</p>
      <div className="relative rounded-3xl border border-line overflow-hidden" style={{ background: "linear-gradient(160deg, #e8d8b8, #d8c39b)" }}>
        <div className="grid aspect-square gap-1.5 p-3" style={{ gridTemplateColumns: `repeat(${cfg.size}, 1fr)` }}>
          {Array.from({ length: cfg.size * cfg.size }, (_, i) => {
            const isTarget = target.has(i);
            const isRaked = raked.has(i);
            return (
              <button key={i} onClick={() => toggle(i)} disabled={done}
                aria-label={isRaked ? t("games.zen.raked") : t("games.zen.plain")}
                className="relative rounded-xl transition-all duration-300"
                style={{ background: isRaked ? "rgb(120 95 60 / .28)" : "rgb(255 250 235 / .18)" }}>
                {isTarget && !isRaked && <span className="absolute inset-0 m-auto size-1.5 rounded-full" style={{ background: "rgb(120 95 60 / .45)" }} />}
                {isRaked && <span className="absolute inset-1 rounded-lg border border-[rgb(120_95_60_/_.4)]" />}
              </button>
            );
          })}
        </div>
        {done && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none pop-in" style={{ background: "rgb(232 216 184 / .35)" }}>
            <AppIcon name="sparkle" size={32} className="text-[#7a5c33]" />
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted">{t("games.zen.hint")}</p>
    </div>
  );
}

/* ══════════ Clouds — remember which ones glowed, then clear exactly those ══════════
   A handful of clouds glow softly for a moment; once they settle, find the same ones by memory.
   Wrong taps cost a gentle "try" — too many and the sky resets, kindly. */
const CLOUD_LEVELS = 50;

function cloudLevelFor(round: number) {
  const r = clamp(round, 0, CLOUD_LEVELS - 1);
  const size = clamp(3 + Math.floor(r / 8), 3, 6);
  const targets = clamp(3 + Math.floor(r / 4), 3, Math.floor(size * size * 0.4));
  const peekMs = clamp(2200 - r * 20, 900, 2200);
  const maxMisses = clamp(5 - Math.floor(r / 12), 2, 5);
  return { size, targets, peekMs, maxMisses };
}

function Clouds() {
  const [level, setLevel] = useGameLevel("clouds");
  const [round, setRound] = useState(Math.min(level, CLOUD_LEVELS - 1));
  const advance = useCallback(() => { const next = Math.min(round + 1, CLOUD_LEVELS - 1); setRound(next); setLevel(next); }, [round, setLevel]);
  return <CloudsRound key={round} round={round} onLevelUp={advance} />;
}

function CloudsRound({ round, onLevelUp }: { round: number; onLevelUp: () => void }) {
  const t = useT();
  const cfg = useMemo(() => cloudLevelFor(round), [round]);
  const msgs = useMemo(() => t.arr("games.cloudMessages"), [t]);
  const [targets] = useState(() => new Set(Array.from({ length: cfg.size * cfg.size }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, cfg.targets)));
  const [peeking, setPeeking] = useState(true);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [misses, setMisses] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setPeeking(false), cfg.peekMs);
    return () => clearTimeout(timer);
  }, [cfg.peekMs]);

  const done = revealed.size === targets.size;
  const stuck = !done && misses >= cfg.maxMisses;

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(onLevelUp, 1800);
    return () => clearTimeout(timer);
  }, [done, onLevelUp]);

  const tap = (i: number) => {
    if (peeking || done || stuck || revealed.has(i)) return;
    if (targets.has(i)) { haptic(8); setRevealed((r) => new Set(r).add(i)); }
    else { haptic(4); setMisses((m) => m + 1); }
  };

  const restart = () => { setRevealed(new Set()); setMisses(0); setPeeking(true); };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-center gap-3">
        <p className="eyebrow">{t("games.level", { n: round + 1 })}</p>
        {!peeking && <p className="eyebrow">{t("games.clouds.missesLeft", { n: Math.max(0, cfg.maxMisses - misses) })}</p>}
      </div>
      <div className="relative rounded-3xl border border-line overflow-hidden bg-[#140a1f]">
        <div className="grid aspect-square gap-1.5 p-3" style={{ gridTemplateColumns: `repeat(${cfg.size}, 1fr)` }}>
          {Array.from({ length: cfg.size * cfg.size }, (_, i) => {
            const isTarget = targets.has(i);
            const isRevealed = revealed.has(i);
            return (
              <button key={i} onClick={() => tap(i)} disabled={peeking || done || stuck}
                aria-label={isRevealed ? t("games.clouds.cleared") : t("games.cloud")}
                className="relative grid place-items-center rounded-xl">
                {isRevealed ? (
                  <AppIcon name="star" size={16} className="text-gold fill-current pop-in" />
                ) : (
                  <AppIcon name="cloud" size={28} className={peeking && isTarget ? "text-gold twinkle" : "text-mauve"} />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-center text-sm text-muted" role="status">
        {peeking ? t("games.clouds.peek") : done ? msgs[round % msgs.length] : stuck ? t("games.clouds.outOfTries") : t("games.clouds.hint")}
      </p>
      {stuck && <button className="btn btn-primary justify-self-center" onClick={restart}>{t("games.again")}</button>}
    </div>
  );
}

/* ══════════ Stars — reproduce the constellation ══════════
   A small original shape (heart, wave, crescent…) is hidden among a field of stars. Tap the
   points in order: the correct next star pulses a little brighter as a quiet hint. No penalty
   for tapping the wrong one — it simply does nothing until the right one is found. */
type ConstellationName = "heart" | "moon" | "star" | "wave" | "infinity" | "diamond" | "spiral";
const CONSTELLATIONS: { name: ConstellationName; points: [number, number][] }[] = [
  { name: "heart", points: [[50, 30], [38, 18], [22, 24], [20, 40], [50, 68], [80, 40], [78, 24], [62, 18], [50, 30]] },
  { name: "moon", points: [[62, 15], [48, 22], [40, 35], [40, 55], [48, 68], [62, 75], [52, 60], [48, 45], [52, 30]] },
  { name: "star", points: [[50, 12], [58, 40], [86, 40], [64, 56], [72, 84], [50, 66], [28, 84], [36, 56], [14, 40], [42, 40]] },
  { name: "wave", points: [[10, 60], [24, 40], [38, 60], [52, 40], [66, 60], [80, 40], [90, 55]] },
  { name: "infinity", points: [[30, 50], [18, 35], [10, 50], [18, 65], [35, 50], [50, 35], [65, 50], [82, 35], [90, 50], [82, 65], [65, 50], [50, 65], [30, 50]] },
  { name: "diamond", points: [[50, 12], [72, 40], [50, 88], [28, 40], [50, 12]] },
  { name: "spiral", points: [[50, 50], [58, 44], [58, 58], [40, 58], [40, 32], [66, 32], [66, 66], [30, 66]] },
];

function Stars() {
  const [level, setLevel] = useGameLevel("stars");
  const [round, setRound] = useState(level);
  const advance = useCallback(() => { const next = round + 1; setRound(next); setLevel(next); }, [round, setLevel]);
  return <StarsRound key={round} round={round} onLevelUp={advance} />;
}

function StarsRound({ round, onLevelUp }: { round: number; onLevelUp: () => void }) {
  const t = useT();
  const target = CONSTELLATIONS[round % CONSTELLATIONS.length];
  const decoyCount = clamp(6 + Math.floor(round / 2), 6, 14);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const stars = useMemo(() => {
    const pts = target.points.map((p, i) => ({ i, x: p[0], y: p[1], s: rand(16, 22), target: true }));
    const decoys = Array.from({ length: decoyCount }, (_, k) => ({ i: target.points.length + k, x: rand(4, 96), y: rand(6, 92), s: rand(10, 18), target: false }));
    return [...pts, ...decoys];
  }, [target, decoyCount]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(onLevelUp, 1500);
    return () => clearTimeout(timer);
  }, [done, onLevelUp]);

  const tapStar = (s: (typeof stars)[number]) => {
    if (done || !s.target || s.i !== step) return;
    haptic(8);
    if (step + 1 >= target.points.length) setDone(true);
    else setStep((v) => v + 1);
  };

  return (
    <div className="grid gap-3">
      <p className="text-center eyebrow">{t("games.level", { n: round + 1 })} · {t(`games.constellations.${target.name}`)}</p>
      <div className="relative h-[54dvh] overflow-hidden rounded-3xl border border-line bg-[#140a1f] select-none">
        <svg className="absolute inset-0 size-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {target.points.slice(1, step + 1).map((p, k) => {
            const a = target.points[k];
            return <line key={k} x1={a[0]} y1={a[1]} x2={p[0]} y2={p[1]} stroke="#f6e7c8" strokeOpacity={done ? 0.9 : 0.7} strokeWidth={done ? 0.8 : 0.5} />;
          })}
        </svg>
        {stars.map((s) => {
          const lit = s.target && s.i < step;
          const isNext = s.target && s.i === step && !done;
          return (
            <button key={s.i} aria-label={s.target ? t("games.star") : t("games.stars.decoy")} onClick={() => tapStar(s)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${lit || done ? "" : "twinkle"}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, color: lit || done ? "#f6e7c8" : isNext ? "#f0c3c4" : "#7d6789", animationDelay: `${s.i * 0.15}s`, transform: `translate(-50%, -50%) scale(${isNext ? 1.35 : 1})`, transition: "transform 0.4s ease, color 0.4s" }}>
              <AppIcon name="star" size={Math.round(s.s)} className={lit || done ? "fill-current" : isNext ? "fill-current" : ""} />
            </button>
          );
        })}
        {done && (
          <div className="absolute inset-0 grid place-items-center pop-in">
            <AppIcon name="us" size={40} className="text-rose fill-current" />
          </div>
        )}
        <p className="absolute bottom-3 inset-x-0 text-center text-xs text-[#b9a5c4]">{t("games.starsHint")}</p>
      </div>
    </div>
  );
}

/* ══════════ Light — rotate mirrors to route the beam to the gem ══════════
   A short light-path is generated fresh each round and its mirrors are scrambled; only the
   cells that matter are tappable. Rotate them until the beam reaches the target. */
function splitEven(total: number, parts: number) {
  const base = Math.floor(total / parts), rem = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

function lightLevelFor(round: number) {
  const size = clamp(4 + Math.floor(round / 3), 4, 7);
  const turnsMax = clamp(1 + Math.floor(round / 2), 1, 4);
  return { size, turnsMax };
}

function makeLightLevel(round: number) {
  const { size, turnsMax } = lightLevelFor(round);
  const sourceY = Math.floor(rand(0, size));
  const roomDown = size - 1 - sourceY, roomUp = sourceY;
  const vSign: 1 | -1 = roomDown >= roomUp ? 1 : -1;
  const maxV = Math.max(1, vSign === 1 ? roomDown : roomUp);
  const turnsC = clamp(turnsMax, 1, Math.min(size - 2, maxV));
  const vTotal = clamp(Math.round(rand(turnsC, maxV + 1)), turnsC, maxV);
  const targetY = sourceY + vSign * vTotal;
  const hLens = splitEven(size - 1, turnsC + 1);
  const vLens = splitEven(vTotal, turnsC);
  const turnSymbol: "/" | "\\" = vSign === 1 ? "\\" : "/";
  const solution: Record<string, "/" | "\\"> = {};
  let x = 0, y = sourceY;
  for (let i = 0; i < turnsC; i++) {
    x += hLens[i];
    solution[`${x},${y}`] = turnSymbol;
    y += vSign * vLens[i];
    solution[`${x},${y}`] = turnSymbol;
  }
  const scrambleChance = clamp(0.5 + round * 0.04, 0.5, 0.95);
  const board: Record<string, "/" | "\\"> = {};
  for (const [k, v] of Object.entries(solution)) board[k] = Math.random() < scrambleChance ? (v === "/" ? "\\" : "/") : v;
  return { size, sourceY, targetY, board };
}

function simulateLight(size: number, sourceY: number, targetY: number, board: Record<string, "/" | "\\">) {
  let x = 0, y = sourceY, dx = 1, dy = 0;
  const path = [{ x, y }];
  let hit = false;
  for (let i = 0; i < size * size + 8; i++) {
    x += dx; y += dy;
    if (x < 0 || x >= size || y < 0 || y >= size) break;
    path.push({ x, y });
    if (x === size - 1 && y === targetY) { hit = true; break; }
    const m = board[`${x},${y}`];
    if (m === "/") { const ndx = -dy, ndy = -dx; dx = ndx; dy = ndy; }
    else if (m === "\\") { const ndx = dy, ndy = dx; dx = ndx; dy = ndy; }
  }
  return { path, hit };
}

function Light() {
  const [level, setLevel] = useGameLevel("light");
  const [round, setRound] = useState(level);
  const advance = useCallback(() => { const next = round + 1; setRound(next); setLevel(next); }, [round, setLevel]);
  return <LightRound key={round} round={round} onLevelUp={advance} />;
}

function LightRound({ round, onLevelUp }: { round: number; onLevelUp: () => void }) {
  const t = useT();
  const [game] = useState(() => makeLightLevel(round));
  const [board, setBoard] = useState(game.board);
  const sim = useMemo(() => simulateLight(game.size, game.sourceY, game.targetY, board), [game, board]);

  useEffect(() => {
    if (!sim.hit) return;
    const timer = setTimeout(onLevelUp, 1400);
    return () => clearTimeout(timer);
  }, [sim.hit, onLevelUp]);

  const toggle = (key: string) => {
    if (sim.hit || !(key in game.board)) return;
    haptic(6);
    setBoard((b) => ({ ...b, [key]: b[key] === "/" ? "\\" : "/" }));
  };

  const cell = 100 / game.size;
  return (
    <div className="grid gap-3">
      <p className="text-center eyebrow">{t("games.level", { n: round + 1 })}</p>
      <div className="relative aspect-square rounded-3xl border border-line bg-[#140a1f] overflow-hidden select-none">
        <svg className="absolute inset-0 size-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline points={sim.path.map((p) => `${p.x * cell + cell / 2},${p.y * cell + cell / 2}`).join(" ")}
            fill="none" stroke={sim.hit ? "#f6e7c8" : "#c9959a"} strokeOpacity={sim.hit ? 1 : 0.55}
            strokeWidth={sim.hit ? 1.6 : 1} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${game.size}, 1fr)` }}>
          {Array.from({ length: game.size * game.size }, (_, idx) => {
            const x = idx % game.size, y = Math.floor(idx / game.size);
            const key = `${x},${y}`;
            const isSource = x === 0 && y === game.sourceY;
            const isTarget = x === game.size - 1 && y === game.targetY;
            const piece = board[key];
            return (
              <button key={key} disabled={!piece} onClick={() => toggle(key)}
                aria-label={isSource ? t("games.light.source") : isTarget ? t("games.light.target") : piece ? t("games.light.mirror") : t("games.light.empty")}
                className="relative grid place-items-center">
                {isSource && <AppIcon name="light" size={18} className="text-gold" />}
                {isTarget && <AppIcon name="gem" size={18} className={sim.hit ? "text-gold" : "text-mauve"} />}
                {piece && !isSource && !isTarget && (
                  <span className="block w-3/5 h-0.5 rounded-full bg-rose/80" style={{ transform: `rotate(${piece === "/" ? -45 : 45}deg)` }} />
                )}
              </button>
            );
          })}
        </div>
        {sim.hit && <div className="absolute inset-0 grid place-items-center pointer-events-none pop-in"><AppIcon name="sparkle" size={30} className="text-gold" /></div>}
      </div>
      <p className="text-center text-xs text-muted">{t("games.light.hint")}</p>
    </div>
  );
}

/* ══════════ Treasure Dig — limited digs, breakable tiles, rats, bombs, bonuses ══════════ */
type TCell = { content: "dirt" | "treasure" | "rat" | "bomb" | "bonus"; hard: boolean; cracked: boolean; revealed: boolean };

function treasureLevelFor(round: number) {
  const size = clamp(5 + Math.floor(round / 3), 5, 8);
  const cellCount = size * size;
  const treasures = clamp(3 + Math.floor(round / 2), 3, 8);
  const rats = clamp(2 + Math.floor(round / 3), 1, 6);
  const bombs = clamp(1 + Math.floor(round / 4), 0, 4);
  const bonus = 2;
  const hard = clamp(2 + Math.floor(round / 2), 0, Math.floor(cellCount * 0.2));
  const digs = Math.min(cellCount, Math.max(treasures + hard + 8, Math.floor(cellCount * 0.55) - round));
  return { size, treasures, rats, bombs, bonus, hard, digs };
}

function makeTreasureCells(cfg: ReturnType<typeof treasureLevelFor>): TCell[] {
  const total = cfg.size * cfg.size;
  const order = Array.from({ length: total }, (_, i) => i).sort(() => Math.random() - 0.5);
  const cells: TCell[] = Array.from({ length: total }, () => ({ content: "dirt", hard: false, cracked: false, revealed: false }));
  let p = 0;
  for (let i = 0; i < cfg.treasures; i++) cells[order[p++]].content = "treasure";
  for (let i = 0; i < cfg.rats; i++) cells[order[p++]].content = "rat";
  for (let i = 0; i < cfg.bombs; i++) cells[order[p++]].content = "bomb";
  for (let i = 0; i < cfg.bonus; i++) cells[order[p++]].content = "bonus";
  const hardPool = order.slice(p).sort(() => Math.random() - 0.5);
  for (let i = 0; i < cfg.hard; i++) if (hardPool[i] !== undefined) cells[hardPool[i]].hard = true;
  return cells;
}

function TreasureDig() {
  const [level, setLevel] = useGameLevel("treasure");
  const [round, setRound] = useState(level);
  const advance = useCallback(() => { const next = round + 1; setRound(next); setLevel(next); }, [round, setLevel]);
  return <TreasureRound key={round} round={round} onLevelUp={advance} />;
}

function TreasureRound({ round, onLevelUp }: { round: number; onLevelUp: () => void }) {
  const t = useT();
  const [cfg] = useState(() => treasureLevelFor(round));
  const [cells, setCells] = useState<TCell[]>(() => makeTreasureCells(cfg));
  const [digsLeft, setDigsLeft] = useState(cfg.digs);
  const [found, setFound] = useState(0);
  const [flash, setFlash] = useState<"bomb" | "bonus" | null>(null);

  const size = cfg.size;
  const won = found >= cfg.treasures;
  const stuck = !won && digsLeft <= 0;

  useEffect(() => {
    if (!won) return;
    const timer = setTimeout(onLevelUp, 1600);
    return () => clearTimeout(timer);
  }, [won, onLevelUp]);

  const neighbors = (i: number) => {
    const x = i % size, y = Math.floor(i / size);
    const out: number[] = [];
    if (x > 0) out.push(i - 1);
    if (x < size - 1) out.push(i + 1);
    if (y > 0) out.push(i - size);
    if (y < size - 1) out.push(i + size);
    return out;
  };

  const dig = (i: number) => {
    if (won || stuck) return;
    const next = cells.slice();
    const c = next[i];
    if (c.revealed) return;

    if (c.hard && !c.cracked) {
      next[i] = { ...c, cracked: true };
      setCells(next);
      setDigsLeft((d) => Math.max(0, d - 1));
      haptic(6);
      return;
    }

    let digsDelta = -1, foundDelta = 0, flashKind: "bomb" | "bonus" | null = null;
    const applyReveal = (idx: number) => {
      const cell = next[idx];
      next[idx] = { ...cell, revealed: true };
      if (cell.content === "treasure") foundDelta++;
      else if (cell.content === "bomb") { digsDelta -= 3; flashKind = "bomb"; }
      else if (cell.content === "bonus") { digsDelta += 2; flashKind = flashKind ?? "bonus"; }
    };

    applyReveal(i);
    if (c.content === "rat") {
      haptic(8);
      const queue = neighbors(i);
      const seen = new Set<number>([i]);
      while (queue.length) {
        const n = queue.shift()!;
        if (seen.has(n)) continue;
        seen.add(n);
        const nc = next[n];
        if (nc.revealed || (nc.hard && !nc.cracked)) continue;
        applyReveal(n);
        if (nc.content === "dirt") queue.push(...neighbors(n));
      }
    } else if (c.content === "treasure") haptic([10, 40, 10]);
    else if (c.content === "bomb") haptic([15, 30, 15, 30]);
    else if (c.content === "bonus") haptic(10);

    setCells(next);
    setFound((f) => f + foundDelta);
    setDigsLeft((d) => Math.max(0, d + digsDelta));
    if (flashKind) { setFlash(flashKind); setTimeout(() => setFlash(null), 500); }
  };

  const labelFor = (c: TCell) => {
    if (!c.revealed) return c.hard && c.cracked ? t("games.treasure.cracked") : t("games.treasure.hidden");
    return t(`games.treasure.found.${c.content}`);
  };

  return (
    <div className="grid gap-3">
      <div className={`card p-3 flex items-center justify-center gap-4 transition-colors ${flash === "bomb" ? "border-danger" : flash === "bonus" ? "border-good" : ""}`}>
        <span className="flex items-center gap-1.5 text-sm"><AppIcon name="treasureDig" size={15} className="text-muted" />{t("games.treasure.digsLeft", { n: digsLeft })}</span>
        <span className="flex items-center gap-1.5 text-sm"><AppIcon name="gem" size={15} className="text-gold" />{t("games.treasure.found.count", { n: found, total: cfg.treasures })}</span>
        <span className="eyebrow">{t("games.level", { n: round + 1 })}</span>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {cells.map((c, i) => (
          <button key={i} onClick={() => dig(i)} disabled={c.revealed || won || stuck} aria-label={labelFor(c)}
            className={`aspect-square rounded-xl grid place-items-center border transition-all ${c.revealed ? "bg-surface2 border-line" : c.cracked ? "bg-gold/20 border-gold/50" : "bg-accent/10 border-line active:scale-95"}`}>
            {c.revealed && c.content === "treasure" && <AppIcon name="gem" size={18} className="text-gold pop-in" />}
            {c.revealed && c.content === "rat" && <AppIcon name="rat" size={18} className="text-muted" />}
            {c.revealed && c.content === "bomb" && <AppIcon name="bomb" size={18} className="text-danger" />}
            {c.revealed && c.content === "bonus" && <AppIcon name="sparkle" size={18} className="text-good" />}
          </button>
        ))}
      </div>
      {won && <p className="text-center text-sm text-good" role="status">{t("games.treasure.allFound")}</p>}
      {stuck && (
        <div className="grid gap-2 justify-items-center">
          <p className="text-sm text-muted" role="status">{t("games.treasure.outOfDigs")}</p>
          <button className="btn btn-primary" onClick={() => { setCells(makeTreasureCells(cfg)); setDigsLeft(cfg.digs); setFound(0); }}>{t("games.again")}</button>
        </div>
      )}
      <p className="text-center text-xs text-muted">{t("games.treasure.hint")}</p>
    </div>
  );
}

/* ══════════ Match — swap-adjacent match-3 with objectives, moves and blockers ══════════
   1–9: clear a score target with generous moves. 10–19: tighter moves. 20–29: locked tiles that
   unlock when a match happens next to them. 30–49+: a symbol-collect objective on top of score.
   A 4-in-a-row clears its whole line for a satisfying bonus at any tier. */
const MATCH_LEVELS = 100;
const MATCH_SYMBOLS: IconName[] = ["moon", "star", "us", "her", "sparkle", "gem"];
type MCell = { symbol: number; locked: boolean };

function match3LevelFor(round: number) {
  const r = clamp(round, 0, MATCH_LEVELS - 1);
  const size = clamp(6 + Math.floor(r / 25), 6, 8);
  const symbols = clamp(4 + Math.floor(r / 20), 4, MATCH_SYMBOLS.length);
  const moves = r < 10 ? 22 : clamp(20 - Math.floor((r - 10) / 15), 12, 20);
  const blockerDensity = r >= 20 ? clamp(0.04 + (r - 20) * 0.0025, 0.04, 0.18) : 0;
  const collectTarget = r >= 30 ? clamp(8 + Math.floor((r - 30) / 6), 8, 22) : 0;
  const scoreTarget = clamp(260 + r * 30, 260, 3800);
  return { size, symbols, moves, blockerDensity, collectTarget, scoreTarget };
}

function m3Neighbors(i: number, n: number) {
  const x = i % n, y = Math.floor(i / n);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < n - 1) out.push(i + 1);
  if (y > 0) out.push(i - n);
  if (y < n - 1) out.push(i + n);
  return out;
}

function m3RandomSymbol(symbols: number) { return Math.floor(rand(0, symbols)); }

function makeMatchBoard(cfg: ReturnType<typeof match3LevelFor>): MCell[] {
  const n = cfg.size;
  const cells: MCell[] = Array.from({ length: n * n }, () => ({ symbol: 0, locked: false }));
  for (let i = 0; i < n * n; i++) {
    const x = i % n, y = Math.floor(i / n);
    let symbol = m3RandomSymbol(cfg.symbols);
    let guard = 0;
    while (guard++ < 20 && (
      (x >= 2 && cells[i - 1].symbol === symbol && cells[i - 2].symbol === symbol) ||
      (y >= 2 && cells[i - n].symbol === symbol && cells[i - 2 * n].symbol === symbol)
    )) symbol = m3RandomSymbol(cfg.symbols);
    cells[i] = { symbol, locked: false };
  }
  const lockCount = Math.round(n * n * cfg.blockerDensity);
  const pool = Array.from({ length: n * n }, (_, i) => i).sort(() => Math.random() - 0.5);
  for (let i = 0; i < lockCount; i++) cells[pool[i]].locked = true;
  return cells;
}

function m3FindMatches(cells: MCell[], n: number): Set<number> {
  const hit = new Set<number>();
  for (let y = 0; y < n; y++) {
    let runStart = 0;
    for (let x = 1; x <= n; x++) {
      const same = x < n && !cells[y * n + x].locked && !cells[y * n + runStart].locked && cells[y * n + x].symbol === cells[y * n + runStart].symbol;
      if (!same) {
        if (x - runStart >= 3) for (let k = runStart; k < x; k++) hit.add(y * n + k);
        runStart = x;
      }
    }
  }
  for (let x = 0; x < n; x++) {
    let runStart = 0;
    for (let y = 1; y <= n; y++) {
      const same = y < n && !cells[y * n + x].locked && !cells[runStart * n + x].locked && cells[y * n + x].symbol === cells[runStart * n + x].symbol;
      if (!same) {
        if (y - runStart >= 3) for (let k = runStart; k < y; k++) hit.add(k * n + x);
        runStart = y;
      }
    }
  }
  // 4+ runs bonus: clear the whole line they're on
  for (let y = 0; y < n; y++) {
    let runStart = 0;
    for (let x = 1; x <= n; x++) {
      const same = x < n && !cells[y * n + x].locked && !cells[y * n + runStart].locked && cells[y * n + x].symbol === cells[y * n + runStart].symbol;
      if (!same) {
        if (x - runStart >= 4) for (let k = 0; k < n; k++) if (!cells[y * n + k].locked) hit.add(y * n + k);
        runStart = x;
      }
    }
  }
  return hit;
}

function Match3() {
  const [level, setLevel] = useGameLevel("match3");
  const [round, setRound] = useState(Math.min(level, MATCH_LEVELS - 1));
  const advance = useCallback(() => { const next = Math.min(round + 1, MATCH_LEVELS - 1); setRound(next); setLevel(next); }, [round, setLevel]);
  return <Match3Round key={round} round={round} onLevelUp={advance} />;
}

function Match3Round({ round, onLevelUp }: { round: number; onLevelUp: () => void }) {
  const t = useT();
  const cfg = useMemo(() => match3LevelFor(round), [round]);
  const [cells, setCells] = useState(() => makeMatchBoard(cfg));
  const [selected, setSelected] = useState<number | null>(null);
  const [movesLeft, setMovesLeft] = useState(cfg.moves);
  const [score, setScore] = useState(0);
  const [collected, setCollected] = useState(0);
  const [targetSymbol] = useState(() => m3RandomSymbol(cfg.symbols));
  const [busy, setBusy] = useState(false);

  const n = cfg.size;
  const won = score >= cfg.scoreTarget && (cfg.collectTarget === 0 || collected >= cfg.collectTarget);
  const lost = !won && movesLeft <= 0;

  useEffect(() => {
    if (!won) return;
    const timer = setTimeout(onLevelUp, 1700);
    return () => clearTimeout(timer);
  }, [won, onLevelUp]);

  const resolve = (board: MCell[]) => {
    let scoreGain = 0, collectGain = 0;
    for (;;) {
      const matched = m3FindMatches(board, n);
      if (matched.size === 0) break;
      scoreGain += matched.size * 10;
      for (const idx of matched) if (board[idx].symbol === targetSymbol) collectGain++;
      for (const idx of matched) for (const nb of m3Neighbors(idx, n)) if (board[nb].locked) board[nb] = { ...board[nb], locked: false };
      for (const idx of matched) board[idx] = { symbol: -1, locked: false };
      for (let x = 0; x < n; x++) {
        let write = n - 1;
        for (let y = n - 1; y >= 0; y--) {
          const idx = y * n + x;
          if (board[idx].symbol !== -1) { board[write * n + x] = board[idx]; if (write !== y) board[idx] = { symbol: -1, locked: false }; write--; }
        }
        for (let y = write; y >= 0; y--) board[y * n + x] = { symbol: m3RandomSymbol(cfg.symbols), locked: false };
      }
    }
    return { board, scoreGain, collectGain };
  };

  const trySwap = (a: number, b: number) => {
    if (busy || lost || won) return;
    if (!m3Neighbors(a, n).includes(b)) { setSelected(b); return; }
    if (cells[a].locked || cells[b].locked) { setSelected(null); return; }
    const attempt = cells.slice();
    [attempt[a], attempt[b]] = [attempt[b], attempt[a]];
    if (m3FindMatches(attempt, n).size === 0) { setSelected(null); return; }
    setSelected(null);
    setBusy(true);
    const { board, scoreGain, collectGain } = resolve(attempt);
    setCells(board);
    setScore((s) => s + scoreGain);
    setCollected((c) => c + collectGain);
    setMovesLeft((m) => m - 1);
    setBusy(false);
  };

  const tap = (i: number) => {
    if (busy || lost || won || cells[i].locked) return;
    if (selected === null) { setSelected(i); return; }
    if (selected === i) { setSelected(null); return; }
    trySwap(selected, i);
  };

  const retry = () => { setCells(makeMatchBoard(cfg)); setMovesLeft(cfg.moves); setScore(0); setCollected(0); setSelected(null); };

  return (
    <div className="grid gap-3">
      <div className="card p-3 flex items-center justify-center gap-3 flex-wrap text-sm">
        <span className="eyebrow">{t("games.level", { n: round + 1 })}</span>
        <span>{t("games.match.moves", { n: movesLeft })}</span>
        <span>{t("games.match.score", { n: score, total: cfg.scoreTarget })}</span>
        {cfg.collectTarget > 0 && (
          <span className="flex items-center gap-1"><AppIcon name={MATCH_SYMBOLS[targetSymbol]} size={14} className="text-accent" />{collected}/{cfg.collectTarget}</span>
        )}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {cells.map((c, i) => (
          <button key={i} onClick={() => tap(i)} disabled={busy || lost || won}
            aria-label={c.locked ? t("games.match.locked") : t("games.match.symbol", { n: c.symbol + 1 })}
            className={`aspect-square rounded-xl grid place-items-center border transition-all ${selected === i ? "border-accent bg-accent/20 scale-95" : c.locked ? "border-line bg-surface2" : "border-line bg-accent/10 active:scale-95"}`}>
            {c.locked ? <AppIcon name="lock" size={16} className="text-muted opacity-60" /> : <AppIcon name={MATCH_SYMBOLS[c.symbol]} size={18} className="text-accent" />}
          </button>
        ))}
      </div>
      {won && <p className="text-center text-sm text-good" role="status">{t("games.match.won")}</p>}
      {lost && (
        <div className="grid gap-2 justify-items-center">
          <p className="text-sm text-muted" role="status">{t("games.match.outOfMoves")}</p>
          <button className="btn btn-primary" onClick={retry}>{t("games.again")}</button>
        </div>
      )}
      <p className="text-center text-xs text-muted">{t("games.match.hint")}</p>
    </div>
  );
}

/* ══════════ Puzzle — a classic sliding tile puzzle over a photo or Allyza's own moon+heart mark ══════════
   Choose any photo, or use the built-in Allyza artwork. Slide tiles into the empty slot to
   rebuild the picture; the grid grows from 3×3 to 5×5 as levels go on. */
const PUZZLE_LEVELS = 30;

function puzzleLevelFor(round: number) { return { size: clamp(3 + Math.floor(clamp(round, 0, PUZZLE_LEVELS - 1) / 10), 3, 5) }; }

function defaultPuzzleImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="bg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#3b1f52"/><stop offset="1" stop-color="#160e33"/></radialGradient>
      <linearGradient id="mo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0c3c4"/><stop offset="1" stop-color="#b9788a"/></linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#bg)"/>
    <circle cx="82" cy="106" r="46" fill="url(#mo)" opacity="0.9"/>
    <circle cx="100" cy="92" r="38" fill="#160e33"/>
    <path d="M110 122c-9-8-17-14-17-22a9 9 0 0 1 17-4 9 9 0 0 1 17 4c0 8-8 14-17 22z" fill="#fff" opacity="0.92"/>
    <circle cx="150" cy="50" r="2.4" fill="#f6e7c8"/><circle cx="165" cy="80" r="1.6" fill="#f6e7c8"/>
    <circle cx="40" cy="150" r="2" fill="#f6e7c8"/><circle cx="60" cy="40" r="1.6" fill="#f6e7c8"/><circle cx="170" cy="140" r="1.8" fill="#f6e7c8"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function puzzleNeighbors(i: number, n: number) {
  const x = i % n, y = Math.floor(i / n);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < n - 1) out.push(i + 1);
  if (y > 0) out.push(i - n);
  if (y < n - 1) out.push(i + n);
  return out;
}

function shufflePuzzle(n: number) {
  const order = Array.from({ length: n * n }, (_, i) => i);
  let blank = n * n - 1, last = -1;
  const moves = n * n * 12;
  for (let i = 0; i < moves; i++) {
    const options = puzzleNeighbors(blank, n).filter((x) => x !== last);
    const pick = options[Math.floor(Math.random() * options.length)];
    [order[blank], order[pick]] = [order[pick], order[blank]];
    last = blank; blank = pick;
  }
  return { order, blank };
}

function Puzzle({ photos = [] }: { photos?: string[] }) {
  const t = useT();
  const [level, setLevel] = useGameLevel("puzzle");
  const [round, setRound] = useState(Math.min(level, PUZZLE_LEVELS - 1));
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(photos[0] ?? null);
  const advance = useCallback(() => { const next = Math.min(round + 1, PUZZLE_LEVELS - 1); setRound(next); setLevel(next); }, [round, setLevel]);

  useEffect(() => () => { if (uploadUrl) URL.revokeObjectURL(uploadUrl); }, [uploadUrl]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setUploadUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    setPicked(url);
  };

  const image = picked ?? uploadUrl ?? defaultPuzzleImage();

  return (
    <div className="grid gap-3">
      {photos.length > 0 && (
        <div className="grid gap-2">
          <p className="eyebrow px-1">{t("games.puzzle.fromMemories")}</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {photos.map((url) => (
              <button key={url} onClick={() => setPicked(url)} aria-label={t("games.puzzle.usePhoto")}
                className={`shrink-0 size-16 rounded-xl bg-cover bg-center border-2 transition ${picked === url ? "border-accent" : "border-transparent opacity-80"}`}
                style={{ backgroundImage: `url(${url})` }} />
            ))}
          </div>
        </div>
      )}
      <label className="btn justify-self-center cursor-pointer">
        <AppIcon name="image" size={16} /> {uploadUrl ? t("games.puzzle.changePhoto") : t("games.puzzle.choosePhoto")}
        <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
      </label>
      <PuzzleRound key={`${round}-${image}`} round={round} image={image} onLevelUp={advance} />
    </div>
  );
}

function PuzzleRound({ round, image, onLevelUp }: { round: number; image: string; onLevelUp: () => void }) {
  const t = useT();
  const { size } = useMemo(() => puzzleLevelFor(round), [round]);
  const [{ order: initOrder, blank: initBlank }] = useState(() => shufflePuzzle(size));
  const [order, setOrder] = useState(initOrder);
  const [blank, setBlank] = useState(initBlank);
  const [moves, setMoves] = useState(0);

  const done = useMemo(() => order.every((v, i) => v === i), [order]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(onLevelUp, 1700);
    return () => clearTimeout(timer);
  }, [done, onLevelUp]);

  const move = (slot: number) => {
    if (done || !puzzleNeighbors(blank, size).includes(slot)) return;
    haptic(6);
    const next = order.slice();
    [next[blank], next[slot]] = [next[slot], next[blank]];
    setOrder(next); setBlank(slot); setMoves((m) => m + 1);
  };

  return (
    <div className="grid gap-3">
      <div className="card p-3 flex items-center justify-center gap-4">
        <span className="eyebrow">{t("games.level", { n: round + 1 })}</span>
        <span className="text-sm text-muted">{t("games.puzzle.moves", { n: moves })}</span>
      </div>
      <div className="relative aspect-square rounded-3xl overflow-hidden border border-line select-none">
        <div className="absolute inset-0 grid gap-[2px] bg-line" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
          {order.map((tile, slot) => {
            const isBlank = tile === size * size - 1;
            const tx = tile % size, ty = Math.floor(tile / size);
            return (
              <button key={slot} disabled={isBlank} onClick={() => move(slot)}
                aria-label={isBlank ? t("games.puzzle.empty") : t("games.puzzle.tile")}
                className="relative bg-surface2"
                style={isBlank ? undefined : {
                  backgroundImage: `url(${image})`,
                  backgroundSize: `${size * 100}% ${size * 100}%`,
                  backgroundPosition: size > 1 ? `${(tx / (size - 1)) * 100}% ${(ty / (size - 1)) * 100}%` : "0 0",
                }} />
            );
          })}
        </div>
        {done && (
          <div className="absolute inset-0 grid place-items-center pop-in pointer-events-none" style={{ backgroundImage: `url(${image})`, backgroundSize: "cover" }}>
            <span className="rounded-full bg-black/40 backdrop-blur px-4 py-2 text-sm text-white">{t("games.puzzle.done")}</span>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted">{t("games.puzzle.hint")}</p>
    </div>
  );
}

/** Boards are freshly randomized per round with no SEO value; waiting for mount before drawing
 * one avoids a hydration mismatch between the server's and the browser's own Math.random() calls. */
export function GamePlayer({ id, photos }: { id: GameId; photos?: string[] }) {
  const mounted = useIsClient();
  if (!mounted) return <div className="h-[54dvh]" aria-hidden />;
  return {
    petals: <Petals />, bubbles: <Bubbles />, treasure: <TreasureDig />, light: <Light />,
    memory: <Memory />, zen: <Zen />, clouds: <Clouds />, stars: <Stars />, match3: <Match3 />, puzzle: <Puzzle photos={photos} />,
  }[id];
}
