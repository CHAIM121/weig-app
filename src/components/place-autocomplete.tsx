"use client";
import { useEffect, useId, useRef, useState } from "react";
import { getDictionary, type Locale } from "@/i18n/dictionaries";

export type PlaceSuggestion = { id: string; name: string; address: string; source: string; mapsUrl: string; image?: string | null; description?: string; theme?: "nature" | "heritage" | "family" | "food" | "other"; location?: { latitude: number; longitude: number } | null };
export function PlaceAutocomplete({ value, onChange, onSelect, onSearch, locale, center }: {
  value: string; onChange: (value: string) => void; onSelect: (place: PlaceSuggestion, token?: string) => void;
  onSearch: () => void; locale: Locale; center: { lat: number; lng: number } | null;
}) {
  const copy = getDictionary(locale);
  const [choices, setChoices] = useState<PlaceSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const session = useRef<string | null>(null);
  const listId = useId();
  const lat = center?.lat, lng = center?.lng;
  useEffect(() => {
    setChoices([]); setActive(-1);
    if (!focused || value.trim().length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      session.current ??= crypto.randomUUID();
      const params = new URLSearchParams({ q: value.trim(), locale, sessionToken: session.current });
      if (lat != null && lng != null) { params.set("lat", String(lat)); params.set("lng", String(lng)); }
      fetch(`/api/places/autocomplete?${params}`, { signal: controller.signal, cache: "no-store" })
        .then(async response => { if (!response.ok) throw new Error("Unavailable"); return response.json(); })
        .then(body => { if (!controller.signal.aborted) setChoices(body.places ?? []); }).catch(() => {});
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [value, locale, lat, lng, focused]);
  function choose(place: PlaceSuggestion) {
    const token = place.source === "google_places" ? session.current ?? undefined : undefined;
    session.current = null; setChoices([]); setFocused(false); onSelect(place, token);
  }
  return <div className="weig-autocomplete">
    <input value={value} role="combobox" aria-label={copy.places.search} placeholder={copy.placeSearch.placeholder} aria-autocomplete="list" aria-controls={listId} aria-expanded={focused && choices.length > 0} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); session.current = null; }}
      onChange={e => onChange(e.target.value)} onKeyDown={e => {
        if (e.key === "Escape") { setFocused(false); session.current = null; }
        if (e.key === "ArrowDown" && choices.length) { e.preventDefault(); setActive(i => (i + 1) % choices.length); }
        if (e.key === "ArrowUp" && choices.length) { e.preventDefault(); setActive(i => (i + choices.length - 1) % choices.length); }
        if (e.key === "Enter") { e.preventDefault(); if (active >= 0 && choices[active]) choose(choices[active]); else { setFocused(false); session.current = null; onSearch(); } }
      }}/>
    {focused && choices.length > 0 && <ul id={listId} role="listbox" aria-label={copy.placeSearch.suggestions}>
      {choices.map((p, i) => <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseDown={e => e.preventDefault()} onClick={() => choose(p)}><strong>{p.name}</strong><small>{p.address}</small></li>)}
      {choices.some(p => p.source === "google_places") && <li role="presentation" className="weig-autocomplete-attribution"><span translate="no">Google Maps</span></li>}
    </ul>}
  </div>;
}
