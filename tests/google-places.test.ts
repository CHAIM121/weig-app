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

  it("requires an area instead of silently defaulting to Jerusalem", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    const fetcher = vi.spyOn(globalThis, "fetch");
    const result = await GET(new NextRequest("http://localhost/api/places?feed=1"));
    expect(result.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not expose credentials or label Google data as verified", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    const request = vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => new Response(JSON.stringify({ places: JSON.parse(String(options?.body)).textQuery === "ירושלים ישראל" ? [
      { id: "city", displayName: { text: "ירושלים" }, primaryType: "locality", location: { latitude: 31.77, longitude: 35.21 } },
    ] : [
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

  it("rotates previously shown places and excludes distant results while nearby choices exist", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => {
      const query = JSON.parse(String(options?.body)).textQuery as string;
      const group = query.includes("טבע") ? "nature" : query.includes("כנסת") ? "jewish" : query.includes("למשפחות") ? "family" : "food";
      const places = Array.from({ length: 5 }, (_, index) => ({
        id: `${group}-${index}`, displayName: { text: `${group}-${index}` },
        location: { latitude: 31.75, longitude: 34.99 },
      }));
      places.push({ id: `${group}-far`, displayName: { text: "ירושלים" }, location: { latitude: 31.78, longitude: 35.21 } });
      return new Response(JSON.stringify({ places }), { status: 200 });
    });
    const first = await (await GET(new NextRequest("http://localhost/api/places?feed=1&lat=31.75&lng=34.99"))).json();
    const recent = first.places.map((place: { id: string }) => place.id).join(",");
    const next = await (await GET(new NextRequest(`http://localhost/api/places?feed=1&lat=31.75&lng=34.99&recent=${recent}`))).json();
    expect(first.places).toHaveLength(12);
    expect(next.places).toHaveLength(12);
    expect(next.places.map((place: { id: string }) => place.id)).not.toEqual(first.places.map((place: { id: string }) => place.id));
    expect(next.places.every((place: { id: string }) => !place.id.endsWith("-far"))).toBe(true);
  });

  it("treats an exact city search as a destination discovery feed", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => {
      const request = JSON.parse(String(options?.body));
      if (request.textQuery.startsWith("תל אביב")) return new Response(JSON.stringify({ places: [{
        id: "city", displayName: { text: "תל אביב-יפו" }, formattedAddress: "תל אביב-יפו",
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

  it("labels a bare city address as an area rather than an exact city location", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => new Response(JSON.stringify({ places: JSON.parse(String(options?.body)).textQuery === "בית שמש ישראל" ? [{
      id: "city", displayName: { text: "בית שמש" }, primaryType: "locality", location: { latitude: 31.74, longitude: 35.02 },
    }] : [{ id: "cave", displayName: { text: "מערת הנטיפים" }, formattedAddress: "בית שמש", location: { latitude: 31.74, longitude: 35.02 } }] }), { status: 200 }));
    const result = await GET(new NextRequest("http://localhost/api/places?category=nature&city=בית%20שמש"));
    expect((await result.json()).places[0].address).toBe("אזור בית שמש");
  });

  it("loads unseen places and expands the discovery radius gradually", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    const request = vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => {
      const body = JSON.parse(String(options?.body));
      const group = body.textQuery.includes("טבע") ? "nature" : body.textQuery.includes("כנסת") ? "synagogue" : body.textQuery.includes("למשפחות") ? "family" : "food";
      return new Response(JSON.stringify({ places: Array.from({ length: 8 }, (_, index) => ({
        id: `${group}-${index}`, displayName: { text: `${group}-${index}` },
        location: { latitude: 31.75, longitude: 34.99 },
      })) }), { status: 200 });
    });
    const base = "http://localhost/api/places?feed=1&lat=31.75&lng=34.99";
    const first = await (await GET(new NextRequest(base))).json();
    const second = await (await GET(new NextRequest(`${base}&page=1&seen=${first.places.map((place: { id: string }) => place.id).join(",")}`))).json();
    expect(first.places).toHaveLength(12);
    expect(second.places).toHaveLength(12);
    expect(second.places.every((place: { id: string }) => !first.places.some((prior: { id: string }) => prior.id === place.id))).toBe(true);
    const thirdSeen = [...first.places, ...second.places].map((place: { id: string }) => place.id).join(",");
    const third = await (await GET(new NextRequest(`${base}&page=2&seen=${thirdSeen}`))).json();
    expect(third.places.every((place: { id: string }) => !thirdSeen.split(",").includes(place.id))).toBe(true);
    const thirdRequests = request.mock.calls.slice(-4);
    expect(thirdRequests.every(([, options]) => JSON.parse(String(options?.body)).locationBias.circle.radius === 55000)).toBe(true);
  });

  it("passes Google's next page token through for a category list", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "private-test-key";
    const request = vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => {
      const body = JSON.parse(String(options?.body));
      return new Response(JSON.stringify({
        places: [{ id: body.pageToken ? "second" : "first", displayName: { text: "Place" }, location: { latitude: 31.75, longitude: 34.99 } }],
        ...(!body.pageToken ? { nextPageToken: "next-123" } : {}),
      }), { status: 200 });
    });
    const first = await (await GET(new NextRequest("http://localhost/api/places?category=nature&lat=31.75&lng=34.99"))).json();
    const second = await (await GET(new NextRequest("http://localhost/api/places?category=nature&lat=31.75&lng=34.99&page=1&pageToken=next-123&seen=first"))).json();
    expect(first.nextPageToken).toBe("next-123");
    expect(first.hasMore).toBe(true);
    expect(second.places.map((place: { id: string }) => place.id)).toEqual(["second"]);
    expect(second.hasMore).toBe(false);
    expect(JSON.parse(String(request.mock.calls[1][1]?.body)).pageToken).toBe("next-123");
  });
});
