import "server-only";
import { placesDatabase } from "./database";

export const categoryMap: Record<string, string> = {
  restaurants: "kosher_restaurant", bakeries: "cafe_bakery", groceries: "grocery_takeout",
  synagogues: "synagogue", tombs: "tzadik_grave", mikvaot: "mikveh", chabad: "chabad_house",
  nature: "nature_trail", family: "family_attraction", parks: "park_viewpoint", beaches: "beach_spring",
  stays: "hotel_tzimmer", transport: "transport_parking", essentials: "useful_services",
};
export function categoryId(value: string | null): string | null {
  return value && (categoryMap[value] ?? (Object.values(categoryMap).includes(value) ? value : null));
}
export type OwnPlace = {
  id: string; google_place_id: string; category: string; name_he: string; address_he: string | null;
  phone: string | null; website: string | null; opening_hours: { weekdayDescriptions?: string[] } | null;
  description_he: string | null; photos: string[]; verification_count: number; business_claimed: boolean;
  own_lat: number | null; own_lng: number | null;
};
export function presentOwn(p: OwnPlace) {
  return {
    id: p.google_place_id, name: p.name_he, address: p.address_he ?? "", phone: p.phone,
    location: p.own_lat != null && p.own_lng != null ? { latitude: p.own_lat, longitude: p.own_lng } : null,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(p.google_place_id)}`,
    photoName: null, photoCredits: [], attributions: [], source: "weig_owned" as const,
    description: p.description_he ?? "", image: p.photos[0] ?? null,
    // No new kosher/verification badge here: Phase 2 owns its evidence and recency rules.
    verification: "unverified" as const,
    theme: /restaurant|cafe|grocery/.test(p.category) ? "food" : /synagogue|grave|mikveh|chabad/.test(p.category) ? "heritage" : /attraction/.test(p.category) ? "family" : /trail|park|beach/.test(p.category) ? "nature" : "other",
  };
}
export async function ownPlace(id: string): Promise<OwnPlace | null> {
  const rows = await placesDatabase<OwnPlace[]>(`places?google_place_id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  return rows?.[0] ?? null;
}
export async function searchOwn(params: URLSearchParams): Promise<OwnPlace[]> {
  const lat = params.has("lat") ? Number(params.get("lat")) : null;
  const lng = params.has("lng") ? Number(params.get("lng")) : null;
  return await placesDatabase<OwnPlace[]>("rpc/weig_search_own_places", {
    p_query: (params.get("q") ?? params.get("query") ?? "").trim(), p_city: params.get("city") ?? "",
    p_category: params.get("feed") === "1" ? null : categoryId(params.get("category")),
    p_lat: lat, p_lng: lng, p_radius: Number(params.get("radius_m") ?? 5000),
    p_offset: Number(params.get("page") ?? 0) * 12,
  }) ?? [];
}
export async function saveCoordinates(places: { id?: string; location?: { latitude?: number; longitude?: number } }[], acquiredAt: string) {
  const rows = places.filter(p => p.id && Number.isFinite(p.location?.latitude) && Number.isFinite(p.location?.longitude))
    .map(p => ({ google_place_id: p.id!, lat: p.location!.latitude!, lng: p.location!.longitude! }));
  if (!rows.length) return;
  try { await placesDatabase("rpc/weig_cache_coordinates", { p_rows: rows, p_acquired_at: acquiredAt }, true); }
  catch { console.error("[places] coordinate write failed"); }
}
