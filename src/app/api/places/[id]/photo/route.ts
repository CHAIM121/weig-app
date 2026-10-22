import { NextRequest, NextResponse } from "next/server";
import { ownPlace } from "@/modules/places/server/local";
import { googleFetch } from "@/modules/places/server/google";
import { GET as photo } from "../../photo/route";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{5,200}$/.test(id)) return NextResponse.json({ error: "INVALID_PLACE" }, { status: 400, headers });
  try {
    const own = await ownPlace(id);
    const ownPhoto = own?.photos.find(url => url.startsWith("https://"));
    if (ownPhoto) return NextResponse.redirect(ownPhoto, { headers });
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) return NextResponse.json({ error: "PHOTO_UNAVAILABLE" }, { status: 503, headers });
    const response = await googleFetch(`https://places.googleapis.com/v1/places/${id}`, { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,photos" } });
    if (!response.ok) throw new Error("Unavailable");
    const body = await response.json() as { id?: string; photos?: { name?: string }[] };
    if (body.id !== id || !body.photos?.[0]?.name) return NextResponse.json({ error: "PHOTO_UNAVAILABLE" }, { status: 404, headers });
    const url = new URL(request.url);
    url.searchParams.set("name", body.photos[0].name);
    return photo(new NextRequest(url));
  } catch { return NextResponse.json({ error: "PHOTO_UNAVAILABLE" }, { status: 502, headers }); }
}
