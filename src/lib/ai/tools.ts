import { googleFetch } from "@/modules/places/server/google";
export type Citation = { start: number; end: number; url: string; title: string };
type OutputPart = { type: string; text?: string; annotations?: { type: string; start_index: number; end_index: number; url: string; title: string }[] };
export type OutputItem = { type?: string; name?: string; call_id?: string; arguments?: string; content?: OutputPart[] };
export const placeSearchTool = {
 type: "function", name: "search_places", description: "Search WEIG's Google Places provider for places worldwide. Include the city/area in the query; never assume the user's location. Results include current hours, addresses and Google ratings, not kosher certification.", strict: true,
 parameters: { type: "object", properties: { query: { type: "string", description: "Specific place or type and city/area, e.g. family parks in Jerusalem" } }, required: ["query"], additionalProperties: false },
};
export async function searchPlaces(argumentsJson: string, locale: string, signal: AbortSignal) {
 let query: unknown;
 try { query = JSON.parse(argumentsJson).query; } catch { return { error: "INVALID_QUERY" }; }
 if (typeof query !== "string" || query.trim().length < 2 || query.length > 200) return { error: "INVALID_QUERY" };
 const key = process.env.GOOGLE_PLACES_API_KEY;
 if (!key) return { error: "PLACES_NOT_CONFIGURED" };
 try {
  const response = await googleFetch("https://places.googleapis.com/v1/places:searchText", {
   method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.googleMapsUri,places.websiteUri" },
   body: JSON.stringify({ textQuery: query.trim(), languageCode: locale, pageSize: 5 }), cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
  });
  if (!response.ok) return { error: "PLACES_UNAVAILABLE" };
  const result = await response.json();
  return { source: "Google Places", checkedAt: new Date().toISOString(), places: result.places ?? [] };
 } catch { return { error: "PLACES_UNAVAILABLE" }; }
}
export function extractAnswer(output: OutputItem[]) {
 let answer = ""; const citations: Citation[] = [];
 for (const item of output) for (const part of item.content ?? []) {
  if (part.type !== "output_text" || typeof part.text !== "string") continue;
  if (answer) answer += "\n";
  const offset = answer.length; answer += part.text;
  for (const ref of part.annotations ?? []) {
   if (ref.type !== "url_citation" || !/^https?:\/\//i.test(ref.url) || !Number.isInteger(ref.start_index) || !Number.isInteger(ref.end_index) || ref.start_index < 0 || ref.end_index <= ref.start_index || ref.end_index > part.text.length) continue;
   citations.push({ start: offset + ref.start_index, end: offset + ref.end_index, url: ref.url, title: ref.title });
  }
 }
 return { answer, citations };
}
