import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/he", "/en", "/privacy", "/terms"], disallow: ["/api/", "/he/auth", "/en/auth", "/he/places", "/en/places", "/he/expenses", "/en/expenses", "/he/calls", "/en/calls", "/he/ai", "/en/ai"] },
      { userAgent: "OAI-SearchBot", allow: ["/he", "/en", "/privacy", "/terms"], disallow: ["/api/", "/he/auth", "/en/auth", "/he/places", "/en/places", "/he/expenses", "/en/expenses", "/he/calls", "/en/calls", "/he/ai", "/en/ai"] }
    ],
    sitemap: "https://weig-app.vercel.app/sitemap.xml",
    host: "https://weig-app.vercel.app"
  };
}
