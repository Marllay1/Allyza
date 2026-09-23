"use client";
import { useId } from "react";
import { type StickerId } from "@/lib/stickers";

/**
 * Allyza's own sticker pack: one recurring little moon character (the same motif as the default
 * avatar — crescent, warmth, a soft heart) drawn in different moods. Original artwork, not emoji,
 * not a copied pack — every sticker shares one face so the set reads as one coherent voice.
 */

type Eyes = "dot" | "closed" | "wink" | "heart" | "sparkle" | "happy" | "wide";
type Mouth = "smile" | "open" | "kiss" | "o" | "content" | "grin";
type Tint = "rose" | "gold" | "mauve";

const TINTS: Record<Tint, [string, string]> = {
  rose: ["#fff3e6", "#f0b8a4"],
  gold: ["#fff7e0", "#e9c07a"],
  mauve: ["#f3e6ff", "#c79fe0"],
};

function Face({ gid, eyes, mouth, tint = "rose", blush = true }: { gid: string; eyes: Eyes; mouth: Mouth; tint?: Tint; blush?: boolean }) {
  const [c0, c1] = TINTS[tint];
  return (
    <>
      <defs>
        <radialGradient id={`face-${gid}`} cx="38%" cy="32%" r="80%"><stop offset="0" stopColor={c0} /><stop offset="1" stopColor={c1} /></radialGradient>
      </defs>
      <circle cx="32" cy="34" r="22" fill={`url(#face-${gid})`} />
      {eyes === "dot" && <><circle cx="25" cy="33" r="2.4" fill="#3a2440" /><circle cx="39" cy="33" r="2.4" fill="#3a2440" /></>}
      {eyes === "wide" && <><circle cx="25" cy="33" r="3" fill="#3a2440" /><circle cx="39" cy="33" r="3" fill="#3a2440" /><circle cx="26" cy="32" r="1" fill="#fff" /><circle cx="40" cy="32" r="1" fill="#fff" /></>}
      {eyes === "closed" && <><path d="M21 33q4-3 8 0" stroke="#3a2440" strokeWidth="1.8" strokeLinecap="round" fill="none" /><path d="M35 33q4-3 8 0" stroke="#3a2440" strokeWidth="1.8" strokeLinecap="round" fill="none" /></>}
      {eyes === "wink" && <><path d="M21 33q4-3 8 0" stroke="#3a2440" strokeWidth="1.8" strokeLinecap="round" fill="none" /><circle cx="39" cy="33" r="2.4" fill="#3a2440" /></>}
      {eyes === "happy" && <><path d="M21 34q4-4 8 0" stroke="#3a2440" strokeWidth="1.8" strokeLinecap="round" fill="none" /><path d="M35 34q4-4 8 0" stroke="#3a2440" strokeWidth="1.8" strokeLinecap="round" fill="none" /></>}
      {eyes === "sparkle" && <><circle cx="25" cy="33" r="2.4" fill="#3a2440" /><circle cx="39" cy="33" r="2.4" fill="#3a2440" /><path d="M15 24l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="var(--gold)" /><path d="M46 22l0.8 2.4 2.4 0.8-2.4 0.8-0.8 2.4-0.8-2.4-2.4-0.8 2.4-0.8z" fill="var(--gold)" /></>}
      {eyes === "heart" && <>
        <path d="M25 32c-1.6-1.4-3-2.4-3-3.9a1.6 1.6 0 0 1 3-0.7 1.6 1.6 0 0 1 3 0.7c0 1.5-1.4 2.5-3 3.9z" fill="#e36b8a" />
        <path d="M39 32c-1.6-1.4-3-2.4-3-3.9a1.6 1.6 0 0 1 3-0.7 1.6 1.6 0 0 1 3 0.7c0 1.5-1.4 2.5-3 3.9z" fill="#e36b8a" />
      </>}
      {mouth === "smile" && <path d="M26.5 41q5.5 4 11 0" stroke="#3a2440" strokeWidth="1.6" strokeLinecap="round" fill="none" />}
      {mouth === "content" && <path d="M27 41q5 2.4 10 0" stroke="#3a2440" strokeWidth="1.6" strokeLinecap="round" fill="none" />}
      {mouth === "grin" && <path d="M25 40q7 6 14 0" stroke="#3a2440" strokeWidth="1.6" strokeLinecap="round" fill="#fff" />}
      {mouth === "open" && <ellipse cx="32" cy="41.5" rx="3.4" ry="2.6" fill="#3a2440" />}
      {mouth === "o" && <circle cx="32" cy="41" r="2" fill="#3a2440" />}
      {mouth === "kiss" && <ellipse cx="32" cy="41" rx="2.6" ry="2" fill="#e36b8a" />}
      {blush && <><circle cx="19" cy="40" r="3" fill="#e58aa2" opacity="0.45" /><circle cx="45" cy="40" r="3" fill="#e58aa2" opacity="0.45" /></>}
    </>
  );
}

function Base({ children }: { children: React.ReactNode }) {
  return <svg viewBox="0 0 64 64" role="img" aria-hidden className="size-full">{children}</svg>;
}

const HEART = (x: number, y: number, s: number, fill: string, opacity = 1) => (
  <path key={`${x}-${y}`} opacity={opacity} fill={fill}
    d={`M${x} ${y + 3.4 * s}c-${3 * s} -${2.6 * s} -${5.5 * s} -${4.5 * s} -${5.5 * s} -${7.1 * s}a${2.9 * s} ${2.9 * s} 0 0 1 ${5.5 * s} -${1.3 * s} ${2.9 * s} ${2.9 * s} 0 0 1 ${5.5 * s} ${1.3 * s}c0 ${2.6 * s} -${2.5 * s} ${4.5 * s} -${5.5 * s} ${7.1 * s}z`} />
);

/** One sticker's expression + any small props drawn around the face. */
function Art({ id, gid }: { id: StickerId; gid: string }) {
  switch (id) {
    case "love": return <Base><Face gid={gid} eyes="heart" mouth="content" tint="rose" />{HEART(32, 12, 1.1, "#e36b8a")}</Base>;
    case "morning": return <Base>
      <path d="M6 20 L58 20" stroke="var(--gold)" strokeWidth="0" />
      {Array.from({ length: 7 }, (_, i) => <line key={i} x1={32} y1={6} x2={32} y2={11} stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" transform={`rotate(${i * 51.4} 32 34)`} />)}
      <Face gid={gid} eyes="happy" mouth="smile" tint="gold" />
    </Base>;
    case "night": return <Base>
      <path d="M14 12a9 9 0 1 0 9 12 7 7 0 0 1-9-12z" fill="var(--gold)" opacity="0.8" />
      <text x="46" y="16" fontSize="7" fill="var(--muted)" fontFamily="system-ui">z</text>
      <text x="51" y="10" fontSize="5" fill="var(--muted)" fontFamily="system-ui">z</text>
      <Face gid={gid} eyes="closed" mouth="content" tint="mauve" />
    </Base>;
    case "thinking": return <Base>
      {[0, 1, 2].map((i) => <circle key={i} cx={46 + i * 4} cy={16 - i * 4} r={2 - i * 0.4} fill="var(--line)" />)}
      {HEART(46, 24, 0.7, "#e36b8a", 0.85)}
      <Face gid={gid} eyes="dot" mouth="content" tint="mauve" />
    </Base>;
    case "comeHere": return <Base>
      <path d="M48 18c4 2 4 8 0 10" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M46 22c2.4 1 2.4 4 0 5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <Face gid={gid} eyes="happy" mouth="grin" tint="rose" />
    </Base>;
    case "missYou": return <Base>
      {HEART(46, 14, 0.9, "#e36b8a", 0.9)}
      {HEART(52, 24, 0.55, "#e36b8a", 0.6)}
      <Face gid={gid} eyes="closed" mouth="content" tint="mauve" />
    </Base>;
    case "proud": return <Base>
      <path d="M24 10l3 5 5.5-3-2 6h3l-2-6 5.5 3 3-5-5 2 1-6-4 4-4-4 1 6z" fill="var(--gold)" opacity="0.9" transform="translate(0 -2) scale(0.7) translate(14 6)" />
      <Face gid={gid} eyes="happy" mouth="grin" tint="gold" />
    </Base>;
    case "rest": return <Base>
      <rect x="10" y="46" width="44" height="6" rx="3" fill="var(--rose)" opacity="0.5" />
      <text x="44" y="18" fontSize="7" fill="var(--muted)" fontFamily="system-ui">z</text>
      <Face gid={gid} eyes="closed" mouth="content" tint="rose" />
    </Base>;
    case "water": return <Base>
      <path d="M46 12c4 5 5 8 5 10.5a5 5 0 0 1-10 0c0-2.5 1-5.5 5-10.5z" fill="var(--accent)" opacity="0.7" />
      <Face gid={gid} eyes="dot" mouth="smile" tint="mauve" />
    </Base>;
    case "listening": return <Base>
      <path d="M46 16a6 6 0 0 1 6 6v3a6 6 0 0 1-6 6" stroke="var(--muted)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="46" cy="16" r="2" fill="var(--muted)" />
      <Face gid={gid} eyes="wide" mouth="content" tint="mauve" />
    </Base>;
    case "sorry": return <Base>
      <path d="M22 44c0 3-2 5-2 5s-2-2-2-5a2 2 0 0 1 4 0z" fill="var(--accent)" opacity="0.7" />
      <Face gid={gid} eyes="closed" mouth="o" tint="mauve" />
    </Base>;
    case "thanks": return <Base>
      {HEART(32, 12, 0.9, "var(--gold)")}
      <Face gid={gid} eyes="happy" mouth="smile" tint="gold" />
    </Base>;
    case "teasing": return <Base><Face gid={gid} eyes="wink" mouth="grin" tint="rose" /></Base>;
    case "cute": return <Base>
      <path d="M14 12a9 9 0 1 0 9 12 7 7 0 0 1-9-12z" fill="var(--gold)" opacity="0" />
      {HEART(50, 46, 0.6, "#e36b8a", 0.7)}
      <Face gid={gid} eyes="sparkle" mouth="smile" tint="rose" />
    </Base>;
    case "waiting": return <Base>
      <circle cx="46" cy="16" r="7" fill="none" stroke="var(--muted)" strokeWidth="1.6" />
      <line x1="46" y1="16" x2="46" y2="12" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="46" y1="16" x2="49" y2="17" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" />
      <Face gid={gid} eyes="dot" mouth="content" tint="mauve" />
    </Base>;
    case "hug": return <Base>
      <path d="M8 40c6-6 12-6 16 0" stroke="var(--rose)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M40 40c4-6 10-6 16 0" stroke="var(--rose)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <Face gid={gid} eyes="happy" mouth="grin" tint="rose" />
    </Base>;
    case "kiss": return <Base>{HEART(46, 40, 0.6, "#e36b8a", 0.8)}<Face gid={gid} eyes="closed" mouth="kiss" tint="rose" /></Base>;
    case "moodGood": return <Base><Face gid={gid} eyes="happy" mouth="smile" tint="gold" /></Base>;
    case "surprise": return <Base>
      <rect x="24" y="42" width="16" height="12" rx="2" fill="var(--gold)" opacity="0.85" />
      <rect x="24" y="42" width="16" height="3" fill="var(--rose)" />
      <rect x="30.5" y="42" width="3" height="12" fill="var(--rose)" />
      <Face gid={gid} eyes="wide" mouth="open" tint="gold" />
    </Base>;
    case "celebrate": return <Base>
      {[[10, 12, "var(--gold)"], [52, 16, "#e36b8a"], [14, 46, "var(--accent)"], [50, 44, "var(--gold)"]].map(([x, y, f], i) => (
        <rect key={i} x={x as number} y={y as number} width="3" height="3" fill={f as string} transform={`rotate(${i * 37} ${x} ${y})`} />
      ))}
      <Face gid={gid} eyes="happy" mouth="grin" tint="rose" />
    </Base>;
    default: return <Base><Face gid={gid} eyes="dot" mouth="smile" tint="rose" /></Base>;
  }
}

export function Sticker({ id, size = 72 }: { id: StickerId; size?: number }) {
  const gid = useId().replace(/:/g, "");
  return (
    <span className="inline-block" style={{ width: size, height: size }}>
      <Art id={id} gid={gid} />
    </span>
  );
}

