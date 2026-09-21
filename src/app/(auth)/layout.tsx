import Link from "next/link";
import { AllyzaMark } from "@/components/icons";
import { LangSwitch } from "@/components/LangSwitch";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="room min-h-dvh flex flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Allyza" className="icon-btn"><AllyzaMark height={32} /></Link>
        <LangSwitch />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
        <div className="card w-full p-7 sm:p-9 page-enter">{children}</div>
      </main>
    </div>
  );
}
