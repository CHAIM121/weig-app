import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/dictionaries";
import styles from "../welcome.module.css";
const origin = "https://weig-app.vercel.app";
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
  const {locale}=await params;if(!isLocale(locale))return {};
  const title=locale==="he"?"חיפוש מקומות ותכנון טיול | WEIG":"Find places and plan a trip | WEIG";
  const description=locale==="he"?"חפשו מקומות לידכם או ביעד, עברו בין רשימה למפה והמשיכו לתכנון הטיול שלכם ב-WEIG.":"Find places nearby or at a destination, explore a list or map, and continue planning with WEIG.";
  return {title,description,alternates:{canonical:`${origin}/${locale}/travel-planner`,languages:{he:`${origin}/he/travel-planner`,en:`${origin}/en/travel-planner`}}};
}
export default async function Page({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;if(!isLocale(locale))notFound();
  const he=locale==="he";
  return <main className={styles.page} dir={he?"rtl":"ltr"}><header className={styles.header}><Link className={styles.brand} href={`/${locale}`}>WEIG</Link><Link href={`/${locale}/places`}>{he?"פתחו את האפליקציה":"Open the app"}</Link></header>
  <section className={styles.hero}><div><span className={styles.eyebrow}>WEIG</span><h1>{he?"מקום טוב להתחיל ממנו":"Start with a place"}</h1><p>{he?"מחפשים מה לעשות לידכם או ביעד הבא? ב-WEIG אפשר לבחור אזור וקטגוריה, לעיין בתוצאות ברשימה או במפה, ולפתוח מקום כדי לבדוק פרטים לפני היציאה.":"Looking for things to do nearby or at your destination? Choose an area and category, browse results in a list or map, and open a place to check details before heading out."}</p><Link className={styles.button} href={`/${locale}/places`}>{he?"חפשו מקומות":"Find places"}</Link></div><div className={styles.visual}><img src="/branding/weig-logo.png" alt="WEIG" /></div></section>
  <p className={styles.note}>{he?"תוצאות, זמני נסיעה ושעות פתיחה עשויים להשתנות. בדקו את פרטי המקום לפני הביקור.":"Results, travel times, and opening hours may change. Verify details before visiting."}</p></main>;
}