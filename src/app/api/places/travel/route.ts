import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Point = { latitude: number; longitude: number };
const validPoint = (point: unknown): point is Point => {
  if (!point || typeof point !== "object") return false;
  const { latitude, longitude } = point as Record<string, unknown>;
  return typeof latitude === "number" && latitude >= 29.4 && latitude <= 33.4
    && typeof longitude === "number" && longitude >= 34.2 && longitude <= 35.95;
};

export async function POST(request: NextRequest) {
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "INVALID_ROUTE" }, { status: 400 }); }
  const { origin, destinations } = payload as { origin?: unknown; destinations?: unknown };
  if (!validPoint(origin) || !Array.isArray(destinations) || destinations.length < 1 || destinations.length > 12 || !destinations.every(validPoint)) {
    return NextResponse.json({ error: "INVALID_ROUTE" }, { status: 400 });
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ error: "ROUTES_UNAVAILABLE" }, { status: 503 });
  try {
    const waypoint = (point: Point) => ({ waypoint: { location: { latLng: point } } });
    const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "destinationIndex,status,condition,distanceMeters,duration" },
      body: JSON.stringify({ origins: [waypoint(origin)], destinations: destinations.map(waypoint), travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE" }),
    });
    if (!response.ok) {
      console.error("[places/travel] Routes API unavailable", response.status);
      return NextResponse.json({ error: "ROUTES_UNAVAILABLE" }, { status: 503 });
    }
    const elements = await response.json() as { destinationIndex?: number; condition?: string; status?: { code?: number }; distanceMeters?: number; duration?: string }[];
    const routes = destinations.map((_, index) => {
      const item = elements.find(element => element.destinationIndex === index);
      const seconds = Number(item?.duration?.replace(/s$/, ""));
      return item?.condition === "ROUTE_EXISTS" && !item.status?.code && Number.isFinite(item.distanceMeters) && Number.isFinite(seconds)
        ? { distanceKm: Math.round(item.distanceMeters! / 100) / 10, minutes: Math.max(1, Math.round(seconds / 60)) } : null;
    });
    return NextResponse.json({ routes }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error("[places/travel] request failed", String(error));
    return NextResponse.json({ error: "ROUTES_UNAVAILABLE" }, { status: 503 });
  }
}
