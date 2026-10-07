import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";

import { isLocale } from "@/i18n/dictionaries";
import { defaultLocale, directionFor } from "@/i18n/routing";

import "@fontsource/assistant/hebrew-400.css";
import "@fontsource/assistant/hebrew-500.css";
import "@fontsource/assistant/hebrew-600.css";
import "@fontsource/assistant/hebrew-700.css";
import "@fontsource/assistant/hebrew-800.css";
import "@fontsource/assistant/latin-400.css";
import "@fontsource/assistant/latin-600.css";
import "@fontsource/assistant/latin-700.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "WEIG | וועג",
  description: "מקומות, הוצאות, שיחות ותכנון טיול במקום אחד.",
  applicationName: "WEIG",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "WEIG" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = { themeColor: "#2459e6" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const localeHeader = (await headers()).get("x-weig-locale");
  const locale = localeHeader && isLocale(localeHeader) ? localeHeader : defaultLocale;

  return (
    <html lang={locale} dir={directionFor(locale)}>
      <body>{children}</body>
    </html>
  );
}
