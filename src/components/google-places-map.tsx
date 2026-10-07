"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, LocateFixed, Minimize, MapPin, X } from "lucide-react";
import type { Coordinates } from "@/modules/places/travel";

type MapPlace = { id: string; he: string; en: string; areaHe: string; areaEn: string; image?: string; credit?: string; mapsUrl?: string; location?: Coordinates | null; rating?: number | null; openNow?: boolean | null };
type Point = { lat: number; lng: number };
type Maps = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  Marker: new (options: Record<string, unknown>) => MarkerInstance;
  LatLngBounds: new () => { extend(point: Point): void };
  SymbolPath: { CIRCLE: unknown };
  event: { trigger(instance: MapInstance, name: string): void; clearInstanceListeners(instance: MapInstance | MarkerInstance): void };
};
type MapInstance = { fitBounds(bounds: unknown, padding?: unknown): void; panTo(point: Point): void; setZoom(zoom: number): void };
type MarkerInstance = { setMap(map: MapInstance | null): void; setIcon(icon: unknown): void; setZIndex(index: number): void; addListener(name: string, callback: () => void): void };
const browserMaps = () => (window as unknown as { google?: { maps?: Maps } }).google?.maps;
let mapsPromise: Promise<Maps> | null = null;
function loadMaps(key: string, he: boolean) {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<Maps>((resolve, reject) => {
    const existing = browserMaps();
    if (existing?.Map) { resolve(existing); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, language: he ? "he" : "en", loading: "async", callback: "weigMapReady" })}`;
    script.async = true;
    const target = window as unknown as { weigMapReady?: () => void };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error("Map timeout")); }, 15000);
    const cleanup = () => { window.clearTimeout(timer); delete target.weigMapReady; };
    target.weigMapReady = () => { const maps = browserMaps(); cleanup(); if (maps?.Map) resolve(maps); else reject(new Error("Map unavailable")); };
    script.onerror = () => { cleanup(); script.remove(); reject(new Error("Map unavailable")); };
    document.head.appendChild(script);
  }).catch(error => { mapsPromise = null; throw error; });
  return mapsPromise;
}
function point(place: MapPlace): Point | null {
  const location = place.location;
  return location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180
    ? { lat: location.latitude, lng: location.longitude } : null;
}

export function GooglePlacesMap({ places, he, center, city, onSelect }: {
  places: MapPlace[]; he: boolean; center: Point | null; city: string; onSelect: (place: MapPlace) => void;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mapState, setMapState] = useState<"loading" | "ready" | "fallback">("loading");
  const surface = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const map = useRef<MapInstance | null>(null);
  const markers = useRef(new Map<string, MarkerInstance>());
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (scrollTimer.current) clearTimeout(scrollTimer.current); }, []);
  const focused = places.find(place => place.id === focusedId) ?? places[0];
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const label = (a: string, b: string) => he ? a : b;

  useEffect(() => {
    if (!key) { setMapState("fallback"); return; }
    let disposed = false;
    loadMaps(key, he).then(maps => {
      if (disposed || !surface.current) return;
      map.current = new maps.Map(surface.current, { center: center ?? { lat: 31.77, lng: 35.21 }, zoom: 12, disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy", clickableIcons: false });
      setMapState("ready");
    }).catch(() => { if (!disposed) setMapState("fallback"); });
    return () => { disposed = true; if (map.current) browserMaps()?.event.clearInstanceListeners(map.current); map.current = null; };
    // Keep one map instance through searches and card selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const maps = browserMaps(), instance = map.current;
    if (mapState !== "ready" || !maps || !instance) return;
    const bounds = new maps.LatLngBounds();
    let count = 0;
    places.forEach((place, index) => {
      const position = point(place);
      if (!position) return;
      bounds.extend(position); count++;
      const marker = new maps.Marker({ map: instance, position, title: he ? place.he : place.en,
        label: { text: String(index + 1), color: "#ffffff", fontWeight: "700", fontSize: "14px" },
        icon: { path: maps.SymbolPath.CIRCLE, scale: 16, fillColor: "#2459e6", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 } });
      marker.addListener("click", () => setFocusedId(place.id));
      markers.current.set(place.id, marker);
    });
    if (count === 1) { const only = places.map(point).find(Boolean); if (only) { instance.panTo(only); instance.setZoom(15); } }
    else if (count > 1) instance.fitBounds(bounds, { top: 65, left: 45, right: 45, bottom: 175 });
    else if (center) instance.panTo(center);
    const currentMarkers = markers.current;
    return () => { currentMarkers.forEach(marker => { maps.event.clearInstanceListeners(marker); marker.setMap(null); }); currentMarkers.clear(); };
  }, [places, he, mapState, center]);

  useEffect(() => {
    if (!focused) return;
    const maps = browserMaps();
    markers.current.forEach((marker, id) => {
      const selected = id === focused.id;
      marker.setIcon({ path: maps?.SymbolPath.CIRCLE, scale: selected ? 21 : 16, fillColor: selected ? "#12264c" : "#2459e6", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 });
      marker.setZIndex(selected ? 1000 : 1);
    });
    const position = point(focused);
    if (focusedId && position) map.current?.panTo(position);
    const card = cards.current.get(focused.id);
    if (focusedId && card?.parentElement) {
      const parent = card.parentElement;
      parent.scrollBy({ left: card.getBoundingClientRect().left - parent.getBoundingClientRect().left - (parent.clientWidth - card.clientWidth) / 2, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [focused, focusedId, mapState]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
      if (event.key !== "Tab") return;
      const elements = panel.current?.querySelectorAll<HTMLElement>('button, a[href], iframe, [tabindex="0"]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); expandButton.current?.focus(); };
  }, [expanded]);

  useEffect(() => {
    const observer = new ResizeObserver(() => { if (map.current) browserMaps()?.event.trigger(map.current, "resize"); });
    if (surface.current) observer.observe(surface.current);
    return () => observer.disconnect();
  }, []);

  const query = focused ? `${he ? focused.he : focused.en} ${he ? focused.areaHe : focused.areaEn}` : city.trim() || (center ? `${center.lat},${center.lng}` : "Israel");
  return <section ref={panel} className={`weig-discovery-map${expanded ? " is-expanded" : ""}`} dir={he ? "rtl" : "ltr"}
    role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-label={label("מפת המקומות", "Places map")} tabIndex={-1}>
    <div ref={surface} className="weig-map-surface" />
    {mapState === "fallback" && <iframe className="weig-map-surface" title={label("מפת Google Maps", "Google Maps")}
      src={`https://maps.google.com/maps?${new URLSearchParams({ q: query, output: "embed", hl: he ? "he" : "en" })}`}
      referrerPolicy="no-referrer-when-downgrade" allowFullScreen />}
    {mapState === "loading" && <div className="weig-map-message" role="status">{label("טוענים מפה…", "Loading map…")}</div>}
    <div className="weig-map-controls">
      <button ref={expandButton} type="button" aria-label={expanded ? label("סגירת מסך מלא", "Close full screen") : label("מפה במסך מלא", "Full screen map")} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize size={20}/> : <Expand size={20}/>}</button>
      {mapState === "ready" && center && <button type="button" aria-label={label("המיקום שלי", "My location")} onClick={() => { map.current?.panTo(center); map.current?.setZoom(14); }}><LocateFixed size={20}/></button>}
    </div>
    {places.length === 0 ? <div className="weig-map-empty"><MapPin size={24}/><span>{label("אין מקומות להצגה. נסו חיפוש או אזור אחר.", "No places to show. Try another search or area.")}</span></div> : <>
      <div className="weig-map-count">{places.length} {label("מקומות", "places")}</div>
      <div className="weig-map-cards" onScroll={event => {
        const rail = event.currentTarget;
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => {
          const bounds = rail.getBoundingClientRect();
          const middle = bounds.left + bounds.width / 2;
          let nearest: string | null = null, distance = Infinity;
          cards.current.forEach((card, id) => {
            const rect = card.getBoundingClientRect();
            const next = Math.abs(rect.left + rect.width / 2 - middle);
            if (next < distance) { nearest = id; distance = next; }
          });
          if (nearest) setFocusedId(nearest);
        }, 180);
      }} aria-label={label("מקומות במפה", "Places on the map")}>
        {places.map((place, index) => <div key={place.id} className={`weig-map-card${focused?.id === place.id ? " is-selected" : ""}`}>
          <button ref={node => { if (node) cards.current.set(place.id, node); else cards.current.delete(place.id); }} type="button" className="weig-map-card-select" aria-label={`${he ? place.he : place.en} ${he ? place.areaHe : place.areaEn} ${index + 1}`} aria-pressed={focused?.id === place.id} onClick={() => setFocusedId(place.id)}>
            {place.image && <img src={place.image} alt="" loading="lazy"/>}
            <span className="weig-map-card-copy"><strong>{he ? place.he : place.en}</strong><span>{he ? place.areaHe : place.areaEn}</span>
              {place.rating != null && <span dir="ltr">★ {place.rating}</span>}
              {place.openNow != null && <span className={place.openNow ? "is-open" : "is-closed"}>{place.openNow ? label("פתוח עכשיו", "Open now") : label("סגור עכשיו", "Closed now")}</span>}
              {place.credit && <small>{place.credit}</small>}
            </span><span className="weig-map-card-number">{index + 1}</span>
          </button>
          <button type="button" className="weig-map-card-details" onClick={() => { setExpanded(false); onSelect(place); }} aria-label={`${label("פרטים על", "Details for")} ${he ? place.he : place.en}`}>{label("פרטי המקום", "Place details")}</button>
        </div>)}
      </div>
      <span className="weig-map-sr-status" role="status" aria-live="polite">{focused && (he ? focused.he : focused.en)}</span>
    </>}
    {expanded && <button type="button" className="weig-map-close" onClick={() => setExpanded(false)} aria-label={label("סגירת המפה", "Close map")}><X size={20}/></button>}
  </section>;
}
