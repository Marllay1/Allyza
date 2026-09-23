"use client";
import { AppIcon } from "@/components/icons";
import { Switch } from "@/components/SettingsForms";
import { playRingBurst } from "@/features/calls/use-ring";
import { useI18n } from "@/lib/i18n/provider";
import { setLocalPref, useLocalPref } from "@/lib/local-pref";
import {
  RING_KEY, RING_STYLES, SFX_CATEGORIES, SFX_ENABLED_KEY, audioContext, previewTone, sfxKey,
  type RingId, type Sfx, type ToneId,
} from "@/lib/sfx";

/** Device-local sound choices: one master switch, then a list of tones for each kind of event. */
export function SoundSettings() {
  const { t } = useI18n();
  const enabled = useLocalPref(SFX_ENABLED_KEY, "1") !== "0";
  const ring = (useLocalPref(RING_KEY, "classic") ?? "classic") as RingId;
  const cats = Object.keys(SFX_CATEGORIES) as Sfx[];

  const previewRing = (id: RingId) => {
    const c = audioContext();
    if (!c) return;
    void c.resume().catch(() => {});
    playRingBurst(c, id);
  };

  return (
    <div className="grid gap-4">
      <div className="card p-4">
        <Switch checked={enabled} onChange={(v) => setLocalPref(SFX_ENABLED_KEY, v ? "1" : "0")} label={t("sounds.enabled")} hint={t("sounds.enabledHint")} />
      </div>

      <div className={`card p-4 grid gap-4 transition ${enabled ? "" : "opacity-50"}`}>
        {cats.map((c) => <ToneRow key={c} cat={c} disabled={!enabled} />)}
      </div>

      <div className="card p-4">
        <label className="block">
          <span className="block">{t("sounds.cat.ringtone")}</span>
          <span className="block text-xs text-muted mt-0.5 mb-2">{t("sounds.ringtoneHint")}</span>
          <span className="flex gap-2">
            <select className="field flex-1" value={ring} onChange={(e) => { setLocalPref(RING_KEY, e.target.value); previewRing(e.target.value as RingId); }}>
              {(Object.keys(RING_STYLES) as RingId[]).map((id) => <option key={id} value={id}>{t(`sounds.ring.${id}`)}</option>)}
            </select>
            <button type="button" className="icon-btn !size-12 shrink-0" aria-label={t("sounds.preview")} onClick={() => previewRing(ring)}><AppIcon name="play" size={18} /></button>
          </span>
        </label>
      </div>
    </div>
  );
}

function ToneRow({ cat, disabled }: { cat: Sfx; disabled: boolean }) {
  const { t } = useI18n();
  const def = SFX_CATEGORIES[cat];
  const stored = useLocalPref(sfxKey(cat), def.def);
  const value = stored === "off" || (stored && def.tones.includes(stored as ToneId)) ? stored! : def.def;
  return (
    <label className="block">
      <span className="block">{t(`sounds.cat.${cat}`)}</span>
      <span className="flex gap-2 mt-1.5">
        <select className="field flex-1" disabled={disabled} value={value} onChange={(e) => { setLocalPref(sfxKey(cat), e.target.value); if (e.target.value !== "off") previewTone(e.target.value as ToneId); }}>
          {def.tones.map((id) => <option key={id} value={id}>{t(`sounds.tone.${id}`)}</option>)}
          <option value="off">{t("sounds.off")}</option>
        </select>
        <button type="button" className="icon-btn !size-12 shrink-0" disabled={disabled || value === "off"} aria-label={t("sounds.preview")} onClick={() => previewTone(value as ToneId)}><AppIcon name="play" size={18} /></button>
      </span>
    </label>
  );
}
