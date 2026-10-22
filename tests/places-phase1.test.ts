// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { googleFetch, requestKey, SEARCH_FIELDS } from "@/modules/places/server/google";
import { detailMask } from "@/modules/places/server/detail-mask";
import type { OwnPlace } from "@/modules/places/server/local";
import { GET as search } from "@/app/api/places/route";
import { GET as details } from "@/app/api/places/details/route";
import { GET as autocomplete } from "@/app/api/places/autocomplete/route";

const own: OwnPlace = { id: "uuid", google_place_id: "ChIJowned", category: "kosher_restaurant", name_he: "שם עצמאי", address_he: "בית שמש 1", phone: "021234567", website: "https://example.com", opening_hours: { weekdayDescriptions: ["9–17"] }, photos: ["https://example.com/own.jpg"], description_he: "שלנו", verification_count: 1, business_claimed: false, own_lat: 31.75, own_lng: 34.99 };
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function configured() { vi.stubEnv("GOOGLE_PLACES_API_KEY", "private-key"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); }
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("Google request coalescing without content caching", () => {
  it("coalesces exact overlapping calls, clones responses, and fetches again after settlement", async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(json({ id: "fresh" }));
    const a = googleFetch("https://places.googleapis.com/v1/places/unique", {});
    const b = googleFetch("https://places.googleapis.com/v1/places/unique", {});
    expect(fetcher).toHaveBeenCalledTimes(1);
    finish(json({ id: "first" }));
    expect(await (await a).json()).toEqual({ id: "first" });
    expect(await (await b).json()).toEqual({ id: "first" });
    expect(await (await googleFetch("https://places.googleapis.com/v1/places/unique", {})).json()).toEqual({ id: "fresh" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not retain errors and separates masks, locales, sessions and bodies", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network")).mockResolvedValue(json({}));
    await expect(googleFetch("https://places.googleapis.com/v1/error", {})).rejects.toThrow("network");
    await googleFetch("https://places.googleapis.com/v1/error", {});
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(requestKey("url?languageCode=he", {})).not.toBe(requestKey("url?languageCode=en", {}));
    expect(requestKey("url", { headers: { "X-Goog-FieldMask": "id" } })).not.toBe(requestKey("url", { headers: { "X-Goog-FieldMask": "rating" } }));
    expect(requestKey("url", { body: "session-a" })).not.toBe(requestKey("url", { body: "session-b" }));
  });
});

describe("WEIG-first serving", () => {
  it.each([{ verification_count: 1, business_claimed: false }, { verification_count: 0, business_claimed: true }])("serves a contributed/claimed listing with zero Google calls", async flags => {
    configured();
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(json([{ ...own, ...flags }]));
    const response = await search(new NextRequest("http://localhost/api/places?feed=1&lat=31.75&lng=34.99"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("weig_owned"); expect(body.places[0].name).toBe(own.name_he);
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith("https://db.example/"))).toBe(true);
  });
  it("does not convert an exhausted local page into paid Google discovery", async () => {
    configured(); const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(json([]));
    const response = await search(new NextRequest("http://localhost/api/places?feed=1&city=בית%20שמש&local=1&page=1"));
    expect((await response.json()).places).toEqual([]);
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes("googleapis"))).toBe(true);
  });
  it("never overwrites independent fields with Google content and requests only missing detail fields", async () => {
    configured();
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async url => String(url).startsWith("https://db.example") ? json([own]) : json({ id: own.google_place_id, displayName: { text: "Google" }, formattedAddress: "Google address", internationalPhoneNumber: "Google phone", rating: 4.5 }));
    const response = await details(new NextRequest(`http://localhost/api/places/details?id=${own.google_place_id}`));
    const body = await response.json();
    expect(body.name).toBe(own.name_he); expect(body.phone).toBe(own.phone); expect(body.photos).toHaveLength(1);
    const options = fetcher.mock.calls.find(([url]) => String(url).includes("googleapis"))?.[1];
    const mask = new Headers(options?.headers).get("X-Goog-FieldMask")!;
    expect(mask).not.toMatch(/displayName|formattedAddress|PhoneNumber|websiteUri|OpeningHours|photos|location/);
    expect(mask).toContain("rating");
  });
  it("keeps list masks free of photos, hours, reviews and contacts", () => {
    expect(SEARCH_FIELDS).not.toMatch(/photos|OpeningHours|reviews|PhoneNumber|websiteUri/);
    expect(detailMask(null, false)).toContain("photos");
  });
  it("rejects out-of-range and incomplete coordinates before any network call", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    for (const suffix of ["lat=NaN&lng=34", "lat=91&lng=34", "lat=31", "radius_m=-1"]) {
      expect((await search(new NextRequest(`http://localhost/api/places?feed=1&city=city&${suffix}`))).status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("local-first autocomplete", () => {
  const base = "http://localhost/api/places/autocomplete?q=בית&sessionToken=12345678-1234-1234-1234-123456789abc";
  it("uses only WEIG for three local suggestions", async () => {
    configured(); const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(json([own, { ...own, google_place_id: "local2" }, { ...own, google_place_id: "local3" }]));
    expect((await (await autocomplete(new NextRequest(base))).json()).places).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("falls back below three locals with a session token and never requests photos", async () => {
    configured(); const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async url => String(url).startsWith("https://db.example") ? json([own]) : json({ suggestions: [{ placePrediction: { placeId: "ChIJother", text: { text: "Other" } } }] }));
    const body = await (await autocomplete(new NextRequest(base))).json();
    expect(body.places).toHaveLength(2);
    const options = fetcher.mock.calls[1][1];
    expect(JSON.parse(String(options?.body)).sessionToken).toBe("12345678-1234-1234-1234-123456789abc");
    expect(body.places.every((p: { photoName: unknown }) => p.photoName === null)).toBe(true);
  });
});
