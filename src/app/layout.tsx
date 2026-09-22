import { headers } from "next/headers";

import { isLocale } from "@/i18n/dictionaries";
import { defaultLocale, directionFor } from "@/i18n/routing";

import "./globals.css";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const localeHeader = (await headers()).get("x-weig-locale");
  const locale = localeHeader && isLocale(localeHeader) ? localeHeader : defaultLocale;

  return (
    <html lang={locale} dir={directionFor(locale)}>
      <body>{children}</body>
    </html>
  );
}
