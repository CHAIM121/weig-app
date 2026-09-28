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
  primaryType?: string;
};

const noStore = { "Cache-Control": "no-store" };
const israelBounds = (lat: number, lng: number) => lat >= 29.4 && lat <= 33.4 && lng >= 34.2 && lng <= 35.95;
const fieldMask = "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.photos,places.attributions,places.addressComponents,places.primaryType";
const themes = [
  { he: "מסלולי טבע ופארקים", en: "nature trails and parks" },
  { he: "בתי כנסת ובתי חב״ד", en: "synagogues and Chabad centers" },
  { he: "אטרקציות למשפחות", en: "family attractions" },
  { he: "מסעדות כשרות", en: "kosher restaurants" },
] as const;
type Center = { latitude: number; longitude: number };

function distanceKm(a: Center, b?: { latitude?: number; longitude?: number }) {
  if (b?.latitude == null || b.longitude == null) return 100;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

function validPlace(place: GooglePlace) {
  if (!place.id || !place.displayName?.text) return false;
  const country = place.addressComponents?.find(component => component.types?.includes("country"))?.shortText;
  if (country && country !== "IL") return false;
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  return (typeof lat !== "number" || typeof lng !== "number" || israelBounds(lat, lng));
}

function present(place: GooglePlace) {
  return {
    id: place.id,
    name: place.displayName?.text,
    address: place.formattedAddress ?? "",
    mapsUrl: place.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(place.id!)}`,
    location: place.location ?? null,
    photoName: place.photos?.[0]?.name ?? null,
    photoCredits: place.photos?.[0]?.authorAttributions ?? [],
    attributions: place.attributions ?? [],
    verification: "unverified" as const,
  };
}

async function search(key: string, textQuery: string, locale: string, center: Center | null, pageSize: number) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fieldMask },
    body: JSON.stringify({
      textQuery, languageCode: locale, regionCode: "IL", pageSize,
      ...(center ? { locationBias: { circle: { center, radius: 15000 } } } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8500),
  });
  if (!response.ok) throw new Error("PLACES_UPSTREAM_ERROR");
  return ((await response.json()) as { places?: GooglePlace[] }).places ?? [];
}

async function discovery(key: string, locale: string, city: string, center: Center | null) {
  const results = await Promise.allSettled(themes.map(theme =>
    search(key, `${locale === "he" ? theme.he : theme.en} ${center ? "ישראל" : `ב${city} ישראל`}`, locale, center, 8)
  ));
  if (results.every(result => result.status === "rejected")) throw new Error("PLACES_UPSTREAM_ERROR");
  const groups = results.map(result => result.status === "fulfilled"
    ? result.value.filter(validPlace).map((place, rank) => ({ place, rank }))
      .sort((a, b) => center
        ? (a.rank + Math.min(distanceKm(center, a.place.location), 30) / 3)
          - (b.rank + Math.min(distanceKm(center, b.place.location), 30) / 3)
        : a.rank - b.rank)
      .map(item => item.place)
    : []);
  const picked: GooglePlace[] = [];
  const seen = new Set<string>();
  for (let pass = 0; pass < 8 && picked.length < 12; pass++) {
    for (const group of groups) {
      const item = group[pass];
      if (item?.id && !seen.has(item.id)) { picked.push(item); seen.add(item.id); }
      if (picked.length === 12) break;
    }
  }
  return picked.map(present);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = findCategory(params.get("category") ?? "");
  const query = (params.get("query") ?? "").trim();
  const city = (params.get("city") ?? "ירושלים").trim();
  const locale = params.get("locale") === "en" ? "en" : "he";
  const feed = params.get("feed") === "1";
  if ((!feed && !category && query.length < 2) || query.length > 100 || city.length > 60 || !city) {
    return NextResponse.json({ error: "INVALID_SEARCH" }, { status: 400, headers: noStore });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "PLACES_NOT_CONFIGURED" }, { status: 503, headers: noStore });

  const rawLat = Number(params.get("lat"));
  const rawLng = Number(params.get("lng"));
  const useLocation = params.has("lat") && params.has("lng") && Number.isFinite(rawLat) && Number.isFinite(rawLng) && israelBounds(rawLat, rawLng);
  const center = useLocation ? { latitude: rawLat, longitude: rawLng } : null;

  try {
    if (feed && !query) return NextResponse.json({ places: await discovery(apiKey, locale, city, center), source: "google_places" }, { headers: noStore });
    const term = query || (locale === "he" ? category?.searchHe : category?.searchEn) || "";
    const matches = await search(apiKey, `${term} ${query ? "" : center ? "" : `ב${city}`} ישראל`.trim(), locale, center, 12);
    const first = matches[0];
    const normalized = (value: string) => value.toLocaleLowerCase().replace(/[\s־–-]+/g, " ").trim();
    if (feed && query && first?.primaryType === "locality" && first.location?.latitude != null && first.location.longitude != null
      && israelBounds(first.location.latitude, first.location.longitude)
      && normalized(first.displayName?.text ?? "").startsWith(normalized(query))) {
      return NextResponse.json({ places: await discovery(apiKey, locale, city, first.location as Center), source: "google_places" }, { headers: noStore });
    }
    return NextResponse.json({ places: matches.filter(validPlace).map(present), source: "google_places" }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "PLACES_UPSTREAM_ERROR" }, { status: 502, headers: noStore });
  }
}
