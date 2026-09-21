"use client";
import { useT } from "@/lib/i18n/provider";

/** Line chart of dated values. Accessible: has a text summary via <title>. */
export function LineChart({
  points,
  max,
  min = 0,
  color = "var(--accent)",
  label,
}: {
  points: { date: string; value: number }[];
  max: number;
  min?: number;
  color?: string;
  label: string;
}) {
  const t = useT();
  if (points.length < 2) return <p className="text-sm text-muted">{t("stats.notEnough")}</p>;
  const W = 320, H = 110, P = 8;
  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime() || t0 + 1;
  const x = (d: string) => P + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / (max - min)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = `${d} L${x(points[points.length - 1].date).toFixed(1)} ${H - P} L${x(points[0].date).toFixed(1)} ${H - P}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" role="img" aria-label={label}>
      <title>{label}</title>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="var(--line)" strokeDasharray="3 5" />
      ))}
      <path d={area} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="2.6" fill={color} />
      ))}
    </svg>
  );
}

/** Horizontal bars for cycle lengths / category counts. */
export function Bars({ rows, color = "var(--rose)", unit = "" }: { rows: { label: string; value: number }[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6.5rem_1fr_2.8rem] items-center gap-3 text-sm">
          <span className="text-muted truncate">{r.label}</span>
          <span className="h-2.5 rounded-full bg-surface2 overflow-hidden">
            <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </span>
          <span className="tabular-nums text-right">{r.value}{unit}</span>
        </li>
      ))}
    </ul>
  );
}
