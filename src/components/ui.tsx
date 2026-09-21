import Link from "next/link";
import { AppIcon, type IconName } from "@/components/icons";

export function PageHeader({ title, subtitle, back, backLabel }: { title: string; subtitle?: string; back?: string; backLabel?: string }) {
  return (
    <div className="mb-6 rise">
      {back && (
        <Link href={back} aria-label={backLabel} className="icon-btn -ml-2 mb-1 text-muted hover:text-ink">
          <AppIcon name="back" size={22} />
        </Link>
      )}
      <h1 className="text-[2.6rem] leading-[1.05]">{title}</h1>
      {subtitle && <p className="text-muted mt-2 text-balance">{subtitle}</p>}
    </div>
  );
}

export function Section({ title, children, aside }: { title?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card p-5 mb-4 rise">
      {(title || aside) && (
        <div className="flex items-baseline justify-between gap-3 mb-3">
          {title && <h2 className="text-2xl">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: string; icon?: IconName }) {
  return (
    <div className="rounded-3xl bg-surface2/70 border border-line p-4">
      <div className="eyebrow flex items-center gap-1.5">{icon && <AppIcon name={icon} size={13} />}{label}</div>
      <div className="font-display text-3xl mt-1.5 leading-none">{value}</div>
      {hint && <div className="text-xs text-muted mt-2">{hint}</div>}
    </div>
  );
}

/** Round icon badge used at the start of tiles and cards. */
export function IconBadge({ name, tone = "accent", size = 22 }: { name: IconName; tone?: "accent" | "rose" | "mauve" | "gold"; size?: number }) {
  const tones = { accent: "var(--accent)", rose: "var(--rose)", mauve: "var(--mauve)", gold: "var(--gold)" };
  return (
    <span className="grid place-items-center size-11 rounded-2xl shrink-0" style={{ background: `color-mix(in srgb, ${tones[tone]} 16%, transparent)`, color: tones[tone] }}>
      <AppIcon name={name} size={size} />
    </span>
  );
}

export function TileLink({ href, icon, title, text, badge, tone, right }: { href: string; icon: IconName; title: string; text?: string; badge?: boolean; tone?: "accent" | "rose" | "mauve" | "gold"; right?: React.ReactNode }) {
  return (
    <Link href={href} className="card p-4 flex items-center gap-4 transition duration-300 hover:-translate-y-0.5 active:scale-[0.985] relative">
      <IconBadge name={icon} tone={tone} />
      <span className="flex-1 min-w-0">
        <span className="block font-display text-xl leading-tight">{title}</span>
        {text && <span className="block text-sm text-muted">{text}</span>}
      </span>
      {badge && <span className="size-2.5 rounded-full bg-rose" role="status" />}
      {right}
      <AppIcon name="forward" size={18} className="text-muted" />
    </Link>
  );
}

export function Empty({ children, icon }: { children: React.ReactNode; icon?: IconName }) {
  return (
    <div className="text-muted text-sm text-center py-8 grid justify-items-center gap-3">
      {icon && <AppIcon name={icon} size={28} className="opacity-60" />}
      <p className="text-balance max-w-xs">{children}</p>
    </div>
  );
}
