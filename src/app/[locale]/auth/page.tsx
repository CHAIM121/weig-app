import { notFound } from "next/navigation";
import { AuthExperience } from "@/components/auth-experience";
import { getDictionary, isLocale } from "@/i18n/dictionaries";
export default async function AuthPage({ params }: { params: Promise<{locale:string}> }) {
  const {locale}=await params;
  if(!isLocale(locale))notFound();
  return <AuthExperience t={getDictionary(locale)} locale={locale}/>;
}
