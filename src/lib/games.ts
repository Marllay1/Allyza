export const GAME_IDS = ["petals", "bubbles", "memory", "zen", "clouds", "stars", "glow"] as const;
export type GameId = (typeof GAME_IDS)[number];
export const GAME_ICON: Record<GameId, string> = { petals: "🌸", bubbles: "🫧", memory: "🃏", zen: "🪨", clouds: "☁️", stars: "✨", glow: "🖌️" };
