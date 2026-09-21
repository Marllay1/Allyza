import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { getT } from "@/lib/i18n/server";

export default async function Welcome() {
  const { t } = await getT();
  const worlds = [
    { icon: "🌷", title: t("nav.her"), text: t("welcome.her") },
    { icon: "🌙", title: t("nav.refuge"), text: t("welcome.refuge") },
    { icon: "💕", title: t("nav.us"), text: t("welcome.us") },
  ];
  return (
    <div className="min-h-dvh flex flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex justify-end">
        <LangSwitch />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center gap-10 w-full max-w-md mx-auto text-center">
        <div className="rise">
          <Logo size={96} showTagline tagline={t("brand.tagline")} />
        </div>
        <p className="text-muted text-balance rise" style={{ animationDelay: "0.1s" }}>
          {t("welcome.intro")}
        </p>
        <ul className="w-full grid gap-3 text-left rise" style={{ animationDelay: "0.2s" }}>
          {worlds.map((w) => (
            <li key={w.title} className="card p-4 flex gap-4 items-start">
              <span className="text-2xl" aria-hidden>{w.icon}</span>
              <div>
                <h2 className="text-xl">{w.title}</h2>
                <p className="text-sm text-muted">{w.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="w-full grid gap-3 rise" style={{ animationDelay: "0.3s" }}>
          <Link href="/signup" className="btn btn-primary">{t("auth.createAccount")}</Link>
          <Link href="/login" className="btn">{t("auth.signIn")}</Link>
        </div>
        <p className="text-xs text-muted max-w-xs text-balance">{t("welcome.disclaimer")}</p>
      </main>
    </div>
  );
}
