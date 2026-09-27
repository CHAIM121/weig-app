import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "";
  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) {
    return NextResponse.json({ error: "INVALID_PHOTO" }, { status: 400 });
  }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "PLACES_NOT_CONFIGURED" }, { status: 503 });
  try {
    const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&skipHttpRedirect=true&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8500) });
    if (!response.ok) throw new Error("Photo unavailable");
    const data = await response.json() as { photoUri?: string };
    if (!data.photoUri || !/^https:\/\//.test(data.photoUri)) throw new Error("Invalid photo URL");
    return NextResponse.redirect(data.photoUri, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "PHOTO_UNAVAILABLE" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
