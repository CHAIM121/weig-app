import { notFound } from "next/navigation";
import { ModuleState,type ViewState } from "@/components/states/module-state";
import { getDictionary,isLocale } from "@/i18n/dictionaries";
const states:ViewState[]=["loading","empty","error","offline","provider"];
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{state?:string}>}){const [{locale},{state}]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();const dictionary=getDictionary(locale);const selected=states.includes(state as ViewState)?state as ViewState:"provider";return <div><h1 className="mb-5 text-2xl font-bold">{dictionary.modules.places}</h1><ModuleState state={selected} dictionary={dictionary}/></div>}
