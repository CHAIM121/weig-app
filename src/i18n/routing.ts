import type { Locale } from "./dictionaries";
export const defaultLocale: Locale = "he";
export const directionFor = (locale: Locale) => locale === "he" ? "rtl" : "ltr";
export const localizePath = (locale:Locale,path:string) => `/${locale}${path.startsWith("/")?path:`/${path}`}`;
