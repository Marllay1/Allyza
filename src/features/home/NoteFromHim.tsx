"use client";
import { AppIcon, type IconName } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";

type Note = { id: string; category: string; title: string | null; body: string } | null;

const CAT_ICON: Record<string, IconName> = {
  note: "note", compliment: "compliment", poem: "poetry", letter: "mail", memory: "memoryKind",
  joke: "jokes", encouragement: "encouragement", open_when: "hidden", surprise: "surprise", daily: "sun",
};

/** "A little note from me": the latest thing he's actually published for her, or a warm placeholder. */
export function NoteFromHim({ note }: { note: Note }) {
  const { t } = useI18n();

  return (
    <section className="card p-5 rise" aria-labelledby="note-from-him-h">
      <p id="note-from-him-h" className="eyebrow inline-flex items-center gap-1.5">
        <AppIcon name={note ? CAT_ICON[note.category] ?? "note" : "note"} size={13} /> {t("home.noteFromHim.label")}
      </p>
      {note ? (
        <>
          {note.title && <p className="font-display text-lg mt-2">{note.title}</p>}
          <p className="font-display text-2xl leading-snug text-balance mt-2">{note.body}</p>
        </>
      ) : (
        <p className="text-muted mt-2">{t("home.noteFromHim.empty")}</p>
      )}
    </section>
  );
}
