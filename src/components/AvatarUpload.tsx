"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeAvatarAction, setAvatarAction } from "@/actions/avatar";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { AppIcon } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { isAcceptedImage, prepareImage } from "@/lib/image";
import { useT } from "@/lib/i18n/provider";
import type { ErrCode } from "@/lib/action-utils";

export function AvatarUpload({ coupleId, path, tone }: { coupleId: string; path: string | null; tone: "rose" | "gold" }) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrCode | null>(null);

  const onPick = async (f: File | undefined) => {
    if (!f || !isAcceptedImage(f)) return;
    setBusy(true); setError(null);
    try {
      const img = await prepareImage(f, 512);
      const newPath = `${coupleId}/avatars/${crypto.randomUUID()}.${img.ext}`;
      const up = await createClient().storage.from("couple-media").upload(newPath, img.blob, { contentType: img.type });
      if (up.error) throw up.error;
      const r = await setAvatarAction(newPath);
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch { setError("generic"); }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar path={path} tone={tone} size={64} />
      <div className="grid gap-2">
        <div className="flex gap-2">
          <button type="button" className="btn !min-h-10 text-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <AppIcon name="camera" size={15} /> {t("avatarSettings.change")}
          </button>
          {path && (
            <button type="button" className="btn btn-ghost !min-h-10 text-sm text-muted" disabled={busy} onClick={() => { removeAvatarAction(); router.refresh(); }}>
              {t("avatarSettings.remove")}
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
        <ErrorNote code={error} />
      </div>
    </div>
  );
}
