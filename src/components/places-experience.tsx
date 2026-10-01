"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, ChevronDown, ChevronLeft, ChevronRight, Compass, Heart, Images, List, Map as MapIcon, MapPin, Navigation, Search, Share2, SlidersHorizontal, Sparkles, X, Clock3, Phone, Star, Globe2, MessageCircle } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { placeCategories, type CategoryId } from "@/modules/places/categories";
import { favoriteTheme, rankPlaces, readProfile, recordSignal, recentlySeen, type DiscoveryTheme } from "@/modules/places/discovery-engine";
import { travelLabel, type Coordinates, type RouteSummary } from "@/modules/places/travel";
import { PlaceFeedbackSummary, RatingSheet, VisitPrompt, usePlaceFeedback, type FeedbackPlaceSnapshot } from "./place-feedback";

type Place = { id:string; image:string; he:string; en:string; kindHe:string; kindEn:string; areaHe:string; areaEn:string; descriptionHe:string; descriptionEn:string; maps:string; credit:string; type:"heritage"|"views"; theme?:DiscoveryTheme; location?:Coordinates|null; mapsUrl?:string; photoCredits?:{displayName?:string;uri?:string}[]; attributions?:{provider?:string;providerUri?:string}[] };
type GooglePlace = {id:string;name:string;address:string;mapsUrl:string;photoName:string|null;location?:Coordinates|null;theme?:DiscoveryTheme;photoCredits:Place["photoCredits"];attributions:Place["attributions"]};
const toPlace=(place:GooglePlace):Place=>({id:place.id,image:place.photoName?`/api/places/photo?name=${encodeURIComponent(place.photoName)}`:"/images/place-placeholder.svg",he:place.name,en:place.name,kindHe:"",kindEn:"",areaHe:place.address,areaEn:place.address,descriptionHe:"",descriptionEn:"",maps:place.name,credit:place.photoCredits?.map(item=>item.displayName).filter(Boolean).join(" · ")||"",type:"views",theme:place.theme,location:place.location,mapsUrl:place.mapsUrl,photoCredits:place.photoCredits,attributions:place.attributions});
async function fetchPlaces(url:string, signal:AbortSignal){
 for(let attempt=0;attempt<2;attempt++){
  try{const response=await fetch(url,{signal,cache:"no-store"});if(response.ok||response.status===503||response.status<500||attempt===1)return response}
  catch(error){if(signal.aborted||attempt===1)throw error}
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{signal.removeEventListener("abort",abort);resolve()},650);const abort=()=>{clearTimeout(timer);reject(new DOMException("Aborted","AbortError"))};signal.addEventListener("abort",abort,{once:true})});
 }
 throw new Error("Places unavailable");
}
const mapsLink=(place:Place)=>place.mapsUrl||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.maps)}`;
const places:Place[]=[
 {id:"bastion",image:"/images/fishermans-bastion.jpg",he:"מצודת הדייגים",en:"Fisherman's Bastion",kindHe:"תצפית · אדריכלות",kindEn:"Views · Architecture",areaHe:"בודה · בודפשט",areaEn:"Buda · Budapest",descriptionHe:"מרפסות אבן ותצפית אל העיר. מקום טוב להתחיל בו יום של הליכה וגלות.",descriptionEn:"Stone terraces with sweeping city views. A beautiful starting point for a day on foot.",maps:"Fisherman's Bastion Budapest",credit:"Attila Pál / Unsplash",type:"views"},
 {id:"synagogue",image:"/images/dohany-synagogue.jpg",he:"בית הכנסת ברחוב דוהאני",en:"Dohány Street Synagogue",kindHe:"מורשת · היסטוריה",kindEn:"Heritage · History",areaHe:"הרובע היהודי · בודפשט",areaEn:"Jewish Quarter · Budapest",descriptionHe:"נקודת ציון ברובע היהודי של בודפשט, עם סיפור ועיצוב יוצאי דופן.",descriptionEn:"A landmark in Budapest's Jewish Quarter with remarkable history and architecture.",maps:"Dohany Street Synagogue Budapest",credit:"Linda Gerbec / Unsplash",type:"heritage"},
 {id:"river",image:"/images/budapest-parliament.jpg",he:"טיילת הדנובה",en:"Danube Promenade",kindHe:"הליכה · נוף עירוני",kindEn:"Walk · City view",areaHe:"מרכז בודפשט",areaEn:"Central Budapest",descriptionHe:"הליכה לצד הנהר מול בניין הפרלמנט וקו הרקיע של העיר.",descriptionEn:"A riverside walk with views of Parliament and the city skyline.",maps:"Danube Promenade Budapest",credit:"Himmel S / Unsplash",type:"views"},
 {id:"city",image:"/images/budapest-city.jpg",he:"גשר השלשלאות",en:"Chain Bridge",kindHe:"סמל העיר · הליכה",kindEn:"Landmark · Walk",areaHe:"מרכז בודפשט",areaEn:"Central Budapest",descriptionHe:"הגשר המחבר בין בודה לפשט ומציע מבט פתוח על העיר והנהר.",descriptionEn:"The bridge between Buda and Pest, opening up views across the city and river.",maps:"Szechenyi Chain Bridge Budapest",credit:"Krisztian Tabori / Unsplash",type:"views"}
];
export function PlacesExperience({t}:{t:Dictionary}) {
 const searchParams=useSearchParams();const sharedPlaceId=searchParams.get("place");const he=t.places.title==="לאן תרצו להגיע?";const label=(h:string,e:string)=>he?h:e;const arrow=he?<ArrowLeft size={18}/>:<ArrowRight size={18}/>;
 const feedback=usePlaceFeedback(he);
 const storageKey=`weig-places-state-${he?"he":"en"}`;
 const restoredScroll=useRef(false);
 const [hydrated,setHydrated]=useState(false),[pendingPlaceId,setPendingPlaceId]=useState<string|null>(null);
 const [hasLoaded,setHasLoaded]=useState(false);
 const [location,setLocation]=useState<{lat:number;lng:number}|null>(null),[locationReady,setLocationReady]=useState(false),[manualCity,setManualCity]=useState(false);
 const [locationRetry,setLocationRetry]=useState(0),[searchRetry,setSearchRetry]=useState(0);
 const [recentIds,setRecentIds]=useState<string[]>([]);
 const [pagination,setPagination]=useState<{base:string;page:number;token:string|null;hasMore:boolean;loading:boolean}>({base:"",page:0,token:null,hasMore:false,loading:false});
 const [moreError,setMoreError]=useState(false);
 const loadSentinel=useRef<HTMLDivElement|null>(null);
 const loadingMore=useRef(false);
 const activeSearch=useRef("");
 const moreController=useRef<AbortController|null>(null);
 const [gallery,setGallery]=useState<{id:string;photos:PlacePhoto[]} | null>(null);
 const [query,setQuery]=useState(""),[category,setCategory]=useState<"all"|CategoryId>("all"),[city,setCity]=useState(""),[livePlaces,setLivePlaces]=useState<Place[]>([]),[status,setStatus]=useState<"loading"|"ready"|"missing"|"error">("loading"),[selected,setSelected]=useState<Place|null>(null),[view,setView]=useState<"feed"|"list"|"map">("feed"),[saved,setSaved]=useState<string[]>([]),[liked,setLiked]=useState<string[]>([]),[locationNote,setLocationNote]=useState(false),[showSaved,setShowSaved]=useState(false);
 useEffect(()=>{try{const data=JSON.parse(sessionStorage.getItem(storageKey)||"{}");if(typeof data.query==="string"&&Date.now()-data.updatedAt<30*60_000)setQuery(data.query.slice(0,150));if(data.manualCity===true&&typeof data.city==="string"&&data.city.trim().length>=2){setCity(data.city.slice(0,60));setManualCity(true)}if(data.category==="all"||placeCategories.some(item=>item.id===data.category))setCategory(data.category);if(["feed","list","map"].includes(data.view))setView(data.view);if(!sharedPlaceId){if(data.selected&&typeof data.selected.id==="string"&&typeof data.selected.he==="string")setSelected(data.selected);else if(typeof data.placeId==="string")setPendingPlaceId(data.placeId)}if(typeof data.locationNote==="boolean")setLocationNote(data.locationNote);setRecentIds(recentlySeen(readProfile()))}catch{}setHydrated(true)},[storageKey,sharedPlaceId]);
 useEffect(()=>{if(!hydrated||!sharedPlaceId)return;setHasLoaded(true);const previewPlace=places.find(place=>place.id===sharedPlaceId);if(previewPlace){setSelected(previewPlace);return}if(!/^[A-Za-z0-9_-]{5,200}$/.test(sharedPlaceId))return;const controller=new AbortController();fetch(`/api/places/summary?id=${encodeURIComponent(sharedPlaceId)}&locale=${he?"he":"en"}`,{signal:controller.signal,cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error("Place unavailable");return response.json()}).then(data=>{const place=data.place as GooglePlace;setSelected({id:place.id,image:place.photoName?`/api/places/photo?name=${encodeURIComponent(place.photoName)}`:"/images/place-placeholder.svg",he:place.name,en:place.name,kindHe:"",kindEn:"",areaHe:place.address,areaEn:place.address,descriptionHe:"",descriptionEn:"",maps:place.name,credit:place.photoCredits?.map(item=>item.displayName).filter(Boolean).join(" · ")||"",type:"views",location:place.location,mapsUrl:place.mapsUrl,photoCredits:place.photoCredits,attributions:place.attributions})}).catch(()=>{});return()=>controller.abort()},[hydrated,sharedPlaceId,he]);
 useEffect(()=>{if(!hydrated)return;try{sessionStorage.setItem(storageKey,JSON.stringify({query,category,city,view,selected,locationNote,manualCity,updatedAt:Date.now()}))}catch{}},[hydrated,storageKey,query,category,city,view,selected,locationNote,manualCity]);
 useEffect(()=>{
  if(!hydrated)return;
  if(manualCity)setLocationReady(true);
  let active=true;
  let cached:{lat:number;lng:number}|null=null;
  try{const stored=JSON.parse(localStorage.getItem("weig-last-location")||"null");if(stored&&Date.now()-stored.time<2*60*60*1000&&stored.lat>=29.4&&stored.lat<=33.4&&stored.lng>=34.2&&stored.lng<=35.95)cached={lat:stored.lat,lng:stored.lng}}catch{}
  if(cached){setLocation(cached);setLocationReady(true)}
  const finish=()=>{if(active)setLocationReady(true)};
  if(!navigator.geolocation){finish();return}
  const timer=window.setTimeout(finish,12000);
  navigator.geolocation.getCurrentPosition(position=>{
   if(!active)return;
   const {latitude:lat,longitude:lng}=position.coords;
   if(lat>=29.4&&lat<=33.4&&lng>=34.2&&lng<=35.95){
    setLocation(previous=>previous&&Math.abs(previous.lat-lat)<.002&&Math.abs(previous.lng-lng)<.002?previous:{lat,lng});
    try{localStorage.setItem("weig-last-location",JSON.stringify({lat,lng,time:Date.now()}))}catch{}
   }
   finish();window.clearTimeout(timer);
  },()=>{finish();window.clearTimeout(timer)},{enableHighAccuracy:false,timeout:11000,maximumAge:120000});
  return()=>{active=false;window.clearTimeout(timer)}
 },[hydrated,manualCity,locationRetry]);
 useEffect(()=>{if(!hydrated||manualCity||location)return;const retry=()=>{if(document.visibilityState==="visible")setLocationRetry(value=>value+1)};document.addEventListener("visibilitychange",retry);return()=>document.removeEventListener("visibilitychange",retry)},[hydrated,manualCity,location]);
 useEffect(()=>{setShowSaved(searchParams.get("saved")==="1")},[searchParams]);
 useEffect(()=>{if(!hydrated||!locationReady)return;if(!location&&!city.trim()){setLivePlaces([]);setStatus("ready");setLocationNote(true);return}if(manualCity&&city.trim().length<2){setLivePlaces([]);setStatus("ready");return}const controller=new AbortController();const search=new URLSearchParams({category:category==="all"?"nature":category,locale:he?"he":"en"});
  if(manualCity)search.set("city",city.trim());
  if(category==="all")search.set("feed","1");
  if(category==="all"&&!query.trim()){const preferred=favoriteTheme(readProfile());if(preferred)search.set("prefer",preferred)}
  if(location&&!manualCity){search.set("lat",String(location.lat));search.set("lng",String(location.lng))}
  if(category==="all"&&!query.trim()&&recentIds.length)search.set("recent",recentIds.join(","));
  if(query.trim().length>=2)search.set("query",query.trim());
  activeSearch.current=search.toString();moreController.current?.abort();setPagination({base:"",page:0,token:null,hasMore:false,loading:false});setMoreError(false);loadingMore.current=false;
  setStatus("loading");const timer=setTimeout(()=>{fetchPlaces(`/api/places?${search}`,controller.signal).then(async response=>{const data=await response.json();if(response.status===503&&data.error==="PLACES_NOT_CONFIGURED"){setStatus("missing");setLivePlaces([]);return}if(!response.ok||!Array.isArray(data.places))throw new Error("Places unavailable");setLivePlaces(rankPlaces((data.places as GooglePlace[]).map(toPlace),readProfile()));setPagination({base:search.toString(),page:0,token:data.nextPageToken??null,hasMore:!!data.hasMore,loading:false});setStatus("ready")}).catch(error=>{if(error.name!=="AbortError"){setStatus("error");setLivePlaces([])}})},query?350:0);
  return()=>{clearTimeout(timer);controller.abort()};
 },[category,city,query,he,hydrated,locationReady,location,manualCity,storageKey,searchRetry]);
 const preview=status==="missing"&&category==="all"&&!query.trim();
 useEffect(()=>{if(status!=="loading"||locationReady&&!location&&!city.trim())setHasLoaded(true)},[status,locationReady,location,city]);
 useEffect(()=>{if(!selected)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous}},[selected]);
 const visible=useMemo(()=>(preview?places:livePlaces).filter(p=>(!showSaved||saved.includes(p.id))&&(status!=="missing"||!query.trim()||`${p.he} ${p.en} ${p.kindHe} ${p.areaHe}`.toLowerCase().includes(query.trim().toLowerCase()))),[preview,livePlaces,query,saved,showSaved,status]);
 const origin=location?{latitude:location.lat,longitude:location.lng}:null;
 const [routeData,setRouteData]=useState<Record<string,RouteSummary>>({});
 const attemptedRoutes=useRef(new Set<string>());
 const routesUnavailable=useRef(false);
 useEffect(()=>{
  if(!origin||preview||routesUnavailable.current)return;
  const prefix=`${origin.latitude.toFixed(3)},${origin.longitude.toFixed(3)}:`;
  const missing=[...(selected?[selected]:[]),...visible].filter(place=>place.location&&!attemptedRoutes.current.has(prefix+place.id)).slice(0,12);
  if(!missing.length)return;
  missing.forEach(place=>attemptedRoutes.current.add(prefix+place.id));
  const controller=new AbortController();
  let completed=false;
  fetch("/api/places/travel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin,destinations:missing.map(place=>place.location)}),signal:controller.signal})
   .then(async response=>{if(!response.ok){completed=true;routesUnavailable.current=true;return}const body=await response.json() as {routes:(RouteSummary|null)[]};completed=true;const updates:Record<string,RouteSummary>={};missing.forEach((place,index)=>{if(body.routes[index])updates[prefix+place.id]=body.routes[index]!});setRouteData(previous=>({...previous,...updates}))})
   .catch(error=>{if(error.name!=="AbortError"){completed=true;routesUnavailable.current=true}});
  return()=>{controller.abort();if(!completed)missing.forEach(place=>attemptedRoutes.current.delete(prefix+place.id))};
 },[location?.lat,location?.lng,visible,selected,preview,routeData]);
 const travel=(place:Place)=>travelLabel(origin,place.location??undefined,origin?routeData[`${origin.latitude.toFixed(3)},${origin.longitude.toFixed(3)}:${place.id}`]:undefined,he);
 const loadMore=useCallback(async()=>{if(loadingMore.current||!pagination.hasMore||!pagination.base||status!=="ready"||showSaved||view==="map")return;loadingMore.current=true;setPagination(current=>({...current,loading:true}));const controller=new AbortController();moreController.current=controller;const params=new URLSearchParams(pagination.base);params.set("page",String(pagination.page+1));if(pagination.token)params.set("pageToken",pagination.token);params.set("seen",livePlaces.map(place=>place.id).slice(-100).join(","));try{const response=await fetchPlaces(`/api/places?${params}`,controller.signal);if(!response.ok)throw new Error("Places unavailable");const data=await response.json();if(!Array.isArray(data.places))throw new Error("Invalid places");if(activeSearch.current!==pagination.base)return;const previous=new Set(livePlaces.map(place=>place.id));const additions=rankPlaces((data.places as GooglePlace[]).filter(place=>!previous.has(place.id)).map(toPlace),readProfile());setLivePlaces(current=>{const ids=new Set(current.map(place=>place.id));return [...current,...additions.filter(place=>!ids.has(place.id))]});setMoreError(false);setPagination(current=>({...current,page:current.page+1,token:data.nextPageToken??null,hasMore:!!data.hasMore,loading:false}))}catch(error){if(activeSearch.current===pagination.base&&!(error instanceof DOMException&&error.name==="AbortError")){setMoreError(true);setPagination(current=>({...current,hasMore:false,loading:false}))}}finally{if(moreController.current===controller)moreController.current=null;loadingMore.current=false}},[pagination,livePlaces,status,showSaved,view]);
 useEffect(()=>{const target=loadSentinel.current;if(!hasLoaded||!target||!pagination.hasMore||status!=="ready"||showSaved||view==="map")return;const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)void loadMore()},{rootMargin:"600px"});observer.observe(target);return()=>observer.disconnect()},[loadMore,hasLoaded,pagination.hasMore,status,showSaved,view,visible.length]);
 useEffect(()=>{if(!pendingPlaceId||!hydrated||status==="loading")return;const place=visible.find(item=>item.id===pendingPlaceId);if(place){setSelected(place);setPendingPlaceId(null)}},[pendingPlaceId,hydrated,status,visible]);
 useEffect(()=>{if(!hydrated||restoredScroll.current||status==="loading")return;const timer=window.setTimeout(()=>{try{const position=Number(sessionStorage.getItem(`${storageKey}-scroll`)||0);if(Number.isFinite(position)&&position>0)window.scrollTo(0,position)}catch{}restoredScroll.current=true},100);return()=>window.clearTimeout(timer)},[hydrated,status,storageKey]);
 useEffect(()=>{if(!hydrated)return;const saveScroll=()=>{try{if(restoredScroll.current)sessionStorage.setItem(`${storageKey}-scroll`,String(window.scrollY))}catch{}};window.addEventListener("scroll",saveScroll,{passive:true});window.addEventListener("pagehide",saveScroll);return()=>{saveScroll();window.removeEventListener("scroll",saveScroll);window.removeEventListener("pagehide",saveScroll)}},[hydrated,storageKey]);
 const activeCategory=placeCategories.find(item=>item.id===category);
 const receivePhotos=useCallback((id:string,photos:PlacePhoto[])=>setGallery({id,photos}),[]);
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem("weig-saved-places")||"[]");if(Array.isArray(value))setSaved(value.filter((x):x is string=>typeof x==="string"))}catch{}},[]);
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem("weig-liked-places")||"[]");if(Array.isArray(value))setLiked(value.filter((x):x is string=>typeof x==="string"))}catch{}},[]);
 const signal=useCallback((place:Place,event:"impression"|"open"|"share"|"navigate")=>recordSignal(place.id,place.theme,event),[]);
 const feedbackSnapshot=useCallback((place:Place):FeedbackPlaceSnapshot=>({id:place.id,name:he?place.he:place.en,area:he?place.areaHe:place.areaEn,mapsUrl:mapsLink(place)}),[he]);
 const navigateToPlace=useCallback((place:Place)=>{signal(place,"navigate");feedback.recordNavigation(feedbackSnapshot(place))},[feedback.recordNavigation,feedbackSnapshot,signal]);
 const selectPlace=(place:Place)=>{signal(place,"open");setSelected(place)};
 const toggle=(id:string)=>{const isSaving=!saved.includes(id);const place=livePlaces.find(item=>item.id===id);recordSignal(id,place?.theme,"save",Date.now(),isSaving);setSaved(v=>{const next=v.includes(id)?v.filter(x=>x!==id):[...v,id];try{localStorage.setItem("weig-saved-places",JSON.stringify(next))}catch{}return next})};const title=(p:Place)=>he?p.he:p.en;
 const toggleLike=(id:string)=>{const isLiking=!liked.includes(id);const place=livePlaces.find(item=>item.id===id);recordSignal(id,place?.theme,"like",Date.now(),isLiking);setLiked(v=>{const next=v.includes(id)?v.filter(x=>x!==id):[...v,id];try{localStorage.setItem("weig-liked-places",JSON.stringify(next))}catch{}return next})};
 if(!hasLoaded)return <div className="discover-app discover-loading-skeleton" role="status" aria-live="polite"><div className="discover-skeleton-heading"><MapPin size={18}/><span>{label("מגלים מקומות בסביבה שלך","Discovering places nearby")}</span></div><div className="discover-skeleton-search"/><div className="discover-skeleton-chips"><span/><span/><span/></div><div className="discover-skeleton-card"><div className="discover-skeleton-photo"/><div className="discover-skeleton-lines"><span/><span/></div></div><p>{label("מאתרים מקומות מתאימים…","Finding places for you…")}</p></div>;
 return <div className="discover-app">
  <div className="discover-topline"><div><span className="discover-eyebrow">{label("מגלים עם WEIG","WEIG DISCOVER")}</span><h1>{label("לגלות", "Discover")}</h1></div><button className="discover-city" onClick={()=>setLocationNote(v=>!v)}><MapPin size={16}/>{preview?label("בודפשט", "Budapest"):manualCity?city:location?label("בסביבתי","Near me"):label("בחרו אזור","Choose area")}<ChevronDown size={15}/></button></div>
  <div className="discover-toolbar">
  <div className="discover-search"><Search size={21}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label={t.places.search} placeholder={label("איזה מקום מתחשק לך לגלות?","What would you like to discover?")}/>{query&&<button aria-label={label("נקה חיפוש","Clear search")} onClick={()=>setQuery("")}><X size={18}/></button>}<button className="discover-search-filter" aria-label={label("הצג סינון","Show filters")} onClick={()=>setCategory(category==="all"?"restaurants":"all")}><SlidersHorizontal size={19}/></button></div>
  {locationNote&&<div className="discover-context">{!location&&!manualCity&&<p>{label("לא הצלחנו לזהות מיקום כרגע. אפשר לנסות שוב או לכתוב עיר.","We couldn't determine your location. Try again or enter a city.")} <button type="button" onClick={()=>{setLocationReady(false);setLocationRetry(value=>value+1)}}>{label("לנסות מיקום שוב","Retry location")}</button></p>}<label>{label("חיפוש באזור בישראל", "Search area in Israel")} <input aria-label={label("עיר בישראל", "City in Israel")} value={city} onChange={event=>{setCity(event.target.value);setManualCity(true)}} maxLength={60}/></label>{manualCity&&<button type="button" onClick={()=>{setManualCity(false);setCity("");setLocationReady(false);setLocationRetry(value=>value+1)}}>{label("חזרה למיקום שלי","Use my location")}</button>}{preview&&<p>{label("מוצגת כרגע תצוגת הדוגמה המקורית מבודפשט עד לחיבור Google Places.","The original Budapest preview is shown until Google Places is connected.")}</p>}</div>}
  <div className="discover-chips" aria-label={t.places.categories}><button aria-pressed={category==="all"} onClick={()=>{setCategory("all");setQuery("")}}>{label("בשבילי","For you")}</button>{placeCategories.map(item=><button key={item.id} aria-pressed={category===item.id} onClick={()=>{setCategory(item.id);setQuery("")}}>{he?item.he:item.en}</button>)}</div>
  <div className={view==="feed"?"discover-editorial feed-mode":"discover-editorial"}><div><span className="discover-overline"><span className="discover-pulse"/>{preview?label("בודפשט, מקרוב", "BUDAPEST, UP CLOSE"):label("ישראל, מקרוב", "ISRAEL, UP CLOSE")}</span><h2>{query?label("תוצאות החיפוש", "Search results"):activeCategory?(he?activeCategory.he:activeCategory.en):label("לאן היום?", "Where to today?")}</h2></div><div className="discover-view-actions"><div className="discover-mode-switch" aria-label={label("צורת תצוגה","View mode")}><button aria-label={label("פיד","Feed")} aria-pressed={view==="feed"} onClick={()=>setView("feed")}><Images size={17}/>{label("פיד","Feed")}</button><button aria-label={label("רשימה","List")} aria-pressed={view==="list"} onClick={()=>setView("list")}><List size={17}/>{label("רשימה","List")}</button><button aria-label={label("מפה","Map")} aria-pressed={view==="map"} onClick={()=>setView("map")}><MapIcon size={17}/>{label("מפה","Map")}</button></div><button className="discover-saved-toggle" aria-pressed={showSaved} onClick={()=>{setShowSaved(v=>!v);setView("feed")}}><Bookmark size={17}/>{label("שמורים", "Saved")}{saved.length>0&&<span>{saved.length}</span>}</button></div></div>
  </div>
  {status==="loading"&&!preview?<p className="discover-context" role="status">{label("מחפשים מקומות בישראל...","Finding places in Israel...")}</p>:status==="missing"&&!preview?<p className="discover-context" role="status">{label("חיבור Google Places עדיין חסר. בחרו ‘בשבילי’ כדי לראות את תצוגת העיצוב המקורית.","Google Places is not connected yet. Choose ‘For you’ to see the original preview.")}</p>:status==="error"?<div className="discover-context" role="status">{label("לא הצלחנו לטעון מקומות כרגע.","Places couldn't be loaded right now.")} <button type="button" onClick={()=>setSearchRetry(value=>value+1)}>{label("לנסות שוב","Try again")}</button></div>:null}
  {feedback.dueVisit&&<VisitPrompt place={feedback.dueVisit} he={he} onVisited={()=>void feedback.confirmVisited()} onDeclined={()=>void feedback.declineVisit()} onDismiss={()=>void feedback.dismissVisit()}/>}
  {view==="map"?<div className="discover-map-empty"><MapIcon size={36}/><h3>{label("המפה עוד בדרך", "The map is on its way")}</h3><p>{label("כשמאגר המקומות יחובר, נציג כאן מיקומים ומסלולים אמיתיים.","Verified places and routes will appear here when the catalog is connected.")}</p><button onClick={()=>setView("feed")}>{label("חזרה למקומות", "Back to places")}</button></div>:visible.length?view==="feed"?<Feed places={visible} he={he} saved={saved} liked={liked} toggle={toggle} toggleLike={toggleLike} select={selectPlace} signal={signal} onNavigate={navigateToPlace} travel={travel}/>:<ListView places={visible} he={he} saved={saved} toggle={toggle} select={selectPlace} signal={signal} travel={travel}/>:<div className="discover-no-results"><Search size={28}/><h3>{!location&&!city.trim()?label("בחרו אזור כדי לגלות מקומות","Choose an area to discover places"):showSaved?label("עוד לא שמרת מקומות","No saved places yet"):label("עוד אין כאן תוצאות", "No results here yet")}</h3><p>{!location&&!city.trim()?label("אפשר לאפשר גישה למיקום או לכתוב עיר בשדה שלמעלה.","Allow location access or enter a city above."):showSaved?label("לחצו על הלב ליד מקום שמעניין אתכם כדי לשמור אותו כאן.","Tap the heart on a place to save it here."):label("נסו חיפוש או אזור אחר.","Try another search or area.")}</p>{location||city.trim()?<button onClick={()=>{setQuery("");setCategory("all");setShowSaved(false)}}>{label("להציג את המקומות", "Show places")}</button>:null}</div>}
  {!preview&&!showSaved&&view!=="map"&&status==="ready"&&pagination.hasMore&&<div ref={loadSentinel} className="discover-load-more" role="status" aria-live="polite">{pagination.loading?label("מגלים עוד מקומות…","Discovering more places…"):null}</div>}
  {moreError&&status==="ready"&&<div className="discover-load-more" role="status">{label("לא הצלחנו לטעון עוד מקומות.","Couldn't load more places.")} <button type="button" onClick={()=>{setMoreError(false);setPagination(current=>({...current,hasMore:true}))}}>{label("לנסות שוב","Try again")}</button></div>}
  <p className="discover-disclaimer">{preview?label("תצוגת הדוגמה המקורית מבודפשט. שעות פעילות וכשרות אינם מאומתים.","Original Budapest preview. Hours and kosher status are not verified."):label("מקומות ותמונות מ־Google Maps. כשרות והתאמה אינן מאומתות.","Places and photos from Google Maps. Kosher status and suitability are not verified.")}{status==="ready"&&<img src="/branding/powered-by-google.png" alt="Powered by Google" style={{display:"block",width:110,marginTop:8}}/>}</p>
  {selected&&hydrated&&createPortal(<div className="discover-detail-wrap"><button className="discover-detail-backdrop" onClick={()=>setSelected(null)} aria-label={t.common.close}/><article className="discover-detail" role="dialog" aria-modal="true" aria-label={title(selected)}><PlaceGallery place={selected} photos={gallery?.id===selected.id?gallery.photos:[]} he={he} close={()=>setSelected(null)} /><div className="discover-detail-body">{(he?selected.kindHe:selected.kindEn)&&<span className="discover-eyebrow">{he?selected.kindHe:selected.kindEn}</span>}<h2>{title(selected)}</h2><p className="discover-detail-area"><MapPin size={16}/>{he?selected.areaHe:selected.areaEn}</p>{travel(selected)&&<p className="discover-detail-travel"><Navigation size={15}/>{travel(selected)}</p>}{(he?selected.descriptionHe:selected.descriptionEn)&&<p>{he?selected.descriptionHe:selected.descriptionEn}</p>}<PlaceFeedbackSummary place={feedbackSnapshot(selected)} he={he} onVisited={()=>feedback.askForRating(feedbackSnapshot(selected))}/>{selected.mapsUrl?<PlaceLiveDetails id={selected.id} he={he} onPhotos={receivePhotos}/>:<div className="discover-facts"><span><Clock3 size={17}/>{label("שעות פתיחה טרם אומתו", "Hours not verified")}</span></div>}<div className="discover-detail-actions"><a href={mapsLink(selected)} target="_blank" rel="noopener noreferrer" onClick={()=>navigateToPlace(selected)}><Navigation size={19}/>{label("ניווט", "Directions")}</a><button aria-label={saved.includes(selected.id)?label("הסר משמורים","Remove saved"):label("שמירת מקום","Save place")} aria-pressed={saved.includes(selected.id)} onClick={()=>toggle(selected.id)}><Bookmark size={19} fill={saved.includes(selected.id)?"currentColor":"none"}/></button></div>{selected.attributions?.map((item,i)=><small key={i}>{item.providerUri?<a href={item.providerUri} target="_blank" rel="noopener noreferrer">{item.provider}</a>:item.provider}</small>)}</div></article></div>,document.body)}
  {feedback.ratingPlace&&hydrated&&createPortal(<RatingSheet place={feedback.ratingPlace} he={he} user={feedback.user} onClose={()=>feedback.setRatingPlace(null)} onRated={()=>void feedback.markRated(feedback.ratingPlace!)}/>,document.body)}
 </div>
}

function usePlaceImpressions(items:Place[], signal:(place:Place,event:"impression"|"open"|"share"|"navigate")=>void){
 const container=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{
  if(!container.current||typeof IntersectionObserver==="undefined")return;
  const timers=new Map<string,ReturnType<typeof setTimeout>>();
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const id=(entry.target as HTMLElement).dataset.placeId;if(!id)continue;if(entry.isIntersecting&&entry.intersectionRatio>=.5){if(!timers.has(id)){const place=items.find(item=>item.id===id);if(place)timers.set(id,setTimeout(()=>{signal(place,"impression");timers.delete(id)},850))}}else{const timer=timers.get(id);if(timer)clearTimeout(timer);timers.delete(id)}}},{threshold:[0,.5]});
  container.current.querySelectorAll<HTMLElement>("[data-place-id]").forEach(node=>observer.observe(node));
  return()=>{observer.disconnect();timers.forEach(timer=>clearTimeout(timer))};
 },[items,signal]);
 return container;
}

function Feed({places:items,he,saved,liked,toggle,toggleLike,select,signal,onNavigate,travel}:{places:Place[];he:boolean;saved:string[];liked:string[];toggle:(id:string)=>void;toggleLike:(id:string)=>void;select:(place:Place)=>void;signal:(place:Place,event:"impression"|"open"|"share"|"navigate")=>void;onNavigate:(place:Place)=>void;travel:(place:Place)=>string|null}){
 const label=(h:string,e:string)=>he?h:e;
 const container=usePlaceImpressions(items,signal);
 const [copiedId,setCopiedId]=useState<string|null>(null);
 const [burstId,setBurstId]=useState<string|null>(null);
 const burstTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(burstTimer.current)clearTimeout(burstTimer.current)},[]);
 const like=(id:string)=>{if(!liked.includes(id)){setBurstId(id);if(burstTimer.current)clearTimeout(burstTimer.current);burstTimer.current=setTimeout(()=>setBurstId(null),700)}toggleLike(id)};
 const share=async(place:Place)=>{const url=new URL(`/${he?"he":"en"}/places`,window.location.origin);url.searchParams.set("place",place.id);const link=url.toString();try{if(navigator.share){await navigator.share({title:`${he?place.he:place.en} · WEIG`,url:link});signal(place,"share");return}await navigator.clipboard.writeText(link);signal(place,"share");setCopiedId(place.id);window.setTimeout(()=>setCopiedId(null),2500)}catch(error){if((error as Error).name!=="AbortError"&&typeof window.prompt==="function")window.prompt(label("העתיקו קישור למקום ב־WEIG","Copy the WEIG place link"),link)}};
 return <div className="discover-feed"><p className="discover-feed-count">{items.length} {label("מקומות לגלות · גללו למקום הבא","places to discover · scroll for the next one")}</p><div className="discover-feed-list" ref={container}>{items.map((place,index)=><article className="discover-feed-card" data-place-id={place.id} key={place.id}>
  <img src={place.image} alt={he?place.he:place.en} loading={index===0?"eager":"lazy"} fetchPriority={index===0?"high":"auto"} decoding="async"/><div className="discover-feed-shade"/>
  <div className="discover-feed-top"><span><MapPin size={14}/>{he?place.areaHe:place.areaEn}</span><span dir="ltr">{String(index+1).padStart(2,"0")} / {String(items.length).padStart(2,"0")}</span></div>
  <div className="discover-feed-actions" aria-label={label("פעולות למקום","Place actions")}><button type="button" className={burstId===place.id?"is-heart-burst":undefined} aria-label={`${liked.includes(place.id)?label("ביטול אהבתי","Unlike"):label("אהבתי","Like")} ${he?place.he:place.en}`} aria-pressed={liked.includes(place.id)} onClick={()=>like(place.id)}><Heart size={23} fill={liked.includes(place.id)?"currentColor":"none"}/></button><a href={mapsLink(place)} target="_blank" rel="noopener noreferrer" onClick={()=>onNavigate(place)} aria-label={`${label("ניווט אל","Navigate to")} ${he?place.he:place.en}`}><Navigation size={22}/></a><button type="button" aria-label={`${label("שיתוף","Share")} ${he?place.he:place.en}`} onClick={()=>void share(place)}><Share2 size={22}/></button><button type="button" aria-label={`${saved.includes(place.id)?label("הסר משמורים","Remove saved"):label("שמירה","Save")} ${he?place.he:place.en}`} aria-pressed={saved.includes(place.id)} onClick={()=>toggle(place.id)}><Bookmark size={22} fill={saved.includes(place.id)?"currentColor":"none"}/></button></div>
  <div className="discover-feed-caption"><span>{he?place.kindHe:place.kindEn}</span><h3>{he?place.he:place.en}</h3>{travel(place)&&<p className="discover-feed-travel"><Navigation size={15}/>{travel(place)}</p>}<p>{he?place.descriptionHe:place.descriptionEn}</p><button onClick={()=>select(place)}>{label("לגלות את המקום","Explore place")}{he?<ArrowLeft size={18}/>:<ArrowRight size={18}/>}</button></div>
  <small className="discover-feed-credit">{place.credit}</small>
 </article>)}</div></div>
}

function ListView({places:items,he,saved,toggle,select,signal,travel}:{places:Place[];he:boolean;saved:string[];toggle:(id:string)=>void;select:(place:Place)=>void;signal:(place:Place,event:"impression"|"open"|"share"|"navigate")=>void;travel:(place:Place)=>string|null}){
 const label=(h:string,e:string)=>he?h:e;
 const container=usePlaceImpressions(items,signal);
 return <section className="discover-results"><div className="discover-results-heading"><strong>{items.length} {items[0]?.mapsUrl?label("מקומות בישראל","places in Israel"):label("מקומות בבודפשט","places in Budapest")}</strong><span>{items[0]?.mapsUrl?"Google Maps":label("מקומות לדוגמה","Preview places")}</span></div><div className="discover-results-list" ref={container}>{items.map((p,index)=><article className="discover-result" data-place-id={p.id} key={p.id}><button className="discover-result-main" onClick={()=>select(p)}><img src={p.image} alt="" loading={index<3?"eager":"lazy"} decoding="async"/><span className="discover-result-copy"><small>{he?p.kindHe:p.kindEn}</small><strong>{he?p.he:p.en}</strong><span><MapPin size={13}/>{he?p.areaHe:p.areaEn}</span>{travel(p)&&<span className="discover-result-travel"><Navigation size={13}/>{travel(p)}</span>}</span>{he?<ChevronLeft size={17}/>:<ChevronRight size={17}/>}</button><button className="discover-result-save" aria-label={`${saved.includes(p.id)?label("הסר משמורים","Remove saved"):label("שמירה","Save")} ${he?p.he:p.en}`} aria-pressed={saved.includes(p.id)} onClick={()=>toggle(p.id)}><Bookmark size={18} fill={saved.includes(p.id)?"currentColor":"none"}/></button></article>)}</div></section>
}

type PlacePhoto = {name:string;mapsUrl:string|null;credits:{displayName?:string;uri?:string}[]};

function PlaceGallery({place,photos,he,close}:{place:Place;photos:PlacePhoto[];he:boolean;close:()=>void}){
 const [index,setIndex]=useState(0);
 const [expanded,setExpanded]=useState(false);
 const [touchStart,setTouchStart]=useState<number|null>(null);
 useEffect(()=>{setIndex(0);setExpanded(false)},[place.id]);
 useEffect(()=>{if(!expanded)return;const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setExpanded(false);if(event.key==="ArrowLeft")setIndex(i=>(i+total-1)%total);if(event.key==="ArrowRight")setIndex(i=>(i+1)%total)};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[expanded,photos.length]);
 const current=photos[index]??photos[0];
 const total=photos.length||1;
 const credits=current?.credits?.length?current.credits:place.photoCredits??[];
 return <div className={expanded?"discover-detail-photo is-expanded":"discover-detail-photo"} onTouchStart={e=>setTouchStart(e.touches[0]?.clientX??null)} onTouchEnd={e=>{if(touchStart===null)return;const delta=e.changedTouches[0].clientX-touchStart;if(Math.abs(delta)>45&&total>1)setIndex(i=>(i+(delta<0?1:total-1))%total);setTouchStart(null)}}>
  <div className="discover-gallery-viewport" onClick={()=>setExpanded(true)} role="button" tabIndex={0} aria-label={he?"הגדלת התמונה למסך מלא":"View photo full screen"} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setExpanded(true)}}}>
   <div className="discover-gallery-track" dir="ltr" style={{transform:`translate3d(-${index*100}%,0,0)`}}>
    {photos.length?photos.map((photo,i)=><img key={photo.name} src={`/api/places/photo?name=${encodeURIComponent(photo.name)}`} alt={`${he?place.he:place.en} ${i+1}`} loading={Math.abs(i-index)<=1?"eager":"lazy"} decoding="async"/>):<img src={place.image} alt={he?place.he:place.en} decoding="async"/>}
   </div>
  </div>
  <button className="discover-gallery-close" onClick={expanded?()=>setExpanded(false):close} aria-label={expanded?(he?"סגירת תמונה מלאה":"Close full screen"):(he?"סגירה":"Close")}><X size={21}/></button>
  {total>1&&<div className="discover-gallery-dots" dir="ltr" aria-label={he?`${total} תמונות`:`${total} photos`}>{photos.map((_,i)=><button key={i} type="button" aria-label={he?`תמונה ${i+1}`:`Photo ${i+1}`} aria-current={index===i?"true":undefined} onClick={()=>setIndex(i)}/>)}</div>}
  {credits.length>0&&<div className="discover-gallery-credit">{credits.map((credit,i)=>credit.uri?<a key={i} href={credit.uri} target="_blank" rel="noopener noreferrer">{credit.displayName}</a>:<span key={i}>{credit.displayName}</span>)}</div>}
  {current?.mapsUrl&&<a className="discover-gallery-source" href={current.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={he?"צפייה בתמונה בגוגל מפות":"View photo on Google Maps"}>G</a>}
 </div>
}

type LiveDetails = {
 phone:string|null; website:string|null; rating:number|null; ratingCount:number|null;
 openNow:boolean|null; hours:string[]; photos:PlacePhoto[]; reviews?:{rating:number|null;text:string;author:string;authorUrl:string|null;authorPhoto:string|null;mapsUrl:string|null;when:string}[];
};

function PlaceLiveDetails({id,he,onPhotos}:{id:string;he:boolean;onPhotos:(id:string,photos:PlacePhoto[])=>void}){
 const label=(h:string,e:string)=>he?h:e;
 const [details,setDetails]=useState<LiveDetails|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 const [reviewsLoading,setReviewsLoading]=useState(false);
 const [reviewsError,setReviewsError]=useState(false);
 const [showHours,setShowHours]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(`/api/places/details?id=${encodeURIComponent(id)}&locale=${he?"he":"en"}`,{signal:controller.signal,cache:"no-store"})
   .then(async response=>{if(!response.ok)throw new Error("Place details unavailable");const data=await response.json() as LiveDetails;setDetails(data);onPhotos(id,data.photos ?? []);setLoading(false)})
   .catch(e=>{if(e.name!=="AbortError"){setError(true);setLoading(false)}});
  return()=>controller.abort();
 },[id,he,onPhotos]);
 async function loadReviews(){
  setReviewsLoading(true);setReviewsError(false);
  try{const response=await fetch(`/api/places/details?id=${encodeURIComponent(id)}&locale=${he?"he":"en"}&reviews=1`,{cache:"no-store"});if(!response.ok)throw new Error("Reviews unavailable");setDetails(await response.json())}
  catch{setReviewsError(true)}finally{setReviewsLoading(false)}
 }
 return <section className="discover-live-details" aria-label={label("מידע על המקום","Place information")}>
  {loading?<p role="status">{label("טוענים פרטים נוספים...","Loading place details...")}</p>:error?<p role="status">{label("הפרטים אינם זמינים כרגע. אפשר לבדוק בגוגל מפות.","Details are unavailable. Check Google Maps.")}</p>:<>
   <div className="discover-live-facts">
    {details?.rating!=null&&<span><Star size={17} fill="currentColor"/> {details.rating.toFixed(1)} {details.ratingCount!=null&&`(${details.ratingCount.toLocaleString(he?"he-IL":"en-US")})`} <img className="discover-google-mark" src="/branding/google-g.svg" alt="Google"/></span>}
    {details?.openNow!=null&&<span className={details.openNow?"discover-open":"discover-closed"}><Clock3 size={17}/>{details.openNow?label("פתוח עכשיו","Open now"):label("סגור עכשיו","Closed now")}</span>}
    {details&&details.hours.length>0&&<div className="discover-live-hours"><button type="button" onClick={()=>setShowHours(v=>!v)} aria-expanded={showHours}>{label("שעות פתיחה", "Opening hours")} <ChevronDown size={16}/></button>{showHours&&<ul>{details.hours.map((day,i)=><li key={i}>{day}</li>)}</ul>}</div>}
   </div>
   {(details?.phone||details?.website)&&<div className="discover-live-links">{details.phone&&<a href={`tel:${details.phone.replace(/[^+0-9]/g,"")}`}><Phone size={17}/>{details.phone}</a>}{details.website&&<a href={details.website} target="_blank" rel="noopener noreferrer"><Globe2 size={17}/>{label("אתר המקום","Website")}</a>}</div>}
   <div className="discover-live-reviews"><button type="button" onClick={loadReviews} disabled={reviewsLoading||!!details?.reviews} aria-expanded={!!details?.reviews}><MessageCircle size={20}/><span>{reviewsLoading?label("טוענים תגובות...","Loading reviews..."):details?.reviews?label("תגובות מבקרים","Visitor reviews"):label("לקריאת תגובות מבקרים","Read visitor reviews")}</span>{!details?.reviews&&<ChevronDown size={19}/>}</button>{reviewsError&&<p role="status">{label("תגובות אינן זמינות כרגע.","Reviews are unavailable right now.")}</p>}
    {details?.reviews&&<><p>{label("תגובות נבחרות לפי סדר הרלוונטיות של Google. הן אינן אימות כשרות.","Selected reviews in Google's relevance order. They do not verify kosher status.")}</p>{details.reviews.map((review,i)=><article key={i} className="discover-live-review"><div>{review.authorPhoto&&<img src={review.authorPhoto} alt="" loading="lazy"/>}{review.authorUrl?<a href={review.authorUrl} target="_blank" rel="noopener noreferrer">{review.author}</a>:<strong>{review.author}</strong>}{review.rating!=null&&<span>★ {review.rating}</span>}</div>{review.text&&<p>{review.text}</p>}{review.mapsUrl&&<a href={review.mapsUrl} target="_blank" rel="noopener noreferrer">{label("התגובה בגוגל מפות","Review on Google Maps")}</a>}</article>)}{!details.reviews.length&&<p>{label("אין תגובות זמינות כאן.","No reviews are available here.")}</p>}</>}
   </div>
  </>}
 </section>
}
