/* eslint-disable @next/next/no-img-element */
/**
 * The official Allyza logo (from assets/logo-source.jpg).
 * Two pre-rendered variants; CSS shows the one that suits the active theme:
 *  - dark: the artwork exactly as designed (peach/pink/violet on night)
 *  - light: same shapes recoloured in plum → rose for ivory backgrounds
 */
type Variant = "mark" | "lockup";
const RATIO: Record<Variant, number> = { mark: 400 / 440, lockup: 730 / 705 };

export function AllyzaMark({ height = 40, variant = "mark", priority = false, className = "" }: { height?: number; variant?: Variant; priority?: boolean; className?: string }) {
  const width = Math.round(height * RATIO[variant]);
  const common = { width, height, alt: "", decoding: "async" as const, loading: priority ? ("eager" as const) : ("lazy" as const), draggable: false };
  return (
    <span className={`inline-block shrink-0 ${className}`} style={{ width, height }} role="img" aria-label="Allyza">
      <img {...common} src={`/brand/${variant}-light.png`} className="logo-light" />
      <img {...common} src={`/brand/${variant}-dark.png`} className="logo-dark" />
    </span>
  );
}

export function AllyzaLogo({ height = 220, priority = true }: { height?: number; priority?: boolean }) {
  return <AllyzaMark variant="lockup" height={height} priority={priority} />;
}
