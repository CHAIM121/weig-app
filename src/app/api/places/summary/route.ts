import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{5,200}$/.test(id)) {
    return NextResponse.json({ error: "INVALID_PLACE" }, { status: 400, headers });
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ error: "PLACES_NOT_CONFIGURED" }, { status: 503, headers });

  try {
    const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "he";
    const response = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=${locale}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,displayName,formattedAddress,location,googleMapsUri,photos,attributions,addressComponents" },
      cache: "no-store",
      signal: AbortSignal.timeout(8500),
    });
    if (!response.ok) return NextResponse.json({ error: "PLACES_UPSTREAM_ERROR" }, { status: 502, headers });
    const place = await response.json() as {
      id?: string; displayName?: { text?: string }; formattedAddress?: string;
      location?: { latitude?: number; longitude?: number }; googleMapsUri?: string;
      photos?: { name?: string; authorAttributions?: { displayName?: string; uri?: string }[] }[];
      attributions?: { provider?: string; providerUri?: string }[];
      addressComponents?: { types?: string[]; shortText?: string }[];
    };
    const country = place.addressComponents?.find(component => component.types?.includes("country"))?.shortText;
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    if (place.id !== id || !place.displayName?.text || (country && country !== "IL")
      || (lat != null && lng != null && (lat < 29.4 || lat > 33.4 || lng < 34.2 || lng > 35.95))) {
      return NextResponse.json({ error: "PLACE_NOT_FOUND" }, { status: 404, headers });
    }
    return NextResponse.json({ place: {
      id, name: place.displayName.text, address: place.formattedAddress ?? "",
      location: lat != null && lng != null ? { latitude: lat, longitude: lng } : null,
      mapsUrl: place.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(id)}`,
      photoName: place.photos?.[0]?.name ?? null,
      photoCredits: place.photos?.[0]?.authorAttributions ?? [],
      attributions: place.attributions ?? [],
    } }, { headers });
  } catch {
    return NextResponse.json({ error: "PLACES_UPSTREAM_ERROR" }, { status: 502, headers });
  }
}
