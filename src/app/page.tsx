import Link from "next/link";
import { AppIcon, AllyzaLogo } from "@/components/icons";
import { LangSwitch } from "@/components/LangSwitch";
import { WelcomeCarousel } from "@/features/welcome/WelcomeCarousel";
import { getT } from "@/lib/i18n/server";

/** First visit only: proxy.ts sends anyone with a valid session straight to /home. */
export default async function Welcome() {
  const { t } = await getT();
  const cards = [
    { icon: "her", tint: "var(--rose)", eyebrow: t("welcome.cards.her.eyebrow"), title: t("welcome.cards.her.title"), text: t("welcome.cards.her.text") },
    { icon: "refuge", tint: "var(--mauve)", eyebrow: t("welcome.cards.refuge.eyebrow"), title: t("welcome.cards.refuge.title"), text: t("welcome.cards.refuge.text") },
    { icon: "us", tint: "var(--gold)", eyebrow: t("welcome.cards.us.eyebrow"), title: t("welcome.cards.us.title"), text: t("welcome.cards.us.text") },
  ] as const;

  return (
    <div className="room min-h-dvh flex flex-col overflow-x-hidden">
      <header className="flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <LangSwitch />
      </header>
      <main className="flex-1 flex flex-col items-center w-full max-w-5xl mx-auto pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="rise flex flex-col items-center text-center px-6 pt-2">
          <AllyzaLogo height={150} />
          <h1 className="mt-4 text-[2.1rem] sm:text-5xl leading-tight text-balance">{t("welcome.hello")}</h1>
          <p className="mt-3 font-display italic text-xl text-gold">{t("welcome.madeForYou")}</p>
          <p className="mt-3 max-w-md text-muted text-balance">{t("welcome.intro")}</p>
        </div>

        <div className="w-full rise" style={{ animationDelay: "0.15s" }}>
          <WelcomeCarousel
            cards={[...cards]}
            labels={{ region: t("welcome.carousel"), prev: t("common.previous"), next: t("common.next"), goTo: t("welcome.goTo") }}
          />
        </div>

        <div className="flex flex-col items-center gap-4 px-6 rise" style={{ animationDelay: "0.3s" }}>
          <Link href="/login" className="btn btn-primary !min-h-14 !px-10 text-lg">
            {t("welcome.enter")}
            <AppIcon name="arrowRight" size={20} />
          </Link>
          <p className="font-display italic text-lg text-muted">{t("brand.tagline")}</p>
        </div>
      </main>
    </div>
  );
}
