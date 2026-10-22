import "server-only";
import { createHash } from "node:crypto";
import { placesDatabase } from "./database";

export const SEARCH_FIELDS = "places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.primaryType,places.formattedAddress,places.attributions,nextPageToken";
export const DETAIL_FIELDS = "id,displayName,formattedAddress,internationalPhoneNumber,websiteUri,regularOpeningHours,photos,rating,userRatingCount,location,attributions";

export function requestKey(url: string, init: RequestInit) {
  const headers = [...new Headers(init.headers).entries()].sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256").update(JSON.stringify([url, init.method ?? "GET", headers, init.body ?? null])).digest("hex");
}

// In-flight requests ONLY. A completed response is never retained, even in RAM.
// 500 bounds coalescing bookkeeping, not an LRU of completed Google content.
const pending = new Map<string, Promise<Response>>();
export async function googleFetch(url: string, init: RequestInit, sku = googleSku(url, init)): Promise<Response> {
  const key = requestKey(url, init);
  let operation = pending.get(key);
  if (!operation) {
    operation = (async () => {
      let status = 0;
      try {
        const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) });
        status = response.status;
        // Keep the request in flight through body consumption, not just headers.
        const bytes = await response.arrayBuffer();
        return new Response(response.status === 204 ? null : bytes, { status: response.status, headers: response.headers });
      } finally {
        console.info("[google]", { sku, cache_hit: false, status });
        try {
          await placesDatabase("rpc/weig_record_google_call", { p_sku: sku, p_failed: status < 200 || status >= 300 }, true);
        } catch { console.error("[google] metrics write failed", { sku }); }
      }
    })();
    if (pending.size < 500) {
      pending.set(key, operation);
      // Delete on success AND rejection without creating an unhandled rejected promise.
      void operation.then(() => pending.delete(key), () => pending.delete(key));
    }
  }
  return (await operation).clone();
}

export function googleSku(url: string, init: RequestInit) {
  const fields = new Headers(init.headers).get("X-Goog-FieldMask") ?? "";
  if (url.includes("/photos/")) return "place_photo";
  if (url.includes("places:autocomplete")) return "autocomplete_request";
  if (url.includes("routes.googleapis.com")) return "route_matrix";
  const isSearch = url.includes("searchText") || url.includes("searchNearby");
  const names = fields.split(",").map(field => field.replace(/^places\./, ""));
  const idsOnly = names.every(name => ["id", "name", "photos", "attributions", "nextPageToken"].includes(name));
  const tier = /reviews/.test(fields) ? "enterprise_atmosphere"
    : /rating|PhoneNumber|websiteUri|OpeningHours/.test(fields) ? "enterprise"
    : idsOnly ? "ids_only"
    : isSearch || /displayName|googleMapsUri|primaryType/.test(fields) ? "pro" : "essentials";
  return `${isSearch ? "text_search" : "place_details"}_${tier}`;
}
