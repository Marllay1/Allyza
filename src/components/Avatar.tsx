"use client";
import { useId } from "react";
import { useSignedUrls } from "@/lib/use-signed-urls";

/**
 * The default portrait, derived from the Allyza mark (crescent + the two intertwined forms) rather
 * than the raw logo: a small moon holding one figure, tinted per person so hers and his read apart at a glance.
 */
function DefaultAvatar({ size, tone }: { size: number; tone: "rose" | "gold" }) {
  const id = useId().replace(/:/g, "");
  const stops = tone === "rose" ? ["#f0c3c4", "#b9788a"] : ["#f6e7c8", "#c9959a"];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-hidden>
      <defs>
        <linearGradient id={`av${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={stops[0]} /><stop offset="1" stopColor={stops[1]} />
        </linearGradient>
        <radialGradient id={`bg${id}`} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#3b1f52" /><stop offset="1" stopColor="#160e33" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#bg${id})`} />
      <circle cx="26" cy="34" r="15" fill={`url(#av${id})`} opacity="0.28" />
      <circle cx="26" cy="34" r="15" fill="none" stroke={`url(#av${id})`} strokeWidth="4" strokeDasharray="70 100" transform="rotate(-35 26 34)" />
      <circle cx="35" cy="35" r="8" fill={`url(#av${id})`} />
      <path d="M35 39c-3-2.6-5.5-4.5-5.5-7.1a2.9 2.9 0 0 1 5.5-1.3 2.9 2.9 0 0 1 5.5 1.3c0 2.6-2.5 4.5-5.5 7.1z" fill="#fff" opacity="0.85" />
    </svg>
  );
}

export function Avatar({ path, tone, size = 40, className = "" }: { path: string | null; tone: "rose" | "gold"; size?: number; className?: string }) {
  const urls = useSignedUrls(path ? [path] : []);
  const src = path ? urls[path] : null;
  return (
    <span className={`inline-block shrink-0 rounded-full overflow-hidden ${className}`} style={{ width: size, height: size }}>
      {path ? (
        src ? (
          <img src={src} alt="" width={size} height={size} className="size-full object-cover" />
        ) : (
          <span className="size-full block bg-surface2 animate-pulse" />
        )
      ) : (
        <DefaultAvatar size={size} tone={tone} />
      )}
    </span>
  );
}
