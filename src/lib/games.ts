import type { IconName } from "@/components/icons";

export const GAME_IDS = ["petals", "bubbles", "memory", "zen", "clouds", "stars", "glow"] as const;
export type GameId = (typeof GAME_IDS)[number];
export const GAME_ICON: Record<GameId, IconName> = { petals: "petals", bubbles: "bubbles", memory: "memory", zen: "zen", clouds: "clouds", stars: "stars", glow: "glow" };
