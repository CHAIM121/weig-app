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
const fieldMask = "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.photos,places.attributions,places.addressComponents,places.primaryType,nextPageToken";
const themes = [
  { he: "מסלולי טבע ופארקים", en: "nature trails and parks" },
  { he: "בתי כנסת ובתי חב״ד", en: "synagogues and Chabad centers" },
  { he: "אטרקציות למשפחות", en: "family attractions" },
  { he: "מסעדות כשרות", en: "kosher restaurants" },
] as const;
const moreThemes = [
  [{ he: "מעיינות ותצפיות", en: "springs and viewpoints" }, { he: "קברי צדיקים ואתרי מורשת", en: "Jewish heritage sites" }, { he: "מוזיאונים וגני חיות", en: "museums and zoos" }, { he: "בתי קפה ומאפיות כשרות", en: "kosher cafes and bakeries" }],
  [{ he: "גנים לאומיים ושמורות", en: "national parks and nature reserves" }, { he: "בתי כנסת עתיקים", en: "historic synagogues" }, { he: "אטרקציות ופעילויות לילדים", en: "kids activities" }, { he: "סופרים ואוכל מוכן", en: "grocery and prepared food" }],
  [{ he: "מסלולי הליכה ונוף", en: "hiking trails and scenic places" }, { he: "אתרים היסטוריים", en: "historic sites" }, { he: "פארקי מים ופעילויות", en: "water parks and activities" }, { he: "מסעדות ובתי אוכל כשרים", en: "kosher dining" }],
  [{ he: "פארקים ומקומות לטייל", en: "parks and places to visit" }, { he: "מרכזי תרבות ומורשת", en: "culture and heritage" }, { he: "אטרקציות למשפחות", en: "family attractions" }, { he: "מסעדות כשרות", en: "kosher restaurants" }],
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

function present(place: GooglePlace, locale: string, theme?: "nature" | "heritage" | "family" | "food") {
  const address = place.formattedAddress ?? "";
  const areaOnly = address && !/[\d,،]/.test(address) && !/^(ישראל|Israel)$/.test(address);
  return {
    id: place.id,
    name: place.displayName?.text,
    address: areaOnly ? (locale === "he" ? `אזור ${address}` : `${address} area`) : address,
    mapsUrl: place.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(place.id!)}`,
    location: place.location ?? null,
    photoName: place.photos?.[0]?.name ?? null,
    photoCredits: place.photos?.[0]?.authorAttributions ?? [],
    attributions: place.attributions ?? [],
    theme: theme ?? (/restaurant|cafe|bakery|food|grocery/.test(place.primaryType ?? "") ? "food" : /museum|amusement|zoo/.test(place.primaryType ?? "") ? "family" : /synagogue|religious|historic/.test(place.primaryType ?? "") ? "heritage" : /park|natural|tourist_attraction/.test(place.primaryType ?? "") ? "nature" : "other"),
    verification: "unverified" as const,
  };
}

async function search(key: string, textQuery: string, locale: string, center: Center | null, pageSize: number, distanceRank = false, radius = 15000, pageToken?: string) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fieldMask },
    body: JSON.stringify({
      textQuery, languageCode: locale, regionCode: "IL", pageSize,
      ...(center ? { locationBias: { circle: { center, radius } } } : {}),
      ...(distanceRank ? { rankPreference: "DISTANCE" } : {}),
      ...(pageToken ? { pageToken } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8500),
  });
  if (!response.ok) throw new Error(`PLACES_UPSTREAM_${response.status}`);
  return (await response.json()) as { places?: GooglePlace[]; nextPageToken?: string };
}

async function discovery(key: string, locale: string, city: string, center: Center | null, recent: string[], seenIds: string[], page: number, prefer: string | null) {
  const radius = [30, 30, 55, 90, 150, 250][page] ?? 250;
  const discoveryThemes = page < 2 ? themes : moreThemes[Math.min(page - 2, moreThemes.length - 1)];
  const results = await Promise.allSettled(discoveryThemes.map(theme =>
    search(key, `${locale === "he" ? theme.he : theme.en} ${center ? "" : `ב${city} ישראל`}`.trim(), locale, center, 20, !!center, Math.min(radius, 50) * 1000)
  ));
  if (results.every(result => result.status === "rejected")) throw new Error(`DISCOVERY_UPSTREAM_${results.map(result => result.status === "rejected" ? String(result.reason) : "ok").join("_")}`);
  const candidates = results.flatMap(result => result.status === "fulfilled" ? result.value.places ?? [] : []);
  const nearbyCount = new Set(candidates.filter(place => validPlace(place) && center && distanceKm(center, place.location) <= 15).map(place => place.id)).size;
  const localRadius = page === 0 && nearbyCount >= 12 ? 15 : radius;
  const groups = results.map(result => result.status === "fulfilled"
    ? (result.value.places ?? []).filter(place => validPlace(place) && (!center || distanceKm(center, place.location) <= localRadius)).map((place, rank) => ({ place, rank }))
      .sort((a, b) => center
        ? (a.rank + distanceKm(center, a.place.location) / 3)
          - (b.rank + distanceKm(center, b.place.location) / 3)
        : a.rank - b.rank)
      .map(item => item.place)
    : []);
  const recentOrder = new Map(recent.map((id, index) => [id, index]));
  // Keep each theme represented, but prefer places that were not shown on recent visits.
  const ordered = groups.map(group => group.sort((a, b) =>
    (recentOrder.has(a.id!) ? 1 : 0) - (recentOrder.has(b.id!) ? 1 : 0)
      || (recentOrder.get(b.id!) ?? 0) - (recentOrder.get(a.id!) ?? 0)));
  const picked: GooglePlace[] = [];
  const pickedThemes: ("nature" | "heritage" | "family" | "food")[] = [];
  const seen = new Set(seenIds);
  const themeIds = ["nature", "heritage", "family", "food"] as const;
  const favored = themeIds.findIndex(theme => theme === prefer);
  const schedule = favored < 0 ? [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]
    : [0, 1, 2, 3, favored, 0, 1, 2, 3, favored, favored, favored];
  const pointers = [0, 0, 0, 0];
  const take = (index: number) => {
    const group = ordered[index];
    while (pointers[index] < group.length && seen.has(group[pointers[index]].id!)) pointers[index]++;
    const item = group[pointers[index]++];
    if (!item?.id) return false;
    picked.push(item); pickedThemes.push(themeIds[index]); seen.add(item.id);
    return true;
  };
  for (const index of schedule) if (!take(index)) for (let alternative = 0; alternative < 4; alternative++) if (take(alternative)) break;
  return { places: picked.map((place, index) => present(place, locale, pickedThemes[index])), hasMore: page < 5 };
}

export async function GET(request: NextRequest) {
  if(request.nextUrl.searchParams.get("source")==="weig")return NextResponse.json({error:"CATALOG_DISABLED"},{status:410,headers:noStore});
  const params = request.nextUrl.searchParams;
  const category = findCategory(params.get("category") ?? "");
  const query = (params.get("query") ?? "").trim();
  const city = (params.get("city") ?? "").trim();
  const locale = params.get("locale") === "en" ? "en" : "he";
  const feed = params.get("feed") === "1";
  const prefer = ["nature", "heritage", "family", "food"].includes(params.get("prefer") ?? "") ? params.get("prefer") : null;
  const recent = (params.get("recent") ?? "").split(",").filter(id => /^[\w-]{1,150}$/.test(id)).slice(0, 48);
  const seen = (params.get("seen") ?? "").split(",").filter(id => /^[\w-]{1,150}$/.test(id)).slice(0, 100);
  const page = Number(params.get("page") ?? 0);
  const pageToken = params.get("pageToken") ?? "";
  if (!Number.isInteger(page) || page < 0 || page > 5 || pageToken.length > 1000) return NextResponse.json({ error: "INVALID_SEARCH" }, { status: 400, headers: noStore });
  if ((!feed && !category && query.length < 2) || query.length > 100 || city.length > 60 || (!city && !(params.has("lat") && params.has("lng")))) {
    return NextResponse.json({ error: "INVALID_SEARCH" }, { status: 400, headers: noStore });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "PLACES_NOT_CONFIGURED" }, { status: 503, headers: noStore });

  const rawLat = Number(params.get("lat"));
  const rawLng = Number(params.get("lng"));
  const useLocation = params.has("lat") && params.has("lng") && Number.isFinite(rawLat) && Number.isFinite(rawLng) && israelBounds(rawLat, rawLng);
  const center = useLocation ? { latitude: rawLat, longitude: rawLng } : null;
  if (!center && !city) return NextResponse.json({ error: "LOCATION_REQUIRED" }, { status: 400, headers: noStore });

  try {
    let areaCenter = center;
    if (!areaCenter && city && !query) {
      const cityResults = (await search(apiKey, `${city} ישראל`, locale, null, 5)).places ?? [];
      const normalizedCity = city.toLocaleLowerCase().replace(/[\s־–-]+/g, " ").trim();
      const match = cityResults.find(place => place.primaryType === "locality"
        && place.displayName?.text?.toLocaleLowerCase().replace(/[\s־–-]+/g, " ").startsWith(normalizedCity)
        && place.location?.latitude != null && place.location.longitude != null
        && israelBounds(place.location.latitude, place.location.longitude));
      if (match) areaCenter = match.location as Center;
      else if (feed) return NextResponse.json({ places: [], hasMore: false, source: "google_places" }, { headers: noStore });
    }
    if (feed && !query) return NextResponse.json({ ...await discovery(apiKey, locale, city, areaCenter, recent, seen, page, prefer), source: "google_places" }, { headers: noStore });
    const term = query || (locale === "he" ? category?.searchHe : category?.searchEn) || "";
    const searchResult = await search(apiKey, `${term} ${query ? "" : areaCenter ? "" : `ב${city} ישראל`}`.trim(), locale, areaCenter, 12, false, 15000, pageToken || undefined);
    const matches = searchResult.places ?? [];
    const first = matches[0];
    const normalized = (value: string) => value.toLocaleLowerCase().replace(/[\s־–-]+/g, " ").trim();
    const cityResult = first && (first.primaryType === "locality"
      || normalized(first.formattedAddress ?? "") === normalized(first.displayName?.text ?? ""));
    if (feed && query && cityResult && first.location?.latitude != null && first.location.longitude != null
      && israelBounds(first.location.latitude, first.location.longitude)
      && normalized(first.displayName?.text ?? "").startsWith(normalized(query))) {
      return NextResponse.json({ ...await discovery(apiKey, locale, city, first.location as Center, recent, seen, page, prefer), source: "google_places" }, { headers: noStore });
    }
    return NextResponse.json({ places: matches.filter(place => validPlace(place) && (!areaCenter || !!query || distanceKm(areaCenter, place.location) <= 30) && !seen.includes(place.id!)).map(place => present(place, locale)), nextPageToken: searchResult.nextPageToken ?? null, hasMore: !!searchResult.nextPageToken, source: "google_places" }, { headers: noStore });
  } catch (error) {
    console.error("[places/search] request failed", { feed, page, category: category?.id ?? "all", error: String(error) });
    return NextResponse.json({ error: "PLACES_UPSTREAM_ERROR" }, { status: 502, headers: noStore });
  }
}
