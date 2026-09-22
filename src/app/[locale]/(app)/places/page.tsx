import { notFound } from "next/navigation";
import { ModuleExperience } from "@/components/module-experience";
import { getDictionary, isLocale } from "@/i18n/dictionaries";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
 const { locale } = await params; if (!isLocale(locale)) notFound();
 return <ModuleExperience module="places" t={getDictionary(locale)} />;
}
