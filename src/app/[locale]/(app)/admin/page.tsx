import {notFound} from "next/navigation";
import {AdminConsole} from "@/components/admin-console";
import {isLocale} from "@/i18n/dictionaries";
export default async function Page({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;
 if(!isLocale(locale))notFound();
 return <AdminConsole locale={locale}/>;
}
export const metadata={title:"ניהול המערכת | WEIG",robots:{index:false,follow:false}};
