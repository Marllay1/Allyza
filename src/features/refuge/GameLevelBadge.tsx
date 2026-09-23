"use client";
import { useGameLevel } from "@/lib/local-pref";
import { useI18n } from "@/lib/i18n/provider";

/** Device-local progress shown on a game's tile — "where you left off", never a score to chase. */
export function GameLevelBadge({ gameId }: { gameId: string }) {
  const { t } = useI18n();
  const [level] = useGameLevel(gameId);
  if (level <= 0) return null;
  return <span className="eyebrow shrink-0">{t("games.level", { n: level + 1 })}</span>;
}
