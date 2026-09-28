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

  it("builds a varied local feed around coordinates, without a fixed city", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => {
      const query = JSON.parse(String(options?.body)).textQuery as string;
      const id = query.includes("טבע") ? "nature" : query.includes("כנסת") ? "jewish" : query.includes("למשפחות") ? "family" : "food";
      return new Response(JSON.stringify({ places: [{
        id, displayName: { text: id }, formattedAddress: "בית שמש",
        location: { latitude: 31.75, longitude: 34.99 },
        addressComponents: [{ shortText: "IL", types: ["country"] }],
      }] }), { status: 200 });
    });
    const result = await GET(new NextRequest("http://localhost/api/places?feed=1&city=ירושלים&lat=31.75&lng=34.99"));
    const body = await result.json();
    expect(body.places.map((place: { id: string }) => place.id)).toEqual(["nature", "jewish", "family", "food"]);
    for (const [, options] of fetcher.mock.calls) {
      const request = JSON.parse(String(options?.body));
      expect(request.textQuery).not.toContain("ירושלים");
      expect(request.textQuery).not.toContain("ישראל");
      expect(request.rankPreference).toBe("DISTANCE");
      expect(request.locationBias.circle.center).toEqual({ latitude: 31.75, longitude: 34.99 });
    }
  });

  it("treats an exact city search as a destination discovery feed", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => {
      const request = JSON.parse(String(options?.body));
      if (request.textQuery.startsWith("תל אביב")) return new Response(JSON.stringify({ places: [{
        id: "city", displayName: { text: "תל אביב-יפו" }, primaryType: "locality",
        location: { latitude: 32.08, longitude: 34.78 },
      }] }), { status: 200 });
      return new Response(JSON.stringify({ places: [{
        id: request.textQuery, displayName: { text: "מקום בתל אביב" },
        location: { latitude: 32.08, longitude: 34.78 },
      }] }), { status: 200 });
    });
    const result = await GET(new NextRequest("http://localhost/api/places?feed=1&query=תל%20אביב&city=ירושלים"));
    const body = await result.json();
    expect(body.places).toHaveLength(4);
    expect(body.places.some((place: { id: string }) => place.id === "city")).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});
