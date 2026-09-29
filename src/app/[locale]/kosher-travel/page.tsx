import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/dictionaries";
import styles from "../welcome.module.css";
const origin = "https://weig-app.vercel.app";
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
  const {locale}=await params;if(!isLocale(locale))return {};
  const title=locale==="he"?"טיול כשר בחו״ל: איך מתחילים | WEIG":"Kosher travel abroad: where to start | WEIG";
  const description=locale==="he"?"מחפשים מקומות בטיול בחו״ל? התחילו באזור היעד, סננו לפי הצורך ואמתו מידע כשרות ישירות מול המקום.":"Exploring places abroad? Start with your destination and verify kosher details directly with each venue.";
  return {title,description,alternates:{canonical:`${origin}/${locale}/kosher-travel`,languages:{he:`${origin}/he/kosher-travel`,en:`${origin}/en/kosher-travel`}}};
}
export default async function Page({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;if(!isLocale(locale))notFound();const he=locale==="he";
 return <main className={styles.page} dir={he?"rtl":"ltr"}><header className={styles.header}><Link className={styles.brand} href={`/${locale}`}>WEIG</Link><Link href={`/${locale}/places`}>{he?"פתחו את האפליקציה":"Open the app"}</Link></header>
 <section className={styles.hero}><div><span className={styles.eyebrow}>WEIG</span><h1>{he?"לטייל בחו״ל בדרך שמתאימה לכם":"Travel abroad your way"}</h1><p>{he?"כשמגיעים לעיר חדשה, מתחילים מהאזור שבו נמצאים או מהיעד שאליו נוסעים. WEIG עוזרת לחפש מקומות סביבכם ולבחון אותם לפני שמחליטים לאן ללכת. אם כשרות חשובה לכם, בדקו תעודה, השגחה ופרטים עדכניים ישירות מול העסק או מקור מהימן.":"In a new city, start with where you are or where you plan to go. WEIG helps you explore places and review details before choosing. If kosher certification matters, confirm current supervision and details with the venue or a trusted source."}</p><Link className={styles.button} href={`/${locale}/places`}>{he?"גלו מקומות":"Explore places"}</Link></div><div className={styles.visual}><img src="/branding/weig-logo.png" alt="WEIG" /></div></section></main>;
}