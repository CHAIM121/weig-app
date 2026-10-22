import { NextRequest, NextResponse } from "next/server";
import { searchOwn, presentOwn } from "@/modules/places/server/local";
import { googleFetch } from "@/modules/places/server/google";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim();
  const token = params.get("sessionToken") ?? "";
  if (q.length < 3 || q.length > 100 || !/^[a-f0-9-]{36}$/i.test(token)) return NextResponse.json({ error: "INVALID_SEARCH" }, { status: 400, headers });
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  if ((params.has("lat") !== params.has("lng")) || (params.has("lat") && (!params.get("lat") || !params.get("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180))) return NextResponse.json({ error: "INVALID_SEARCH" }, { status: 400, headers });
  try {
    const localParams = new URLSearchParams(params);
    localParams.delete("category"); localParams.delete("page");
    const local = (await searchOwn(localParams)).map(presentOwn);
    if (local.length >= 3 || !process.env.GOOGLE_PLACES_API_KEY) return NextResponse.json({ places: local }, { headers });
    const response = await googleFetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY },
      body: JSON.stringify({ input: q, sessionToken: token, languageCode: params.get("locale") === "en" ? "en" : "he", ...(params.has("lat") ? { locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } } } : {}) }),
    });
    if (!response.ok) throw new Error("AUTOCOMPLETE_UNAVAILABLE");
    const body = await response.json() as { suggestions?: { placePrediction?: { placeId?: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }; text?: { text?: string } } }[] };
    const remote = (body.suggestions ?? []).flatMap(s => {
      const p = s.placePrediction;
      if (!p?.placeId || !/^[A-Za-z0-9_-]{5,200}$/.test(p.placeId) || local.some(l => l.id === p.placeId)) return [];
      return [{ id: p.placeId, name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "", address: p.structuredFormat?.secondaryText?.text ?? "", source: "google_places", photoName: null, photoCredits: [], attributions: [], mapsUrl: `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(p.placeId)}` }];
    });
    return NextResponse.json({ places: [...local, ...remote].slice(0, 8) }, { headers });
  } catch { return NextResponse.json({ error: "AUTOCOMPLETE_UNAVAILABLE" }, { status: 503, headers }); }
}
