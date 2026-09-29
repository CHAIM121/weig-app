import type { MetadataRoute } from "next";
const origin = "https://weig-app.vercel.app";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["he", "en"].flatMap(locale =>
    ["", "/travel-planner", "/kosher-travel"].map(path => ({
      url: `${origin}/${locale}${path}`,
      changeFrequency: "monthly" as const,
      priority: path ? 0.7 : 1,
      alternates: { languages: { he: `${origin}/he${path}`, en: `${origin}/en${path}` } }
    }))
  );
}
