import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/places/details/route";

const initialKey = process.env.GOOGLE_PLACES_API_KEY;
afterEach(() => {
  vi.restoreAllMocks();
  if (initialKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = initialKey;
});

describe("Place details", () => {
  it("rejects invalid place IDs before making a Google request", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const response = await GET(new NextRequest("http://localhost/api/places/details?id=../../other"));
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requests reviews only after they are explicitly opened", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({
      id: "ChIJexample", rating: 4.5, userRatingCount: 20, nationalPhoneNumber: "02-1234567",
      currentOpeningHours: { openNow: true, weekdayDescriptions: ["יום ראשון: 9:00–17:00"] },
      reviews: [{ rating: 5, text: { text: "Good" }, authorAttribution: { displayName: "Visitor" } }],
    }), { status: 200 }));
    const base = await GET(new NextRequest("http://localhost/api/places/details?id=ChIJexample"));
    expect(base.status).toBe(200);
    expect((await base.json()).reviews).toBeUndefined();
    expect((fetcher.mock.calls[0][1]?.headers as Record<string, string>)["X-Goog-FieldMask"]).not.toContain("reviews");

    const expanded = await GET(new NextRequest("http://localhost/api/places/details?id=ChIJexample&reviews=1"));
    const body = await expanded.json();
    expect(body.reviews[0].author).toBe("Visitor");
    expect(body.openNow).toBe(true);
    expect(JSON.stringify(body)).not.toContain("private-test-key");
    expect((fetcher.mock.calls[1][1]?.headers as Record<string, string>)["X-Goog-FieldMask"]).toContain("reviews");
  });
});
