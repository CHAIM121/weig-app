import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { defaultLocale, directionFor } from "@/i18n/routing";
import { middleware } from "@/middleware";

// Middleware behavior is covered at the pure routing contract level here; a deployed smoke test
// verifies the response redirects and document attributes end to end.
describe("locale entry contract", () => {
  it("uses Hebrew as the default locale", () => {
    expect(defaultLocale).toBe("he");
  });

  it("maps document direction for both supported locales", () => {
    expect(directionFor("he")).toBe("rtl");
    expect(directionFor("en")).toBe("ltr");
  });

  it("returns a visitor to their last app tab from the root URL", () => {
    const request = new NextRequest("https://weig-app.vercel.app/", {
      headers: { cookie: "weig-last-path=/he/expenses" },
    });
    expect(middleware(request).headers.get("location")).toBe("https://weig-app.vercel.app/he/expenses");
  });

  it("uses Places when no valid previous tab exists", () => {
    const request = new NextRequest("https://weig-app.vercel.app/", {
      headers: { cookie: "weig-last-path=https://example.com/" },
    });
    expect(middleware(request).headers.get("location")).toBe("https://weig-app.vercel.app/he/places");
  });
});
