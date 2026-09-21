import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/provider";
import { dictionaries, getLocale } from "@/lib/i18n/server";
import { THEME_COOKIE } from "@/lib/i18n/config";
import { SwRegister } from "@/components/SwRegister";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

// Titles stay generic on purpose: nothing sensitive ever appears in tab titles or history.
export const metadata: Metadata = {
  title: { default: "Allyza", template: "%s · Allyza" },
  description: "Her rhythm. Our little world.",
  applicationName: "Allyza",
  appleWebApp: { capable: true, title: "Allyza", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: { title: "Allyza", description: "Her rhythm. Our little world.", images: ["/brand/og.png"] },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#170c1f",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = themeCookie === "light" || themeCookie === "dark" ? themeCookie : undefined;

  return (
    <html lang={locale} data-theme={theme} className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body>
        <I18nProvider locale={locale} dict={dictionaries[locale]}>
          {children}
          <SwRegister />
        </I18nProvider>
      </body>
    </html>
  );
}
