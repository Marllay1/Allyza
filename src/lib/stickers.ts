/** The fixed set of original Allyza sticker ids — shared between the server (validating a send)
 * and the client (rendering the artwork). Kept separate from the SVG component so server code
 * can import just the ids without pulling in client-only rendering. */
export const STICKER_IDS = [
  "love", "morning", "night", "thinking", "comeHere", "missYou", "proud", "rest",
  "water", "listening", "sorry", "thanks", "teasing", "cute", "waiting", "hug",
  "kiss", "moodGood", "surprise", "celebrate",
] as const;
export type StickerId = (typeof STICKER_IDS)[number];

export function isStickerId(v: string): v is StickerId {
  return (STICKER_IDS as readonly string[]).includes(v);
}
