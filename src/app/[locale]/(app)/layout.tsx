import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getDictionary,isLocale } from "@/i18n/dictionaries";
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){const {locale}=await params;if(!isLocale(locale))notFound();return <AppShell locale={locale} dictionary={getDictionary(locale)}>{children}</AppShell>}
