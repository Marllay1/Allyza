/**
 * Shown the instant a link is tapped, while the next page is prepared on the server.
 * The navbar and header stay in place, so navigation feels immediate.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-4 animate-pulse" role="status">
      <span className="sr-only">…</span>
      <div className="h-11 w-2/3 rounded-2xl bg-surface2" />
      <div className="h-4 w-1/2 rounded-full bg-surface2/70" />
      <div className="card h-28" />
      <div className="card h-20" />
      <div className="card h-20" />
    </div>
  );
}
