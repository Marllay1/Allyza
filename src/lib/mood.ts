import type { IconName } from "@/components/icons";
import { MOOD_TAGS } from "@/lib/constants";

export type MoodTag = (typeof MOOD_TAGS)[number];

export const MOOD_TAG_ICON: Record<MoodTag, IconName> = {
  calm: "calm", happy: "mood5", tired: "tired", sad: "mood1",
  irritated: "mood2", anxious: "alert", sensitive: "tender", neutral: "mood3",
};

/** 1 (very bad) .. 5 (very good) — kept only so existing numeric trends/history stay meaningful. */
export const MOOD_TAG_INTENSITY: Record<MoodTag, number> = {
  happy: 5, calm: 4, neutral: 3, tired: 3, sensitive: 3, sad: 2, irritated: 2, anxious: 2,
};
