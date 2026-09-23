import type { IconName } from "@/components/icons";

export const GAME_IDS = ["puzzle", "match3", "light", "bubbles", "petals", "memory", "zen", "stars", "clouds", "treasure"] as const;
export type GameId = (typeof GAME_IDS)[number];
export const GAME_ICON: Record<GameId, IconName> = {
  puzzle: "grid", match3: "shuffle", light: "light", bubbles: "bubbles", petals: "petals",
  memory: "memory", zen: "zen", stars: "stars", clouds: "clouds", treasure: "treasureDig",
};

export const GAME_CATEGORIES = [
  { id: "puzzle", games: ["puzzle"] },
  { id: "match", games: ["match3"] },
  { id: "logic", games: ["light", "bubbles", "petals"] },
  { id: "memory", games: ["memory"] },
  { id: "calm", games: ["zen"] },
  { id: "discovery", games: ["stars", "clouds", "treasure"] },
] as const satisfies { id: string; games: GameId[] }[];
