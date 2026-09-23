export const SYMPTOMS = [
  "cramps", "headache", "bloating", "back_pain", "breast_tenderness", "nausea",
  "acne", "cravings", "insomnia", "dizziness", "irritability", "low_energy",
] as const;
export const FOOD_CATEGORIES = [
  "fruit", "vegetables", "protein", "legumes", "whole_grains", "water", "sweet_foods", "sugary_drinks", "other",
] as const;
export const PAIN_TYPES = ["abdominal", "premenstrual", "menstrual", "ovulation", "post_period", "other"] as const;
export const MEDIA_CATEGORIES = ["moments", "outings", "memories", "little", "surprises"] as const;
export const LITTLE_KINDS = ["compliment", "note", "question", "date_idea", "challenge", "hidden"] as const;
export const REACTION_EMOJIS = ["❤️", "🥰", "😂", "✨", "🫶"] as const;

export type Sharing = {
  share_cycle_day: boolean;
  share_period_status: boolean;
  share_pain: boolean;
  share_mood: boolean;
  share_fatigue: boolean;
  share_wellbeing: boolean;
  share_food: boolean;
  share_stats: boolean;
};
export const SURPRISE_KINDS = ["love", "encouragement", "funny", "memory", "compliment", "surprise"] as const;
export const SURPRISE_UNLOCKS = ["anytime", "miss_me", "hard_day", "need_smile", "tonight", "tomorrow", "date"] as const;
export const STORY_EMOTIONS = ["love", "joy", "laugh", "tender", "nostalgia", "wonder"] as const;
export const JOKE_KINDS = ["joke", "nickname", "phrase", "quote", "moment"] as const;
export const CHECKIN_STATES = ["good", "ok", "tired", "bad", "calm", "love", "idk"] as const;
export const CUSTOM_CONTENT_CATEGORIES = [
  "note", "compliment", "poem", "letter", "memory", "joke", "encouragement", "open_when", "surprise", "daily",
] as const;
export const MOOD_TAGS = ["calm", "happy", "tired", "sad", "irritated", "anxious", "sensitive", "neutral"] as const;

export const SHARING_KEYS = [
  "share_cycle_day", "share_period_status", "share_pain", "share_mood",
  "share_fatigue", "share_wellbeing", "share_food", "share_stats",
] as const satisfies readonly (keyof Sharing)[];
