"use client";
import { AppIcon, type IconName } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";
import { useLocalPref, setLocalPref } from "@/lib/local-pref";
import { useDayNumber } from "@/lib/use-day-index";

const CATS = [
  "littleNotes", "compliments", "romanticThoughts", "poems", "tinyReminders", "teasing",
  "thingsINotice", "justBecause", "iThoughtOfYou", "thingsILove", "memories",
  "forWhenYouMissMe", "forWhenYouNeedASmile", "forADifficultDay",
] as const;
type Cat = (typeof CATS)[number];
const CAT_ICON: Record<Cat, IconName> = {
  littleNotes: "note", compliments: "compliment", romanticThoughts: "love", poems: "poetry",
  tinyReminders: "sparkle", teasing: "laugh", thingsINotice: "eye", justBecause: "sparkles",
  iThoughtOfYou: "moon", thingsILove: "us", memories: "memoryKind",
  forWhenYouMissMe: "miss_me", forWhenYouNeedASmile: "need_smile", forADifficultDay: "hard_day",
};

const BUMP_KEY = "allyza.library.bump";

/** "Always something to read": a warm line from Allyza's own library, picked deterministically
 * per day (so it doesn't repeat on every reload) with a quiet way to see another. */
export function LittleSomething({ only }: { only?: Cat[] }) {
  const { t } = useI18n();
  const day = useDayNumber();
  const bump = Number(useLocalPref(BUMP_KEY, "0")) || 0;
  const cats = only ?? CATS;
  const pool = cats.flatMap((cat) => t.arr(`home.library.${cat}`).map((text) => ({ cat, text })));
  if (!pool.length) return null;
  const item = pool[(day + bump) % pool.length];

  return (
    <section className="card p-5 rise" aria-labelledby="little-something-h">
      <div className="flex items-center justify-between mb-2.5">
        <p id="little-something-h" className="eyebrow inline-flex items-center gap-1.5">
          <AppIcon name={CAT_ICON[item.cat]} size={13} /> {t(`home.library.labels.${item.cat}`)}
        </p>
        <button type="button" className="icon-btn !size-8" aria-label={t("home.library.another")}
          onClick={() => setLocalPref(BUMP_KEY, String(bump + 1))}>
          <AppIcon name="rotate" size={14} />
        </button>
      </div>
      <p className="font-display text-2xl leading-snug text-balance">{item.text}</p>
    </section>
  );
}
