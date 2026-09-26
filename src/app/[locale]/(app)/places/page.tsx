import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ModuleExperience } from "@/components/module-experience";
import { getDictionary, isLocale } from "@/i18n/dictionaries";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
 const { locale } = await params; if (!isLocale(locale)) notFound();
 return <Suspense fallback={<div className="places-loading" />}><ModuleExperience module="places" t={getDictionary(locale)} /></Suspense>;
}
