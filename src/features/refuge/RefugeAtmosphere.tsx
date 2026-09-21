/**
 * The Refuge is another room: a low moon glow and a handful of slow, warm particles.
 * Pure CSS (compositor-friendly transforms/opacity), decorative only, hidden with reduced motion.
 */
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 11) % 96}%`,
  s: 2 + ((i * 5) % 4),
  t: 16 + ((i * 7) % 14),
  w: -((i * 3) % 18),
  x: ((i % 2 ? 1 : -1) * (14 + ((i * 11) % 40))),
}));

export function RefugeAtmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <span className="moon-glow" style={{ width: 340, height: 340, right: -90, top: -70 }} />
      <span className="moon-glow" style={{ width: 220, height: 220, left: -80, bottom: "18%", opacity: 0.6 }} />
      <div className="particles">
        {PARTICLES.map((p, i) => (
          <span key={i} style={{ left: p.left, ["--s" as string]: `${p.s}px`, ["--t" as string]: `${p.t}s`, ["--w" as string]: `${p.w}s`, ["--x" as string]: `${p.x}px` }} />
        ))}
      </div>
    </div>
  );
}
