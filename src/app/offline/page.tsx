import { Mark } from "@/components/Logo";

// Cached by the service worker at install. Both languages are in the markup and one
// is revealed from the saved language cookie, so it needs no server when offline.

export default function Offline() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
      <Mark size={72} />
      <div data-l="fr" className="hidden">
        <h1 className="text-3xl">Tu es hors ligne</h1>
        <p className="text-muted mt-2">Ton espace est privé et n’est jamais gardé sur cet appareil. Reviens dès que la connexion est de retour.</p>
      </div>
      <div data-l="en" className="hidden">
        <h1 className="text-3xl">You’re offline</h1>
        <p className="text-muted mt-2">Your space is private and never stored on this device. Come back when you’re connected.</p>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var m=document.cookie.match(/allyza_lang=(fr|en)/);var l=m?m[1]:(navigator.language||'fr').slice(0,2)==='en'?'en':'fr';document.querySelector('[data-l="'+l+'"]').classList.remove('hidden');document.documentElement.lang=l;})();`,
        }}
      />
    </main>
  );
}
