import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

type Review = {
  rating?: number;
  text?: { text?: string };
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  googleMapsUri?: string;
  relativePublishTimeDescription?: string;
};

type Details = {
  id?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  googleMapsUri?: string;
  reviews?: Review[];
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{5,200}$/.test(id)) {
    return NextResponse.json({ error: "INVALID_PLACE" }, { status: 400, headers: noStore });
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ error: "PLACES_NOT_CONFIGURED" }, { status: 503, headers: noStore });

  const reviews = params.get("reviews") === "1";
  const fields = "id,nationalPhoneNumber,websiteUri,rating,userRatingCount,currentOpeningHours,googleMapsUri" + (reviews ? ",reviews" : "");
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=${params.get("locale") === "en" ? "en" : "he"}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields },
      cache: "no-store",
      signal: AbortSignal.timeout(8500),
    });
    if (!response.ok) return NextResponse.json({ error: "PLACES_UPSTREAM_ERROR" }, { status: 502, headers: noStore });
    const place = await response.json() as Details;
    if (place.id !== id) return NextResponse.json({ error: "PLACES_UPSTREAM_ERROR" }, { status: 502, headers: noStore });
    return NextResponse.json({
      phone: place.nationalPhoneNumber ?? null,
      website: place.websiteUri?.startsWith("https://") ? place.websiteUri : null,
      rating: place.rating ?? null,
      ratingCount: place.userRatingCount ?? null,
      openNow: place.currentOpeningHours?.openNow ?? null,
      hours: place.currentOpeningHours?.weekdayDescriptions ?? [],
      mapsUrl: place.googleMapsUri ?? null,
      ...(reviews ? { reviews: (place.reviews ?? []).slice(0, 5).map(review => ({
        rating: review.rating ?? null,
        text: review.text?.text ?? "",
        author: review.authorAttribution?.displayName ?? "",
        authorUrl: review.authorAttribution?.uri ?? null,
        authorPhoto: review.authorAttribution?.photoUri ?? null,
        mapsUrl: review.googleMapsUri ?? place.googleMapsUri ?? null,
        when: review.relativePublishTimeDescription ?? "",
      })) } : {}),
      source: "google_places",
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "PLACES_UPSTREAM_ERROR" }, { status: 502, headers: noStore });
  }
}
