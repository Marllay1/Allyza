"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSurpriseAction, deleteSurpriseAction, openSurpriseAction } from "@/actions/world";
import { AppIcon } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { Portal } from "@/components/Portal";
import { useUnread } from "@/components/AppShell";
import { GiftBox } from "@/features/couple/surprises/GiftBox";
import { SURPRISE_KINDS, SURPRISE_UNLOCKS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { isAcceptedImage, prepareImage } from "@/lib/image";
import { haptic } from "@/lib/local-pref";
import { useSignedUrls } from "@/lib/use-signed-urls";
import { toISODate } from "@/lib/cycle";
import type { ErrCode } from "@/lib/action-utils";

type Kind = (typeof SURPRISE_KINDS)[number];
type Unlock = (typeof SURPRISE_UNLOCKS)[number];
export type Received = { id: string; kind: Kind; unlock: Unlock; unlock_at: string | null; created_at: string; opened_at: string | null; locked: boolean; title: string | null; body: string | null; storage_path: string | null };
export type Sent = { id: string; kind: Kind; unlock: Unlock; unlock_at: string | null; created_at: string; opened_at: string | null; title: string; body: string | null; storage_path: string | null };
type SentPreview = { kind: Kind; unlock: Unlock; unlock_at: string | null; title: string; body: string; storage_path: string | null; justSent: boolean };
type Revealed = { title: string; body: string; storage_path: string | null; kind: string };

const local = (y: number, m: number, d: number, h: number) => new Date(y, m, d, h, 0, 0, 0);

function unlockAtFor(unlock: Unlock, date: string): string | undefined {
  const now = new Date();
  if (unlock === "tonight") { const t = local(now.getFullYear(), now.getMonth(), now.getDate(), 21); return (t < now ? now : t).toISOString(); }
  if (unlock === "tomorrow") return local(now.getFullYear(), now.getMonth(), now.getDate() + 1, 7).toISOString();
  if (unlock === "date" && date) { const [y, m, d] = date.split("-").map(Number); return local(y, m - 1, d, 0).toISOString(); }
  return undefined;
}

export function SurprisesClient({ coupleId, received, sent, otherName, canSend }: { coupleId: string; received: Received[]; sent: Sent[]; otherName: string; canSend: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { markRead } = useUnread();
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrCode | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [compose, setCompose] = useState(false);
  const [preview, setPreview] = useState<SentPreview | null>(null);

  // compose state
  const [kind, setKind] = useState<Kind>("love");
  const [unlock, setUnlock] = useState<Unlock>("anytime");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => markRead(["surprise"]), [markRead]);

  // The recipient does not receive table events (RLS: author only), so a new surprise arrives via its notification.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`surprise-n:${coupleId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [coupleId, router]);

  const unopened = useMemo(() => received.filter((s) => !s.opened_at), [received]);
  const ready = unopened.filter((s) => !s.locked);
  const opened = received.filter((s) => s.opened_at);
  const urls = useSignedUrls([revealed?.storage_path, preview?.storage_path, ...opened.map((o) => o.storage_path)].filter(Boolean) as string[]);
  const today = toISODate();

  const open = (s: Received) => {
    if (s.locked || opening) return;
    setError(null);
    setOpening(s.id);
    haptic([14, 40, 22]);
    const minShow = new Promise((r) => setTimeout(r, 1500)); // let the little animation breathe
    start(async () => {
      const [r] = await Promise.all([openSurpriseAction(s.id), minShow]);
      setOpening(null);
      if (r.ok) setRevealed(r.data as Revealed);
      else setError(r.error);
    });
  };

  const send = () =>
    start(async () => {
      setError(null);
      let path: string | undefined;
      if (file) {
        try {
          const img = await prepareImage(file);
          path = `${coupleId}/${crypto.randomUUID()}.${img.ext}`;
          const up = await createClient().storage.from("couple-media").upload(path, img.blob, { contentType: img.type });
          if (up.error) throw up.error;
        } catch { setError("generic"); return; }
      }
      const at = unlockAtFor(unlock, date);
      const r = await createSurpriseAction({ kind, title, body, unlock, unlockAt: at, path });
      if (!r.ok) { setError(r.error); return; }
      setPreview({ kind, unlock, unlock_at: at ?? null, title: title.trim(), body: body.trim(), storage_path: path ?? null, justSent: true });
      setTitle(""); setBody(""); setFile(null); setDate(""); setUnlock("anytime"); setCompose(false);
      router.refresh();
    });

  const when = (s: { unlock: Unlock; unlock_at: string | null }) =>
    s.unlock_at && new Date(s.unlock_at) > new Date()
      ? t("surprises.availableOn", { when: formatDateTime(s.unlock_at, locale) })
      : t(`surprises.unlock.${s.unlock}`);

  return (
    <div className="grid gap-6">
      {/* what is waiting */}
      <section className="card p-6 text-center grid justify-items-center gap-3">
        <GiftBox size={112} />
        {received.length === 0 ? (
          <><h2 className="text-2xl">{t("surprises.emptyTitle")}</h2><p className="text-muted text-balance max-w-xs">{t("surprises.emptyBody")}</p></>
        ) : ready.length > 0 ? (
          <h2 className="text-2xl text-balance">{t("surprises.waiting", { n: ready.length })}</h2>
        ) : (
          <h2 className="text-2xl text-balance">{unopened.length ? t("surprises.comingSoon", { n: unopened.length }) : t("surprises.allOpened")}</h2>
        )}
      </section>

      <ErrorNote code={error} />

      {unopened.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {unopened.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => open(s)}
                disabled={s.locked || pending}
                className="card w-full p-4 grid justify-items-center gap-2 text-center transition duration-300 enabled:hover:-translate-y-1 enabled:active:scale-[0.97] disabled:opacity-70"
                aria-label={s.locked ? `${t("surprises.locked")} · ${when(s)}` : t("surprises.open")}
              >
                <span className="grid place-items-center size-14 rounded-2xl bg-accent/15 text-accent"><AppIcon name={s.locked ? "lock" : "surprise"} size={26} /></span>
                <span className="font-display text-lg leading-tight">{t("surprises.someoneLeft", { name: otherName })}</span>
                <span className="text-xs text-muted inline-flex items-center gap-1"><AppIcon name={s.locked ? "clock" : s.unlock} size={12} /> {when(s)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {opened.length > 0 && (
        <section>
          <h2 className="text-2xl mb-3">{t("surprises.opened")}</h2>
          <ul className="grid gap-3">
            {opened.map((s) => (
              <li key={s.id} className="card p-5">
                <div className="flex items-center gap-2 text-xs text-muted mb-2"><AppIcon name={s.kind === "memory" ? "memoryKind" : s.kind} size={14} /> {t(`surprises.kinds.${s.kind}`)} · {formatDateTime(s.created_at, locale)}</div>
                {s.title && <h3 className="text-xl mb-1">{s.title}</h3>}
                <p className="whitespace-pre-wrap break-words">{s.body}</p>
                {s.storage_path && urls[s.storage_path] && <img src={urls[s.storage_path]} alt={s.title ?? ""} className="mt-3 rounded-2xl w-full max-h-80 object-cover" />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* compose / leave something */}
      {canSend && (
        <section className="card p-5 grid gap-4">
          <button className="flex items-center justify-between gap-3 text-left" onClick={() => setCompose((c) => !c)} aria-expanded={compose}>
            <span><span className="block font-display text-2xl">{t("surprises.leaveTitle", { name: otherName })}</span><span className="text-sm text-muted">{t("surprises.leaveSub")}</span></span>
            <AppIcon name="down" size={22} className={`transition-transform duration-500 ${compose ? "rotate-180" : ""}`} />
          </button>
          {compose && (
            <div className="grid gap-4 page-enter">
              <div>
                <span className="label">{t("surprises.kind")}</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("surprises.kind")}>
                  {SURPRISE_KINDS.map((k) => (
                    <button key={k} role="radio" aria-checked={kind === k} className="chip" onClick={() => setKind(k)}><AppIcon name={k === "memory" ? "memoryKind" : k} size={15} /> {t(`surprises.kinds.${k}`)}</button>
                  ))}
                </div>
              </div>
              <input className="field" maxLength={80} placeholder={t("surprises.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="field !min-h-32" maxLength={2000} placeholder={t("surprises.bodyPlaceholder")} value={body} onChange={(e) => setBody(e.target.value)} />
              <div>
                <span className="label">{t("surprises.when")}</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("surprises.when")}>
                  {SURPRISE_UNLOCKS.map((u) => (
                    <button key={u} role="radio" aria-checked={unlock === u} className="chip" onClick={() => setUnlock(u)}><AppIcon name={u} size={15} /> {t(`surprises.unlock.${u}`)}</button>
                  ))}
                </div>
                {unlock === "date" && <input type="date" className="field mt-3" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("surprises.pickDate")} />}
              </div>
              <label className="btn cursor-pointer justify-self-start">
                <AppIcon name="camera" size={18} /> {file ? file.name : t("surprises.addPhoto")}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] && isAcceptedImage(e.target.files[0]) ? e.target.files[0] : null)} />
              </label>
              <button className="btn btn-primary !min-h-14" disabled={pending || !body.trim() || (unlock === "date" && !date)} onClick={send}>
                <AppIcon name="send" size={18} /> {t("surprises.leave")}
              </button>
              <p className="text-xs text-muted">{t("surprises.privacy")}</p>
            </div>
          )}
        </section>
      )}

      {sent.length > 0 && (
        <section>
          <h2 className="text-2xl mb-3">{t("surprises.sent")}</h2>
          <ul className="grid gap-2">
            {sent.map((s) => (
              <li key={s.id} className="card p-4 flex items-center gap-3">
                <span className="grid place-items-center size-10 rounded-2xl bg-surface2 text-accent"><AppIcon name={s.kind === "memory" ? "memoryKind" : s.kind} size={18} /></span>
                <button type="button" className="flex-1 min-w-0 text-left" aria-label={t("surprises.previewOpen")}
                  onClick={() => setPreview({ kind: s.kind, unlock: s.unlock, unlock_at: s.unlock_at, title: s.title, body: s.body ?? "", storage_path: s.storage_path, justSent: false })}>
                  <p className="truncate">{s.title || t(`surprises.kinds.${s.kind}`)}</p>
                  <p className="text-xs text-muted">{s.opened_at ? t("surprises.statusOpened") : `${t("surprises.statusWaiting")} · ${when(s)}`}</p>
                </button>
                <button className="icon-btn text-muted" aria-label={t("common.delete")} onClick={() => confirm(t("common.confirmDelete")) && start(async () => { await deleteSurpriseAction(s.id); router.refresh(); })}><AppIcon name="trash" size={18} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview && (
        <Portal>
          <div role="dialog" aria-modal="true" aria-label={t("surprises.previewOpen")} className="fixed inset-0 z-50 grid place-items-center p-5 bg-black/55 backdrop-blur-md" onClick={() => setPreview(null)}>
            <div className="card w-full max-w-md p-7 pop-in max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <p className="eyebrow inline-flex items-center gap-1.5 mb-3"><AppIcon name="send" size={13} /> {preview.justSent ? t("surprises.youSent", { name: otherName }) : t("surprises.sentTo", { name: otherName })}</p>
              <div className="flex items-center gap-2 text-xs text-muted mb-3"><AppIcon name={preview.kind === "memory" ? "memoryKind" : preview.kind} size={14} /> {t(`surprises.kinds.${preview.kind}`)}</div>
              {preview.title && <h2 className="text-3xl mb-2">{preview.title}</h2>}
              <p className="font-display text-2xl leading-snug whitespace-pre-wrap break-words">{preview.body}</p>
              {preview.storage_path && urls[preview.storage_path] && <img src={urls[preview.storage_path]} alt="" className="mt-4 rounded-2xl w-full max-h-72 object-cover" />}
              <p className="text-xs text-muted mt-5 inline-flex items-center gap-1.5"><AppIcon name={preview.unlock_at && new Date(preview.unlock_at) > new Date() ? "clock" : preview.unlock} size={13} /> {when(preview)}</p>
              <button className="btn btn-primary w-full mt-6" onClick={() => setPreview(null)}>{t("surprises.close")}</button>
            </div>
          </div>
        </Portal>
      )}

      {/* the opening moment */}
      {(opening || revealed) && (
        <Portal>
        <div role="dialog" aria-modal="true" aria-label={t("surprises.open")} className="fixed inset-0 z-50 grid place-items-center p-5 bg-black/55 backdrop-blur-md" onClick={() => revealed && (setRevealed(null), router.refresh())}>
          {opening && !revealed && <div className="grid justify-items-center gap-4"><GiftBox open size={190} /><p className="font-display text-2xl text-white/90 rise">{t("surprises.opening")}</p></div>}
          {revealed && (
            <div className="card w-full max-w-md p-7 pop-in max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 text-xs text-muted mb-3"><AppIcon name="mailOpen" size={15} /> {t("surprises.fromName", { name: otherName })}</div>
              {revealed.title && <h2 className="text-3xl mb-2">{revealed.title}</h2>}
              <p className="font-display text-2xl leading-snug whitespace-pre-wrap break-words">{revealed.body}</p>
              {revealed.storage_path && urls[revealed.storage_path] && <img src={urls[revealed.storage_path]} alt="" className="mt-4 rounded-2xl w-full max-h-72 object-cover" />}
              <button className="btn btn-primary w-full mt-6" onClick={() => { setRevealed(null); router.refresh(); }}>{t("surprises.close")}</button>
            </div>
          )}
        </div>
        </Portal>
      )}
    </div>
  );
}
