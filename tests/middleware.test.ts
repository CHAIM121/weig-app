import { describe, expect, it } from "vitest";

import { defaultLocale, directionFor } from "@/i18n/routing";

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
});
