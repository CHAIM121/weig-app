"use client";

import { useState } from "react";
import type { Coordinates } from "@/modules/places/travel";

type MapPlace = { id: string; he: string; en: string; areaHe: string; areaEn: string; mapsUrl?: string; location?: Coordinates | null };

export function GooglePlacesMap({ places, he, center, city, onSelect }: {
  places: MapPlace[];
  he: boolean;
  center: { lat: number; lng: number } | null;
  city: string;
  onSelect: (place: MapPlace) => void;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focused = places.find(place => place.id === focusedId) ?? places[0];
  const query = focused
    ? `${he ? focused.he : focused.en} ${he ? focused.areaHe : focused.areaEn}`
    : city.trim() || (center ? `${center.lat},${center.lng}` : "Israel");
  const parameters = new URLSearchParams({ q: query, output: "embed", hl: he ? "he" : "en" });

  return <section className="weig-catalog-map">
    <iframe
      title={he ? "מפת Google Maps" : "Google Maps"}
      src={`https://maps.google.com/maps?${parameters}`}
      style={{ width: "100%", height: "min(65vh,580px)", minHeight: 340, border: 0, borderRadius: 20 }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
    {focused && <button type="button" onClick={() => onSelect(focused)}>
      {he ? `פרטי המקום: ${focused.he}` : `Place details: ${focused.en}`}
    </button>}
    <p>{he ? "בחרו מקום מהרשימה כדי להציג אותו במפה." : "Select a place below to show it on the map."}</p>
    <div className="discover-chips" aria-label={he ? "מקומות במפה" : "Places on the map"}>
      {places.map(place => <button type="button" key={place.id}
        aria-pressed={focused?.id === place.id} onClick={() => setFocusedId(place.id)}>
        {he ? place.he : place.en}
      </button>)}
    </div>
  </section>;
}
