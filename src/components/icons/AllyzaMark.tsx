/**
 * The official Allyza logo (from assets/logo-source.jpg), pre-rendered at a few exact heights by
 * scripts/make-brand.mjs so the browser never has to shrink a huge image (that is what makes small logos look soft
 * and what makes first load heavy). Two colourways, chosen by CSS to suit the theme:
 *  - dark: the artwork exactly as designed (peach/pink/violet on night)
 *  - light: same shapes recoloured plum → rose for ivory backgrounds
 * Both are tiny (16-105 KB) and eager, so the logo is there immediately instead of popping in half-drawn.
 */
type Variant = "mark" | "lockup";
const RATIO: Record<Variant, number> = { mark: 400 / 440, lockup: 730 / 705 };
const SIZES: Record<Variant, number[]> = { mark: [96, 144, 288], lockup: [240, 360, 560] };

const pick = (variant: Variant, need: number) => SIZES[variant].find((h) => h >= need) ?? SIZES[variant].at(-1)!;

function srcSet(variant: Variant, mode: "light" | "dark", height: number) {
  return [1, 2, 3].map((d) => `/brand/${variant}-${mode}-${pick(variant, height * d)}.png ${d}x`).join(", ");
}

export function AllyzaMark({ height = 40, variant = "mark", className = "" }: { height?: number; variant?: Variant; priority?: boolean; className?: string }) {
  const width = Math.round(height * RATIO[variant]);
  const common = { width, height, alt: "", decoding: "async" as const, loading: "eager" as const, draggable: false };
  return (
    <span className={`inline-block shrink-0 ${className}`} style={{ width, height }} role="img" aria-label="Allyza">
      <img {...common} src={`/brand/${variant}-light-${pick(variant, height)}.png`} srcSet={srcSet(variant, "light", height)} className="logo-light" />
      <img {...common} src={`/brand/${variant}-dark-${pick(variant, height)}.png`} srcSet={srcSet(variant, "dark", height)} className="logo-dark" />
    </span>
  );
}

export function AllyzaLogo({ height = 220 }: { height?: number; priority?: boolean }) {
  return <AllyzaMark variant="lockup" height={height} />;
}
