"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, LocateFixed, Minimize, MapPin, Star, X } from "lucide-react";
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

export function GooglePlacesMap({ places, he, center, city, onSelect, travel }: {
  places: MapPlace[]; he: boolean; center: Point | null; city: string; onSelect: (place: MapPlace) => void; travel?: (place: MapPlace) => string | null;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mapState, setMapState] = useState<"loading" | "ready" | "fallback">("loading");
  const [ratings, setRatings] = useState<Record<string, number | null>>({});
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [embedCenter, setEmbedCenter] = useState<Point | null>(null);
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
    if (!focused?.mapsUrl || focused.rating != null || focused.id in ratings) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/places/details?${new URLSearchParams({ id: focused.id, locale: he ? "he" : "en" })}`, { signal: controller.signal })
        .then(response => { if (!response.ok) throw new Error("Rating unavailable"); return response.json(); })
        .then(data => { if (!controller.signal.aborted) setRatings(previous => ({ ...previous, [focused.id]: typeof data.rating === "number" ? data.rating : null })); })
        .catch(() => {});
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [focused, he, ratings]);

  const recenter = () => {
    const move = (position: Point) => {
      map.current?.panTo(position); map.current?.setZoom(14);
      setEmbedCenter(position);
      setLocationMessage("");
    };
    if (center) { move(center); return; }
    if (!navigator.geolocation) { setLocationMessage(label("המיקום אינו זמין במכשיר", "Location is unavailable on this device")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => { move({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocating(false); }, () => {
      setLocating(false); setLocationMessage(label("אפשרו גישה למיקום כדי למרכז את המפה", "Allow location access to center the map"));
    }, { timeout: 10000, maximumAge: 60000 });
  };

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
    setEmbedCenter(null);
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

  const embedPoint = embedCenter ?? (focused ? point(focused) : null) ?? center;
  const embedParams = new URLSearchParams({ output: "embed", hl: he ? "he" : "en", z: "14" });
  if (embedPoint) embedParams.set("ll", `${embedPoint.lat},${embedPoint.lng}`);
  else embedParams.set("q", city.trim() || "Israel");
  return <section ref={panel} className={`weig-discovery-map${expanded ? " is-expanded" : ""}`} dir={he ? "rtl" : "ltr"}
    role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-label={label("מפת המקומות", "Places map")} tabIndex={-1}>
    <div ref={surface} className="weig-map-surface" />
    {mapState === "fallback" && <iframe className="weig-map-surface" title={label("מפת Google Maps", "Google Maps")}
      src={`https://maps.google.com/maps?${embedParams}`}
      referrerPolicy="no-referrer-when-downgrade" allowFullScreen />}
    {mapState === "loading" && <div className="weig-map-message" role="status">{label("טוענים מפה…", "Loading map…")}</div>}
    <div className="weig-map-controls">
      <button ref={expandButton} type="button" aria-label={expanded ? label("סגירת מסך מלא", "Close full screen") : label("מפה במסך מלא", "Full screen map")} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize size={20}/> : <Expand size={20}/>}</button>
      <button type="button" aria-label={label("מירכוז למיקום שלי", "Center on my location")} disabled={locating} onClick={recenter}><LocateFixed size={20}/></button>
    </div>
    {locationMessage && <div className="weig-map-location-message" role="status">{locationMessage}</div>}
    {places.length === 0 ? <div className="weig-map-empty"><MapPin size={24}/><span>{label("אין מקומות להצגה. נסו חיפוש או אזור אחר.", "No places to show. Try another search or area.")}</span></div> : <>
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
              <span className="weig-map-distance">{travel?.(place) ?? label("מרחק אינו זמין", "Distance unavailable")}</span>
              {place.openNow != null && <span className={place.openNow ? "is-open" : "is-closed"}>{place.openNow ? label("פתוח עכשיו", "Open now") : label("סגור עכשיו", "Closed now")}</span>}

            </span><span className="weig-map-card-rating" dir="ltr" aria-label={label("דירוג Google", "Google rating")}><Star size={13} fill="currentColor"/>{(place.rating ?? ratings[place.id])?.toFixed(1) ?? "—"}</span>
          </button>
          {place.credit && <details className="weig-map-photo-credit"><summary aria-label={label("קרדיט לתמונה", "Photo credit")}>ⓘ</summary><small>{place.credit}</small></details>}
          <button type="button" className="weig-map-card-details" onClick={() => { setExpanded(false); onSelect(place); }} aria-label={`${label("פרטים על", "Details for")} ${he ? place.he : place.en}`}>{label("פרטי המקום", "Place details")}</button>
        </div>)}
      </div>
      <span className="weig-map-sr-status" role="status" aria-live="polite">{focused && (he ? focused.he : focused.en)}</span>
    </>}
    {expanded && <button type="button" className="weig-map-close" onClick={() => setExpanded(false)} aria-label={label("סגירת המפה", "Close map")}><X size={20}/></button>}
  </section>;
}
