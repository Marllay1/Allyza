/** The fixed set of original Allyza sticker ids — shared between the server (validating a send)
 * and the client (rendering the artwork). Kept separate from the SVG component so server code
 * can import just the ids without pulling in client-only rendering. */
export const STICKER_IDS = [
  "love", "morning", "night", "thinking", "comeHere", "missYou", "proud", "rest",
  "water", "listening", "sorry", "thanks", "teasing", "cute", "waiting", "hug",
  "kiss", "moodGood", "surprise", "celebrate",
] as const;
export type StickerId = (typeof STICKER_IDS)[number];

/**
 * A sticker used as a reaction is stored in the reactions table as "s:<position in STICKER_IDS>" (4 characters, so it
 * fits the existing 8-character emoji column). STICKER_IDS is append-only: never reorder or remove an id.
 */
export const stickerReactionCode = (id: StickerId) => `s:${STICKER_IDS.indexOf(id)}`;
export function stickerFromReaction(code: string): StickerId | null {
  const m = /^s:(\d{1,2})$/.exec(code);
  return m ? STICKER_IDS[Number(m[1])] ?? null : null;
}

export function isStickerId(v: string): v is StickerId {
  return (STICKER_IDS as readonly string[]).includes(v);
}
