"use client";

import { useEffect, useState } from "react";
import { BedDouble, Bookmark, BriefcaseBusiness, CarFront, ChevronLeft, ChevronRight, Coffee, Heart, Images, Landmark, List, MapPin, Mountain, Navigation, Search, ShoppingBasket, Sparkles, Trees, UsersRound, Utensils, Waves, X, Building2, LocateFixed, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries";
import { placeCategories, placeGroups, type CategoryId } from "@/modules/places/categories";

type PlaceResult = {
  id: string; name: string; address: string; mapsUrl: string;
  photoName: string | null; photoCredits: { displayName?: string; uri?: string }[];
  attributions: { provider?: string; providerUri?: string }[];
  verification: "unverified";
};
const icons = { utensils: Utensils, coffee: Coffee, shopping: ShoppingBasket, building: Building2, landmark: Landmark, water: Waves, users: UsersRound, trees: Trees, sparkles: Sparkles, mountain: Mountain, waves: Waves, bed: BedDouble, car: CarFront, briefcase: BriefcaseBusiness };
const storageKey = "weig-saved-places";

export function PlacesExperience({ t }: { t: Dictionary }) {
  const he = t.places.title === "לאן תרצו להגיע?";
  const label = (hebrew: string, english: string) => he ? hebrew : english;
  const params = useSearchParams();
  const [category, setCategory] = useState<CategoryId>("nature");
  const [city, setCity] = useState(label("ירושלים", "Jerusalem"));
  const [cityDraft, setCityDraft] = useState(label("ירושלים", "Jerusalem"));
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"feed" | "list">("feed");
  const [saved, setSaved] = useState<string[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [selected, setSelected] = useState<PlaceResult | null>(null);

  useEffect(() => {
    try { const data = JSON.parse(localStorage.getItem(storageKey) || "[]"); if (Array.isArray(data)) setSaved(data.filter((id): id is string => typeof id === "string")); } catch { /* Storage may be unavailable. */ }
  }, []);
  useEffect(() => { setShowSaved(params.get("saved") === "1"); }, [params]);
  useEffect(() => {
    const controller = new AbortController();
    const search = new URLSearchParams({ category, city: city.trim() || "ירושלים", locale: he ? "he" : "en" });
    if (submitted) search.set("query", submitted);
    if (coords) { search.set("lat", String(coords.lat)); search.set("lng", String(coords.lng)); }
    setStatus("loading");
    fetch(`/api/places?${search}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (response.status === 503 && payload.error === "PLACES_NOT_CONFIGURED") { setPlaces([]); setStatus("missing"); return; }
        if (!response.ok || !Array.isArray(payload.places)) throw new Error("Places search failed");
        setPlaces(payload.places);
        setStatus("ready");
      })
      .catch(error => { if (error.name !== "AbortError") { setPlaces([]); setStatus("error"); } });
    return () => controller.abort();
  }, [category, city, coords, submitted, he]);

  const title = submitted || (he ? placeCategories.find(item => item.id === category)?.he : placeCategories.find(item => item.id === category)?.en);
  const visible = showSaved ? places.filter(place => saved.includes(place.id)) : places;
  function toggleSaved(id: string) {
    setSaved(previous => {
      const next = previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep session state. */ }
      return next;
    });
  }
  function selectCategory(id: CategoryId) { setCategory(id); setSubmitted(""); setDraft(""); setShowSaved(false); }
  function useMyLocation() {
    if (!navigator.geolocation) { setNotice(label("המכשיר לא תומך במיקום.", "Location is unavailable on this device.")); return; }
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude, lng = position.coords.longitude;
      if (lat < 29.4 || lat > 33.4 || lng < 34.2 || lng > 35.95) { setNotice(label("המיקום שזוהה אינו בישראל. אפשר לבחור עיר בישראל.", "Your location is outside Israel. Choose an Israeli city.")); return; }
      setCoords({ lat, lng }); setNotice(label("מציגים מקומות בסביבה שלך", "Showing places near you"));
    }, () => setNotice(label("לא התקבלה הרשאה למיקום. אפשר לחפש לפי עיר.", "Location permission was not granted. Search by city instead.")), { enableHighAccuracy: false, timeout: 10000 });
  }

  return <div className="places-israel">
    <section className="israel-intro"><div className="israel-intro-top"><span><MapPin size={16}/>{label("מגלים את ישראל", "EXPLORE ISRAEL")}</span><span>WEIG</span></div><h1>{label("לאן יוצאים היום?", "Where to today?")}</h1><p>{label("המקומות, האנשים והדרכים שכדאי להכיר — קרוב אליך או בכל עיר שתבחר.", "Discover places, people and routes near you or in any Israeli city.")}</p>
      <form className="israel-search" onSubmit={event => { event.preventDefault(); if (draft.trim().length >= 2) { setCity(cityDraft.trim() || label("ירושלים", "Jerusalem")); setSubmitted(draft.trim()); setShowSaved(false); } else setNotice(label("כדי לחפש, הקלידו לפחות שתי אותיות.", "Enter at least two characters to search.")); }}><Search size={21}/><input value={draft} onChange={event => setDraft(event.target.value)} placeholder={label("מה מחפשים? למשל אוכל כשר ליד מירון", "What are you looking for?")} aria-label={label("חיפוש מקומות", "Search places")}/><button type="submit" aria-label={label("חיפוש", "Search")}>{label("חפשו", "Search")}</button></form>
    </section>
    <div className="israel-location"><label>{label("מחפשים באזור", "Search area")}<input value={cityDraft} onChange={event => setCityDraft(event.target.value)} onBlur={() => { if (cityDraft.trim()) { setCity(cityDraft.trim()); setCoords(null); } }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={label("עיר או אזור בישראל", "City or area in Israel")} maxLength={60}/></label><button onClick={useMyLocation}><LocateFixed size={18}/>{label("ליד המיקום שלי", "Near me")}</button></div>
    {notice && <p className="israel-notice" role="status">{notice}<button aria-label={label("סגירה", "Close")} onClick={() => setNotice("")}><X size={16}/></button></p>}
    <section className="israel-catalog" aria-label={label("קטגוריות מקומות", "Place categories")}><div className="israel-section-heading"><div><span>{label("מה מתחשק לגלות?", "FIND YOUR WAY")}</span><h2>{label("מה מחפשים?", "Explore categories")}</h2></div><span>{placeCategories.length} {label("אפשרויות", "categories")}</span></div>
      {placeGroups.map(group => <div className="israel-group" key={group.id}><h3>{he ? group.he : group.en}</h3><div className="israel-category-grid">{placeCategories.filter(item => item.group === group.id).map(item => { const Icon = icons[item.icon]; return <button key={item.id} className={category === item.id && !submitted ? "active" : ""} aria-pressed={category === item.id && !submitted} onClick={() => selectCategory(item.id)}><span className="israel-category-icon"><Icon size={21}/></span><span>{he ? item.he : item.en}</span>{he ? <ChevronLeft size={15}/> : <ChevronRight size={15}/>}</button>; })}</div></div>)}
    </section>
    <section className="israel-results" aria-live="polite"><div className="israel-section-heading israel-results-head"><div><span>{coords ? label("בסביבה שלך", "NEAR YOU") : city}</span><h2>{title}</h2></div><div className="israel-result-actions"><button aria-label={label("שמורים", "Saved")} aria-pressed={showSaved} onClick={() => setShowSaved(!showSaved)}><Bookmark size={19}/>{saved.length > 0 && saved.length}</button><button aria-label={label("פיד", "Feed")} aria-pressed={view === "feed"} onClick={() => setView("feed")}><Images size={19}/></button><button aria-label={label("רשימה", "List")} aria-pressed={view === "list"} onClick={() => setView("list")}><List size={19}/></button></div></div>
      {status === "loading" ? <div className="israel-state"><LoaderCircle className="israel-spinner" size={30}/><p>{label("מחפשים מקומות בישראל...", "Finding places in Israel...")}</p></div> : status === "missing" ? <div className="israel-state"><MapPin size={30}/><h3>{label("הקטגוריות מוכנות", "Categories are ready")}</h3><p>{label("כדי להציג כאן מקומות אמיתיים צריך לחבר מפתח Google Places. לא נציג מקומות לדוגמה כתוצאות חיפוש.", "Connect a Google Places key to show real places here. Preview places will not appear as search results.")}</p></div> : status === "error" ? <div className="israel-state"><MapPin size={30}/><h3>{label("לא הצלחנו לטעון מקומות כרגע", "Places couldn't be loaded")}</h3><p>{label("נסו לבחור עיר או קטגוריה אחרת.", "Try another city or category.")}</p></div> : visible.length === 0 ? <div className="israel-state"><Search size={30}/><p>{showSaved ? label("אין מקומות שמורים בתוצאות האלה.", "No saved places in these results.") : label("לא נמצאו מקומות. נסו חיפוש או עיר אחרת.", "No places found. Try another search or city.")}</p></div> : <div className={view === "feed" ? "israel-feed" : "israel-list"}>{visible.map(place => <article className="israel-place" key={place.id}>
        {place.photoName ? <img className="israel-place-photo" src={`/api/places/photo?name=${encodeURIComponent(place.photoName)}`} alt="" loading="lazy"/> : <div className="israel-place-photo israel-no-photo"><MapPin size={50}/></div>}
        <div className="israel-place-shade"/><button className="israel-place-save" aria-label={`${saved.includes(place.id) ? label("הסר משמורים", "Remove saved") : label("שמירה", "Save")} ${place.name}`} aria-pressed={saved.includes(place.id)} onClick={() => toggleSaved(place.id)}><Heart size={22} fill={saved.includes(place.id) ? "currentColor" : "none"}/></button>
        <div className="israel-place-copy"><span>{label("מקום מתוך Google Maps", "Place from Google Maps")}</span><h3>{place.name}</h3><p><MapPin size={15}/>{place.address}</p><div className="israel-place-buttons"><button onClick={() => setSelected(place)}>{label("לפרטי המקום", "Place details")}</button><a href={place.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`${label("פתיחה במפות", "Open in Maps")} ${place.name}`}><Navigation size={19}/></a></div></div>
        {place.photoCredits.length > 0 && <div className="israel-photo-credit">{place.photoCredits.map((credit, i) => credit.uri ? <a key={i} href={credit.uri} target="_blank" rel="noopener noreferrer">{credit.displayName}</a> : <span key={i}>{credit.displayName}</span>)}</div>}
      </article>)}</div>}
      {status === "ready" && visible.length > 0 && <div className="israel-google-credit"><img src="/branding/powered-by-google.png" alt="Powered by Google"/><span>{label("פרטים ותמונות: Google Maps. כשרות והתאמה טרם אומתו.", "Details and photos: Google Maps. Kosher status and suitability are not verified.")}</span></div>}
    </section>
    {selected && <div className="israel-detail-wrap"><button className="israel-detail-backdrop" aria-label={label("סגירה", "Close")} onClick={() => setSelected(null)}/><section className="israel-detail" role="dialog" aria-modal="true" aria-label={selected.name}><button className="israel-detail-close" aria-label={label("סגירה", "Close")} onClick={() => setSelected(null)}><X size={22}/></button>{selected.photoName && <img src={`/api/places/photo?name=${encodeURIComponent(selected.photoName)}`} alt=""/>}<div className="israel-detail-body"><small>{label("מקום מתוך Google Maps", "Place from Google Maps")}</small><h2>{selected.name}</h2><p>{selected.address}</p><div className="israel-verification"><strong>{label("מידע שדורש אימות", "Information requiring verification")}</strong><span>{label("כשרות, שעות רחצה נפרדת והתאמה לציבור חרדי לא אומתו על ידי WEIG.", "Kosher status, separate swimming hours and suitability have not been verified by WEIG.")}</span></div><a className="israel-open-maps" href={selected.mapsUrl} target="_blank" rel="noopener noreferrer"><Navigation size={18}/>{label("פתחו ב־Google Maps", "Open in Google Maps")}</a>{selected.photoCredits.map((credit, i) => <small key={i}>{credit.uri ? <a href={credit.uri} target="_blank" rel="noopener noreferrer">{credit.displayName}</a> : credit.displayName}</small>)}{selected.attributions.map((item, i) => <small key={i}>{item.providerUri ? <a href={item.providerUri} target="_blank" rel="noopener noreferrer">{item.provider}</a> : item.provider}</small>)}<img className="israel-detail-google" src="/branding/powered-by-google.png" alt="Powered by Google"/></div></section></div>}
    <footer className="israel-footer"><a href="/privacy">{label("פרטיות", "Privacy")}</a><a href="/terms">{label("תנאי שימוש", "Terms")}</a></footer>
  </div>;
}
