"use client";
import { useState } from "react";
import { setLocalPref, useLocalPref } from "@/lib/local-pref";
import { useI18n } from "@/lib/i18n/provider";

const split = (s: string) => s.trim().split(/\s+/);

type GroupId = "recent" | "smileys" | "love" | "hands" | "nature" | "food" | "activities" | "symbols";
const GROUPS: { id: GroupId; icon: string; emojis: string[] }[] = [
  { id: "smileys", icon: "😊", emojis: split("😀 😃 😄 😁 😆 🥹 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🫣 🤗 🫡 🤔 🫢 🤭 🤫 🫠 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕") },
  { id: "love", icon: "❤️", emojis: split("❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💋 😻 🫶 🥰 😍 😘 💐 🌹 🌷 🌸 💮 🏵️ 🌺 🌻 🌼 ✨ 💫 ⭐ 🌟 🎀 🧸 🕯️ 💍 💎") },
  { id: "hands", icon: "👍", emojis: split("👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 🫵 ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✍️ 💅 🤳 💪 🫂 👏 🙌 🫶 👐 🤲 🙋 🙆 🙅 🤷 🤦 💁 🙇 🧘") },
  { id: "nature", icon: "🌙", emojis: split("🌙 ☀️ 🌤️ ⛅ 🌈 ☁️ 🌧️ ⛈️ ❄️ ☃️ ⚡ 🔥 💧 🌊 🌍 🌿 🍀 🍃 🌱 🌳 🌴 🌵 🍁 🍂 🍄 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦄 🐝 🦋 🐢 🐙 🐬 🐳") },
  { id: "food", icon: "🍓", emojis: split("🍎 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥕 🌽 🥐 🍞 🧀 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌮 🍝 🍜 🍣 🍱 🍦 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 ☕ 🍵 🥤 🧋 🍷 🥂 🍾") },
  { id: "activities", icon: "🎉", emojis: split("🎉 🎊 🎈 🎁 🏆 🥇 ⚽ 🏀 🎾 🏐 🎮 🎯 🎲 🧩 🎨 🎬 🎤 🎧 🎵 🎶 🎹 🎸 📷 📸 📚 ✏️ 💻 📱 ☎️ 💡 🔮 🛁 🛌 🚗 ✈️ 🚀 🏠 🏝️ ⛺ 🗺️ 🧳") },
  { id: "symbols", icon: "💯", emojis: split("💯 ✅ ❌ ❓ ❗ ‼️ ⚠️ 💤 💢 💥 💦 💨 🕐 ⏳ 🔔 🔕 📌 📍 🔒 🔑 ♾️ ➕ ➖ ✔️ 🆗 🆒 🔝 ➡️ ⬅️ ⬆️ ⬇️ 🔁 🔄 ⭕ 🔴 🟠 🟡 🟢 🔵 🟣") },
];

const RECENT_KEY = "allyza.emoji.recent";
const readRecent = (raw: string | null): string[] => { try { const v = JSON.parse(raw ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 24) : []; } catch { return []; } };

/** A compact emoji keyboard: recent first, then a few themed groups. Tapping inserts into the message being written. */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useI18n();
  const recent = readRecent(useLocalPref(RECENT_KEY, "[]"));
  const [tab, setTab] = useState<GroupId>(recent.length ? "recent" : "smileys");
  const groups: typeof GROUPS = recent.length ? [{ id: "recent", icon: "🕘", emojis: recent }, ...GROUPS] : GROUPS;
  const current = groups.find((g) => g.id === tab) ?? groups[0];

  const pick = (e: string) => {
    onPick(e);
    setLocalPref(RECENT_KEY, JSON.stringify([e, ...recent.filter((x) => x !== e)].slice(0, 24)));
  };

  return (
    <div className="grid gap-1.5" role="group" aria-label={t("messaging.emojis")}>
      <div className="flex gap-1 overflow-x-auto pb-0.5" role="tablist">
        {groups.map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={g.id === current.id} aria-label={t(`messaging.emojiGroup.${g.id}`)}
            onClick={() => setTab(g.id)}
            className={`shrink-0 size-9 rounded-full grid place-items-center text-lg transition ${g.id === current.id ? "bg-accent/20" : "hover:bg-surface2"}`}>{g.icon}</button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 max-h-40 overflow-y-auto overscroll-contain">
        {current.emojis.map((e) => (
          <button key={e} type="button" onClick={() => pick(e)} aria-label={e}
            className="aspect-square rounded-xl grid place-items-center text-[1.6rem] leading-none hover:bg-surface2 active:scale-90 transition">{e}</button>
        ))}
      </div>
    </div>
  );
}

/** A message made only of 1–3 emoji is shown large and bubble-less, like a sticker. */
export const isEmojiOnly = (s: string | null | undefined): boolean =>
  !!s && /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u.test(s.trim());
