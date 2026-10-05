import {notFound} from "next/navigation";
import {isLocale} from "@/i18n/dictionaries";
import {KashrutAdmin} from "@/components/kashrut-admin";
export default async function Page({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;if(!isLocale(locale))notFound();return <KashrutAdmin locale={locale}/>;
}
export const metadata={title:"ניהול מקורות כשרות | WEIG",robots:{index:false,follow:false}};
