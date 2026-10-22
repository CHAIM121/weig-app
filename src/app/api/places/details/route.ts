import { detailMask } from "@/modules/places/server/detail-mask";
import { NextRequest, NextResponse } from "next/server";
import { catalogPlace } from "@/modules/places/catalog";
import { googleFetch } from "@/modules/places/server/google";
import { ownPlace, saveCoordinates } from "@/modules/places/server/local";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

type Details = {
  id?: string; displayName?: { text?: string }; formattedAddress?: string;
  internationalPhoneNumber?: string; nationalPhoneNumber?: string; websiteUri?: string;
  rating?: number; userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  location?: { latitude?: number; longitude?: number };
  attributions?: { provider?: string; providerUri?: string }[];
  photos?: { name?: string; googleMapsUri?: string; authorAttributions?: { displayName?: string; uri?: string }[] }[];
  reviews?: { rating?: number; text?: { text?: string }; authorAttribution?: { displayName?: string; uri?: string; photoUri?: string }; googleMapsUri?: string; relativePublishTimeDescription?: string }[];
};
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token = params.get("sessionToken");
  if (token && !/^[a-f0-9-]{36}$/i.test(token)) return NextResponse.json({ error: "INVALID_SESSION" }, { status: 400, headers });
  const id = params.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{5,200}$/.test(id)) return NextResponse.json({ error: "INVALID_PLACE" }, { status: 400, headers });
  if (id.startsWith("weig_")) {
    try {
      const place = await catalogPlace(id);
      return place ? NextResponse.json({ phone: place.phone, website: place.website?.startsWith("https://") ? place.website : null, rating: null, ratingCount: null, openNow: null, hours: [], photos: [], source: "weig_catalog" }, { headers }) : NextResponse.json({ error: "PLACE_NOT_FOUND" }, { status: 404, headers });
    } catch { return NextResponse.json({ error: "CATALOG_UNAVAILABLE" }, { status: 503, headers }); }
  }
  try {
    const own = await ownPlace(id);
    const reviews = params.get("reviews") === "1";
    const key = process.env.GOOGLE_PLACES_API_KEY;
    let place: Details = {};
    if (key) {
      const acquiredAt = new Date().toISOString();
      const response = await googleFetch(`https://places.googleapis.com/v1/places/${id}?languageCode=${params.get("locale") === "en" ? "en" : "he"}${token ? `&sessionToken=${encodeURIComponent(token)}` : ""}`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": detailMask(own, reviews) }, cache: "no-store",
      });
      if (!response.ok) throw new Error("GOOGLE_UNAVAILABLE");
      place = await response.json() as Details;
      if (place.id !== id) throw new Error("WRONG_PLACE");
      await saveCoordinates([place], acquiredAt);
    } else if (!own) return NextResponse.json({ error: "PLACES_NOT_CONFIGURED" }, { status: 503, headers });
    return NextResponse.json({
      name: own?.name_he ?? place.displayName?.text ?? null,
      address: own?.address_he ?? place.formattedAddress ?? null,
      phone: own?.phone ?? place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
      website: own?.website ?? (place.websiteUri?.startsWith("https://") ? place.websiteUri : null),
      rating: place.rating ?? null, ratingCount: place.userRatingCount ?? null,
      // Regular hours are not a reliable open-now signal.
      openNow: place.currentOpeningHours?.openNow ?? null,
      hours: own?.opening_hours?.weekdayDescriptions ?? place.regularOpeningHours?.weekdayDescriptions ?? place.currentOpeningHours?.weekdayDescriptions ?? [],
      photos: own?.photos.length ? own.photos.slice(0, 1).filter(url => url.startsWith("https://")).map(url => ({ url, name: "weig-owned", credits: [] }))
        : (place.photos ?? []).filter(p => /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(p.name ?? "")).slice(0, 1).map(p => ({ name: p.name!, mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${id}`, credits: p.authorAttributions ?? [] })),
      attributions: place.attributions ?? [],
      ...(reviews ? { reviews: (place.reviews ?? []).slice(0, 5).map(r => ({ rating: r.rating ?? null, text: r.text?.text ?? "", author: r.authorAttribution?.displayName ?? "", authorUrl: r.authorAttribution?.uri ?? null, authorPhoto: r.authorAttribution?.photoUri ?? null, mapsUrl: r.googleMapsUri ?? null, when: r.relativePublishTimeDescription ?? "" })) } : {}),
      source: key ? "google_places" : "weig_owned",
    }, { headers });
  } catch { return NextResponse.json({ error: "PLACES_UPSTREAM_ERROR" }, { status: 502, headers }); }
}
