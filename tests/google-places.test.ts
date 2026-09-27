import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/places/route";
import { placeCategories } from "@/modules/places/categories";

const initialKey = process.env.GOOGLE_PLACES_API_KEY;
afterEach(() => {
  vi.restoreAllMocks();
  if (initialKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = initialKey;
});

describe("Israel places search", () => {
  it("offers concrete category choices without requiring a Google request", () => {
    expect(placeCategories).toHaveLength(14);
    expect(placeCategories.map(item => item.he)).toContain("קברי צדיקים");
    expect(placeCategories.map(item => item.he)).toContain("סופרים ואוכל מוכן");
  });

  it("keeps a missing Google key explicit", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const result = await GET(new NextRequest("http://localhost/api/places?category=nature&city=ירושלים"));
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: "PLACES_NOT_CONFIGURED" });
  });

  it("does not expose credentials or label Google data as verified", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ places: [
      { id: "israel-id", displayName: { text: "מקום בירושלים" }, formattedAddress: "ירושלים", addressComponents: [{ shortText: "IL", types: ["country"] }], location: { latitude: 31.77, longitude: 35.21 } },
      { id: "outside-id", displayName: { text: "Elsewhere" }, addressComponents: [{ shortText: "JO", types: ["country"] }] },
    ] }), { status: 200 }));
    const result = await GET(new NextRequest("http://localhost/api/places?category=restaurants&city=ירושלים"));
    const body = await result.json();
    expect(result.status).toBe(200);
    expect(body.places).toHaveLength(1);
    expect(body.places[0].verification).toBe("unverified");
    expect(JSON.stringify(body)).not.toContain("private-test-key");
    expect(request.mock.calls[0][1]?.headers).toMatchObject({ "X-Goog-Api-Key": "private-test-key" });
    expect(request.mock.calls[0][1]?.cache).toBe("no-store");
  });
});
