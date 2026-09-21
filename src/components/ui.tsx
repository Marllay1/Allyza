import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  back,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-5 rise">
      {back && (
        <Link
          href={back}
          aria-label={backLabel}
          className="inline-flex items-center justify-center size-10 -ml-2 mb-1 rounded-full text-muted hover:text-ink hover:bg-surface2 transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      )}
      <h1 className="text-4xl">{title}</h1>
      {subtitle && <p className="text-muted mt-1 text-balance">{subtitle}</p>}
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

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface2/70 border border-line p-3.5">
      <div className="eyebrow">{label}</div>
      <div className="font-display text-3xl mt-1 leading-none">{value}</div>
      {hint && <div className="text-xs text-muted mt-1.5">{hint}</div>}
    </div>
  );
}

export function TileLink({ href, icon, title, text, badge }: { href: string; icon: string; title: string; text?: string; badge?: boolean }) {
  return (
    <Link href={href} className="card p-4 flex items-center gap-4 hover:translate-y-[-2px] transition relative">
      <span className="text-2xl w-10 text-center" aria-hidden>{icon}</span>
      <span className="flex-1">
        <span className="block font-display text-xl">{title}</span>
        {text && <span className="block text-sm text-muted">{text}</span>}
      </span>
      {badge && <span className="size-2.5 rounded-full bg-rose" aria-hidden />}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted text-sm text-center py-6 text-balance">{children}</p>;
}
