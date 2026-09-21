import { AppIcon } from "@/components/icons";

/** A small, pure-CSS gift box. When `open`, the lid lifts away and hearts float up. Decorative only. */
export function GiftBox({ open = false, size = 132 }: { open?: boolean; size?: number }) {
  return (
    <div aria-hidden className="relative" style={{ width: size, height: size * 0.95 }}>
      {open && (
        <div className="absolute inset-0 grid place-items-center" style={{ animation: "glow-up 0.9s var(--ease) both" }}>
          <span className="size-3/4 rounded-full" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--gold) 55%, transparent), transparent 70%)" }} />
        </div>
      )}
      {open && [0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="absolute text-rose" style={{ left: `${18 + i * 16}%`, top: "28%", animation: `heart-float 1.6s var(--ease) ${0.25 + i * 0.16}s both` }}>
          <AppIcon name="us" size={16 + (i % 2) * 6} className="fill-current" />
        </span>
      ))}
      {/* body */}
      <div className="absolute bottom-0 inset-x-[8%] h-[58%] rounded-2xl border border-[var(--glass-line)]" style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--rose) 70%, var(--surface)), color-mix(in srgb, var(--mauve) 75%, var(--surface)))" }}>
        <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[16%]" style={{ background: "linear-gradient(180deg, var(--gold), color-mix(in srgb, var(--gold) 70%, var(--rose)))" }} />
      </div>
      {/* lid */}
      <div className="absolute inset-x-[2%] top-[22%] h-[26%] rounded-2xl border border-[var(--glass-line)]" style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--rose) 82%, var(--surface)), color-mix(in srgb, var(--mauve) 85%, var(--surface)))", animation: open ? "lid-open 1s var(--ease) 0.15s both" : undefined, transformOrigin: "20% 100%" }}>
        <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[16%]" style={{ background: "var(--gold)" }} />
        <span className="absolute left-1/2 -top-[42%] -translate-x-1/2 text-[var(--gold)]"><AppIcon name="sparkles" size={size * 0.2} /></span>
      </div>
    </div>
  );
}
