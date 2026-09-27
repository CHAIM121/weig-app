import { NextRequest, NextResponse } from "next/server";
import { findCategory } from "@/modules/places/categories";

export const dynamic = "force-dynamic";

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  photos?: { name?: string; authorAttributions?: { displayName?: string; uri?: string }[] }[];
  attributions?: { provider?: string; providerUri?: string }[];
  addressComponents?: { types?: string[]; shortText?: string }[];
};

const noStore = { "Cache-Control": "no-store" };
const israelBounds = (lat: number, lng: number) => lat >= 29.4 && lat <= 33.4 && lng >= 34.2 && lng <= 35.95;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = findCategory(params.get("category") ?? "");
  const query = (params.get("query") ?? "").trim();
  const city = (params.get("city") ?? "ירושלים").trim();
  const locale = params.get("locale") === "en" ? "en" : "he";
  if ((!category && query.length < 2) || query.length > 100 || city.length > 60 || !city) {
    return NextResponse.json({ error: "INVALID_SEARCH" }, { status: 400, headers: noStore });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "PLACES_NOT_CONFIGURED" }, { status: 503, headers: noStore });

  const rawLat = Number(params.get("lat"));
  const rawLng = Number(params.get("lng"));
  const useLocation = params.has("lat") && params.has("lng") && Number.isFinite(rawLat) && Number.isFinite(rawLng) && israelBounds(rawLat, rawLng);
  const term = query || (locale === "he" ? category?.searchHe : category?.searchEn) || "";
  const textQuery = `${term} ${useLocation ? "" : `ב${city}`} ישראל`.trim();

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.photos,places.attributions,places.addressComponents",
      },
      body: JSON.stringify({
        textQuery,
        languageCode: locale,
        regionCode: "IL",
        pageSize: 12,
        ...(useLocation ? { locationBias: { circle: { center: { latitude: rawLat, longitude: rawLng }, radius: 15000 } } } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8500),
    });
    if (!response.ok) return NextResponse.json({ error: "PLACES_UPSTREAM_ERROR" }, { status: 502, headers: noStore });
    const body = await response.json() as { places?: GooglePlace[] };
    const places = (body.places ?? []).filter(place => {
      if (!place.id || !place.displayName?.text) return false;
      const country = place.addressComponents?.find(component => component.types?.includes("country"))?.shortText;
      if (country && country !== "IL") return false;
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      return typeof lat !== "number" || typeof lng !== "number" || israelBounds(lat, lng);
    }).map(place => ({
      id: place.id,
      name: place.displayName?.text,
      address: place.formattedAddress ?? "",
      mapsUrl: place.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(place.id!)}`,
      location: place.location ?? null,
      photoName: place.photos?.[0]?.name ?? null,
      photoCredits: place.photos?.[0]?.authorAttributions ?? [],
      attributions: place.attributions ?? [],
      // No kosher or suitability claim is inferred from Google's place data.
      verification: "unverified" as const,
    }));
    return NextResponse.json({ places, source: "google_places" }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "PLACES_UPSTREAM_ERROR" }, { status: 502, headers: noStore });
  }
}
