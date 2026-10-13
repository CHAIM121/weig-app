import {notFound,redirect} from "next/navigation";
import {isLocale} from "@/i18n/dictionaries";
export default async function Page({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;
 if(!isLocale(locale))notFound();
 redirect("/"+locale+"/admin");
}
export const metadata={title:"ניהול המערכת | WEIG",robots:{index:false,follow:false}};
