import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { getT } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT();
  return (
    <div className="min-h-dvh flex flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex justify-end">
        <LangSwitch />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-md mx-auto">
        <Link href="/" aria-label="Allyza">
          <Logo size={64} showTagline tagline={t("brand.tagline")} />
        </Link>
        <div className="card w-full p-6 sm:p-8 rise">{children}</div>
      </main>
    </div>
  );
}
