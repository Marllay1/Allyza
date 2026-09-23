import { AppIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";

/** "Water today" progress: a single elegant bar, not a row of cartoon glasses. */
export function Hydration({ count, goal = 8, compact = false }: { count: number; goal?: number; compact?: boolean }) {
  const { t } = useI18n();
  const pct = Math.min(100, (count / goal) * 100);

  if (compact) {
    return (
      <div className="grid gap-1.5">
        <span className="h-2 rounded-full bg-surface2 overflow-hidden block">
          <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </span>
        <span className="font-display text-2xl leading-none tabular-nums">{count}<span className="text-sm text-muted"> / {goal}</span></span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="label !mb-0 inline-flex items-center gap-1.5"><AppIcon name="hydration" size={15} /> {t("home.hydration")}</span>
        <span className="font-display text-2xl tabular-nums">{count}<span className="text-sm text-muted"> / {goal}</span></span>
      </div>
      <span className="h-3 rounded-full bg-surface2 overflow-hidden block">
        <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
