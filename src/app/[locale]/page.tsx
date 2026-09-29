import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/dictionaries";
import styles from "./welcome.module.css";

const origin = "https://weig-app.vercel.app";
const copy = {
  he: {
    title: "WEIG | מקומות ותכנון טיול במקום אחד",
    description: "מגלים מקומות בסביבה וביעד, מתכננים את הדרך ומרכזים את הוצאות הטיול ב-WEIG.",
    eyebrow: "WEIG · וועג",
    heading: "לגלות את המקום הבא שלך",
    intro: "מחפשים מקום לטייל בו עכשיו או מתכננים את הנסיעה הבאה? WEIG מרכזת חיפוש מקומות, כלי תכנון והוצאות במסך אחד.",
    open: "לפתוח את האפליקציה",
    places: "מקומות לידך וביעד",
    placesText: "אפשר לחפש לפי אזור וקטגוריה, לעבור בין רשימה למפה ולבדוק פרטים לפני שיוצאים.",
    expenses: "הוצאות הטיול",
    expensesText: "רושמים הוצאות ורואים את התמונה הכללית לאורך הדרך.",
    kosher: "טיול שמתאים לך",
    kosherText: "מחפשים אפשרויות רלוונטיות לטיול כשר? התחילו בחיפוש המקומות ובדקו כל מקום לפני הביקור.",
    more: "עוד על חיפוש מקומות",
    kosherLink: "טיול כשר בחו״ל",
    note: "פרטים כמו כשרות, שעות פתיחה וזמינות עשויים להשתנות. מומלץ לאמת מול המקום.",
    privacy: "פרטיות",
    terms: "תנאי שימוש",
    language: "English"
  },
  en: {
    title: "WEIG | Discover places and plan your trip",
    description: "Explore places nearby and at your destination, plan your journey, and keep trip expenses together with WEIG.",
    eyebrow: "WEIG",
    heading: "Find your next place",
    intro: "Looking for somewhere to go now or planning a future trip? WEIG brings place discovery, planning tools, and expenses together.",
    open: "Open the app",
    places: "Places nearby and away",
    placesText: "Explore by area and category, switch between list and map, and check details before you go.",
    expenses: "Trip expenses",
    expensesText: "Record expenses and see the bigger picture as your trip unfolds.",
    kosher: "Travel your way",
    kosherText: "Looking for options relevant to kosher travel? Start with place discovery and verify each place before visiting.",
    more: "Explore place discovery",
    kosherLink: "Kosher travel abroad",
    note: "Kosher status, opening hours, and availability can change. Check directly with each place.",
    privacy: "Privacy",
    terms: "Terms",
    language: "עברית"
  }
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = copy[locale];
  return {
    title: t.title,
    description: t.description,
    alternates: { canonical: `${origin}/${locale}`, languages: { he: `${origin}/he`, en: `${origin}/en` } },
    openGraph: { title: t.title, description: t.description, url: `${origin}/${locale}`, siteName: "WEIG", locale: locale === "he" ? "he_IL" : "en_US", type: "website", images: ["/branding/weig-logo.png"] }
  };
}

export default async function Welcome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = copy[locale];
  const schema = {
    "@context": "https://schema.org", "@type": "SoftwareApplication",
    name: "WEIG", url: `${origin}/${locale}`, applicationCategory: "TravelApplication",
    operatingSystem: "Web", inLanguage: ["he", "en"],
    description: t.description
  };
  return <main className={styles.page} dir={locale === "he" ? "rtl" : "ltr"}>
    <header className={styles.header}>
      <Link href={`/${locale}`} className={styles.brand}><img src="/branding/weig-mark.png" width="42" height="42" alt="" />WEIG</Link>
      <nav><Link href={`/${locale === "he" ? "en" : "he"}`} hrefLang={locale === "he" ? "en" : "he"}>{t.language}</Link><Link className={styles.smallButton} href={`/${locale}/places`}>{t.open}</Link></nav>
    </header>
    <section className={styles.hero}>
      <div><span className={styles.eyebrow}>{t.eyebrow}</span><h1>{t.heading}</h1><p>{t.intro}</p>
        <Link className={styles.button} href={`/${locale}/places`}>{t.open}</Link>
      </div>
      <div className={styles.visual}><img src="/branding/weig-logo.png" alt="WEIG" /></div>
    </section>
    <section className={styles.features} aria-label={locale === "he" ? "מה אפשר לעשות ב-WEIG" : "What you can do with WEIG"}>
      <article><span>01</span><h2>{t.places}</h2><p>{t.placesText}</p><Link href={`/${locale}/travel-planner`}>{t.more}</Link></article>
      <article><span>02</span><h2>{t.expenses}</h2><p>{t.expensesText}</p></article>
      <article><span>03</span><h2>{t.kosher}</h2><p>{t.kosherText}</p><Link href={`/${locale}/kosher-travel`}>{t.kosherLink}</Link></article>
    </section>
    <p className={styles.note}>{t.note}</p>
    <footer><span>© WEIG</span><div><Link href="/privacy">{t.privacy}</Link><Link href="/terms">{t.terms}</Link></div></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
  </main>;
}
