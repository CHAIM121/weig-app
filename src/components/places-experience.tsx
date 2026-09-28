"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, ChevronDown, ChevronLeft, ChevronRight, Compass, Heart, Images, List, Map as MapIcon, MapPin, Navigation, Search, SlidersHorizontal, Sparkles, X, Clock3, UtensilsCrossed, Phone, Star, Globe2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { useSearchParams } from "next/navigation";
import { placeCategories, type CategoryId } from "@/modules/places/categories";

type Place = { id:string; image:string; he:string; en:string; kindHe:string; kindEn:string; areaHe:string; areaEn:string; descriptionHe:string; descriptionEn:string; maps:string; credit:string; type:"heritage"|"views"; mapsUrl?:string; photoCredits?:{displayName?:string;uri?:string}[]; attributions?:{provider?:string;providerUri?:string}[] };
type GooglePlace = {id:string;name:string;address:string;mapsUrl:string;photoName:string|null;photoCredits:Place["photoCredits"];attributions:Place["attributions"]};
const mapsLink=(place:Place)=>place.mapsUrl||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.maps)}`;
const places:Place[]=[
 {id:"bastion",image:"/images/fishermans-bastion.jpg",he:"מצודת הדייגים",en:"Fisherman's Bastion",kindHe:"תצפית · אדריכלות",kindEn:"Views · Architecture",areaHe:"בודה · בודפשט",areaEn:"Buda · Budapest",descriptionHe:"מרפסות אבן ותצפית אל העיר. מקום טוב להתחיל בו יום של הליכה וגלות.",descriptionEn:"Stone terraces with sweeping city views. A beautiful starting point for a day on foot.",maps:"Fisherman's Bastion Budapest",credit:"Attila Pál / Unsplash",type:"views"},
 {id:"synagogue",image:"/images/dohany-synagogue.jpg",he:"בית הכנסת ברחוב דוהאני",en:"Dohány Street Synagogue",kindHe:"מורשת · היסטוריה",kindEn:"Heritage · History",areaHe:"הרובע היהודי · בודפשט",areaEn:"Jewish Quarter · Budapest",descriptionHe:"נקודת ציון ברובע היהודי של בודפשט, עם סיפור ועיצוב יוצאי דופן.",descriptionEn:"A landmark in Budapest's Jewish Quarter with remarkable history and architecture.",maps:"Dohany Street Synagogue Budapest",credit:"Linda Gerbec / Unsplash",type:"heritage"},
 {id:"river",image:"/images/budapest-parliament.jpg",he:"טיילת הדנובה",en:"Danube Promenade",kindHe:"הליכה · נוף עירוני",kindEn:"Walk · City view",areaHe:"מרכז בודפשט",areaEn:"Central Budapest",descriptionHe:"הליכה לצד הנהר מול בניין הפרלמנט וקו הרקיע של העיר.",descriptionEn:"A riverside walk with views of Parliament and the city skyline.",maps:"Danube Promenade Budapest",credit:"Himmel S / Unsplash",type:"views"},
 {id:"city",image:"/images/budapest-city.jpg",he:"גשר השלשלאות",en:"Chain Bridge",kindHe:"סמל העיר · הליכה",kindEn:"Landmark · Walk",areaHe:"מרכז בודפשט",areaEn:"Central Budapest",descriptionHe:"הגשר המחבר בין בודה לפשט ומציע מבט פתוח על העיר והנהר.",descriptionEn:"The bridge between Buda and Pest, opening up views across the city and river.",maps:"Szechenyi Chain Bridge Budapest",credit:"Krisztian Tabori / Unsplash",type:"views"}
];
export function PlacesExperience({t}:{t:Dictionary}) {
 const searchParams=useSearchParams();const he=t.places.title==="לאן תרצו להגיע?";const label=(h:string,e:string)=>he?h:e;const arrow=he?<ArrowLeft size={18}/>:<ArrowRight size={18}/>;
 const [gallery,setGallery]=useState<{id:string;photos:PlacePhoto[]} | null>(null);
 const [query,setQuery]=useState(""),[category,setCategory]=useState<"all"|CategoryId>("all"),[city,setCity]=useState(he?"ירושלים":"Jerusalem"),[livePlaces,setLivePlaces]=useState<Place[]>([]),[status,setStatus]=useState<"loading"|"ready"|"missing"|"error">("loading"),[selected,setSelected]=useState<Place|null>(null),[view,setView]=useState<"feed"|"list"|"map">("feed"),[saved,setSaved]=useState<string[]>([]),[locationNote,setLocationNote]=useState(false),[showSaved,setShowSaved]=useState(false);
 useEffect(()=>{setShowSaved(searchParams.get("saved")==="1")},[searchParams]);
 useEffect(()=>{const controller=new AbortController();const search=new URLSearchParams({category:category==="all"?"nature":category,city,locale:he?"he":"en"});
  if(query.trim().length>=2)search.set("query",query.trim());
  setStatus("loading");const timer=setTimeout(()=>{fetch(`/api/places?${search}`,{signal:controller.signal,cache:"no-store"}).then(async response=>{const data=await response.json();if(response.status===503&&data.error==="PLACES_NOT_CONFIGURED"){setStatus("missing");setLivePlaces([]);return}if(!response.ok||!Array.isArray(data.places))throw new Error("Places unavailable");setLivePlaces((data.places as GooglePlace[]).map(place=>({id:place.id,image:place.photoName?`/api/places/photo?name=${encodeURIComponent(place.photoName)}`:"/images/place-placeholder.svg",he:place.name,en:place.name,kindHe:"מקום מתוך Google Maps",kindEn:"Place from Google Maps",areaHe:place.address,areaEn:place.address,descriptionHe:place.address,descriptionEn:place.address,maps:place.name,credit:place.photoCredits?.map(item=>item.displayName).filter(Boolean).join(" · ")||"Google Maps",type:"views" as const,mapsUrl:place.mapsUrl,photoCredits:place.photoCredits,attributions:place.attributions})));setStatus("ready")}).catch(error=>{if(error.name!=="AbortError"){setStatus("error");setLivePlaces([])}})},query?350:0);
  return()=>{clearTimeout(timer);controller.abort()};
 },[category,city,query,he]);
 const preview=status==="missing"&&category==="all"&&!query.trim();
 const visible=useMemo(()=>(preview?places:livePlaces).filter(p=>(!showSaved||saved.includes(p.id))&&(status!=="missing"||!query.trim()||`${p.he} ${p.en} ${p.kindHe} ${p.areaHe}`.toLowerCase().includes(query.trim().toLowerCase()))),[preview,livePlaces,query,saved,showSaved,status]);
 const activeCategory=placeCategories.find(item=>item.id===category);
 const receivePhotos=useCallback((id:string,photos:PlacePhoto[])=>setGallery({id,photos}),[]);
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem("weig-saved-places")||"[]");if(Array.isArray(value))setSaved(value.filter((x):x is string=>typeof x==="string"))}catch{}},[]);
 const toggle=(id:string)=>setSaved(v=>{const next=v.includes(id)?v.filter(x=>x!==id):[...v,id];try{localStorage.setItem("weig-saved-places",JSON.stringify(next))}catch{}return next});const title=(p:Place)=>he?p.he:p.en;
 return <div className="discover-app">
  <div className="discover-topline"><div><span className="discover-eyebrow">{label("מגלים עם WEIG","WEIG DISCOVER")}</span><h1>{label("לגלות", "Discover")}</h1></div><button className="discover-city" onClick={()=>setLocationNote(v=>!v)}><MapPin size={16}/>{preview?label("בודפשט", "Budapest"):city}<ChevronDown size={15}/></button></div>
  <div className="discover-search"><Search size={21}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label={t.places.search} placeholder={label("איזה מקום מתחשק לך לגלות?","What would you like to discover?")}/>{query&&<button aria-label={label("נקה חיפוש","Clear search")} onClick={()=>setQuery("")}><X size={18}/></button>}<button className="discover-search-filter" aria-label={label("הצג סינון","Show filters")} onClick={()=>setCategory(category==="all"?"restaurants":"all")}><SlidersHorizontal size={19}/></button></div>
  {locationNote&&<div className="discover-context"><label>{label("חיפוש באזור בישראל", "Search area in Israel")} <input aria-label={label("עיר בישראל", "City in Israel")} value={city} onChange={event=>setCity(event.target.value)} maxLength={60}/></label>{preview&&<p>{label("מוצגת כרגע תצוגת הדוגמה המקורית מבודפשט עד לחיבור Google Places.","The original Budapest preview is shown until Google Places is connected.")}</p>}</div>}
  <div className="discover-chips" aria-label={t.places.categories}><button aria-pressed={category==="all"} onClick={()=>{setCategory("all");setQuery("")}}>{label("בשבילי","For you")}</button>{placeCategories.map(item=><button key={item.id} aria-pressed={category===item.id} onClick={()=>{setCategory(item.id);setQuery("")}}>{he?item.he:item.en}</button>)}</div>
  <div className={view==="feed"?"discover-editorial feed-mode":"discover-editorial"}><div><span className="discover-overline"><span className="discover-pulse"/>{preview?label("בודפשט, מקרוב", "BUDAPEST, UP CLOSE"):label("ישראל, מקרוב", "ISRAEL, UP CLOSE")}</span><h2>{query?label("תוצאות החיפוש", "Search results"):activeCategory?(he?activeCategory.he:activeCategory.en):label("לאן היום?", "Where to today?")}</h2></div><div className="discover-view-actions"><div className="discover-mode-switch" aria-label={label("צורת תצוגה","View mode")}><button aria-label={label("פיד","Feed")} aria-pressed={view==="feed"} onClick={()=>setView("feed")}><Images size={17}/>{label("פיד","Feed")}</button><button aria-label={label("רשימה","List")} aria-pressed={view==="list"} onClick={()=>setView("list")}><List size={17}/>{label("רשימה","List")}</button><button aria-label={label("מפה","Map")} aria-pressed={view==="map"} onClick={()=>setView("map")}><MapIcon size={17}/>{label("מפה","Map")}</button></div><button className="discover-saved-toggle" aria-pressed={showSaved} onClick={()=>{setShowSaved(v=>!v);setView("feed")}}><Bookmark size={17}/>{label("שמורים", "Saved")}{saved.length>0&&<span>{saved.length}</span>}</button></div></div>
  {status==="loading"&&!preview?<p className="discover-context" role="status">{label("מחפשים מקומות בישראל...","Finding places in Israel...")}</p>:status==="missing"&&!preview?<p className="discover-context" role="status">{label("חיבור Google Places עדיין חסר. בחרו ‘בשבילי’ כדי לראות את תצוגת העיצוב המקורית.","Google Places is not connected yet. Choose ‘For you’ to see the original preview.")}</p>:status==="error"?<p className="discover-context" role="status">{label("לא הצלחנו לטעון מקומות כרגע.","Places couldn't be loaded right now.")}</p>:null}
  {view==="map"?<div className="discover-map-empty"><MapIcon size={36}/><h3>{label("המפה עוד בדרך", "The map is on its way")}</h3><p>{label("כשמאגר המקומות יחובר, נציג כאן מיקומים ומסלולים אמיתיים.","Verified places and routes will appear here when the catalog is connected.")}</p><button onClick={()=>setView("feed")}>{label("חזרה למקומות", "Back to places")}</button></div>:visible.length?view==="feed"?<Feed places={visible} he={he} saved={saved} toggle={toggle} select={setSelected}/>:<ListView places={visible} he={he} saved={saved} toggle={toggle} select={setSelected}/>:<div className="discover-no-results"><Search size={28}/><h3>{showSaved?label("עוד לא שמרת מקומות","No saved places yet"):label("עוד אין כאן תוצאות", "No results here yet")}</h3><p>{showSaved?label("לחצו על הלב ליד מקום שמעניין אתכם כדי לשמור אותו כאן.","Tap the heart on a place to save it here."):label("החיפוש החי יפעל עם חיבור מאגר המקומות. בינתיים אפשר לעיין במקומות שבהדגמה.","Live search needs a connected places catalog. You can explore the preview places for now.")}</p><button onClick={()=>{setQuery("");setCategory("all");setShowSaved(false)}}>{label("להציג את המקומות", "Show preview places")}</button></div>}
  <p className="discover-disclaimer">{preview?label("תצוגת הדוגמה המקורית מבודפשט. שעות פעילות וכשרות אינם מאומתים.","Original Budapest preview. Hours and kosher status are not verified."):label("מקומות ותמונות מ־Google Maps. כשרות והתאמה אינן מאומתות.","Places and photos from Google Maps. Kosher status and suitability are not verified.")}{status==="ready"&&<img src="/branding/powered-by-google.png" alt="Powered by Google" style={{display:"block",width:110,marginTop:8}}/>}</p>
  {selected&&<div className="discover-detail-wrap"><button className="discover-detail-backdrop" onClick={()=>setSelected(null)} aria-label={t.common.close}/><article className="discover-detail" role="dialog" aria-modal="true" aria-label={title(selected)}><PlaceGallery place={selected} photos={gallery?.id===selected.id?gallery.photos:[]} he={he} close={()=>setSelected(null)} /><div className="discover-detail-body"><span className="discover-eyebrow">{he?selected.kindHe:selected.kindEn}</span><h2>{title(selected)}</h2><p className="discover-detail-area"><MapPin size={16}/>{he?selected.areaHe:selected.areaEn}</p><p>{he?selected.descriptionHe:selected.descriptionEn}</p>{selected.mapsUrl?<PlaceLiveDetails id={selected.id} mapsUrl={mapsLink(selected)} he={he} onPhotos={receivePhotos}/>:<div className="discover-facts"><span><Clock3 size={17}/>{label("שעות פתיחה טרם אומתו", "Hours not verified")}</span><span><UtensilsCrossed size={17}/>{label("כשרות טרם אומתה", "Kosher status not verified")}</span></div>}<div className="discover-detail-actions"><a href={mapsLink(selected)} target="_blank" rel="noopener noreferrer"><Navigation size={19}/>{label("לפתוח במפות", "Open in Maps")}</a><button aria-label={saved.includes(selected.id)?label("הסר משמורים","Remove saved"):label("שמירת מקום","Save place")} aria-pressed={saved.includes(selected.id)} onClick={()=>toggle(selected.id)}><Bookmark size={19} fill={saved.includes(selected.id)?"currentColor":"none"}/></button></div><small>{label("יש לבדוק פרטים לפני ההגעה.","Check details before visiting.")}</small>{selected.photoCredits?.map((credit,i)=><small key={i}>{credit.uri?<a href={credit.uri} target="_blank" rel="noopener noreferrer">{credit.displayName}</a>:credit.displayName}</small>)}{selected.attributions?.map((item,i)=><small key={i}>{item.providerUri?<a href={item.providerUri} target="_blank" rel="noopener noreferrer">{item.provider}</a>:item.provider}</small>)}</div></article></div>}
 </div>
}

function Feed({places:items,he,saved,toggle,select}:{places:Place[];he:boolean;saved:string[];toggle:(id:string)=>void;select:(place:Place)=>void}){
 const label=(h:string,e:string)=>he?h:e;
 return <div className="discover-feed"><p className="discover-feed-count">{items.length} {label("מקומות לגלות · גללו למקום הבא","places to discover · scroll for the next one")}</p><div className="discover-feed-list">{items.map((place,index)=><article className="discover-feed-card" key={place.id}>
  <img src={place.image} alt={he?place.he:place.en} loading={index===0?"eager":"lazy"} fetchPriority={index===0?"high":"auto"} decoding="async"/><div className="discover-feed-shade"/>
  <div className="discover-feed-top"><span><MapPin size={14}/>{he?place.areaHe:place.areaEn}</span><span dir="ltr">{String(index+1).padStart(2,"0")} / {String(items.length).padStart(2,"0")}</span></div>
  <div className="discover-feed-actions"><button aria-label={`${saved.includes(place.id)?label("הסר משמורים","Remove saved"):label("שמירה","Save")} ${he?place.he:place.en}`} aria-pressed={saved.includes(place.id)} onClick={()=>toggle(place.id)}><Heart size={22} fill={saved.includes(place.id)?"currentColor":"none"}/></button><a href={mapsLink(place)} target="_blank" rel="noopener noreferrer" aria-label={`${label("מפות","Maps")} ${he?place.he:place.en}`}><Navigation size={21}/></a></div>
  <div className="discover-feed-caption"><span>{he?place.kindHe:place.kindEn}</span><h3>{he?place.he:place.en}</h3><p>{he?place.descriptionHe:place.descriptionEn}</p><button onClick={()=>select(place)}>{label("לגלות את המקום","Explore place")}{he?<ArrowLeft size={18}/>:<ArrowRight size={18}/>}</button></div>
  <small className="discover-feed-credit">{place.credit}</small>
 </article>)}</div></div>
}

function ListView({places:items,he,saved,toggle,select}:{places:Place[];he:boolean;saved:string[];toggle:(id:string)=>void;select:(place:Place)=>void}){
 const label=(h:string,e:string)=>he?h:e;
 return <section className="discover-results"><div className="discover-results-heading"><strong>{items.length} {items[0]?.mapsUrl?label("מקומות בישראל","places in Israel"):label("מקומות בבודפשט","places in Budapest")}</strong><span>{items[0]?.mapsUrl?"Google Maps":label("מקומות לדוגמה","Preview places")}</span></div><div className="discover-results-list">{items.map((p,index)=><article className="discover-result" key={p.id}><button className="discover-result-main" onClick={()=>select(p)}><img src={p.image} alt="" loading={index<3?"eager":"lazy"} decoding="async"/><span className="discover-result-copy"><small>{he?p.kindHe:p.kindEn}</small><strong>{he?p.he:p.en}</strong><span><MapPin size={13}/>{he?p.areaHe:p.areaEn}</span></span>{he?<ChevronLeft size={17}/>:<ChevronRight size={17}/>}</button><button className="discover-result-save" aria-label={`${saved.includes(p.id)?label("הסר משמורים","Remove saved"):label("שמירה","Save")} ${he?p.he:p.en}`} aria-pressed={saved.includes(p.id)} onClick={()=>toggle(p.id)}><Bookmark size={18} fill={saved.includes(p.id)?"currentColor":"none"}/></button></article>)}</div></section>
}

type PlacePhoto = {name:string;mapsUrl:string|null;credits:{displayName?:string;uri?:string}[]};

function PlaceGallery({place,photos,he,close}:{place:Place;photos:PlacePhoto[];he:boolean;close:()=>void}){
 const [index,setIndex]=useState(0);
 useEffect(()=>setIndex(0),[place.id]);
 const current=photos[index]??photos[0];
 const total=photos.length||1;
 const source=current?`/api/places/photo?name=${encodeURIComponent(current.name)}`:place.image;
 const credits=current?.credits?.length?current.credits:place.photoCredits??[];
 return <div className="discover-detail-photo">
  <img src={source} alt={`${he?place.he:place.en} ${index+1}`} decoding="async"/>
  <button onClick={close} aria-label={he?"סגירה":"Close"}><X size={21}/></button>
  {total>1&&<div className="discover-gallery-navigation" dir="ltr"><button type="button" aria-label={he?"התמונה הקודמת":"Previous photo"} onClick={()=>setIndex((index+total-1)%total)}><ChevronLeft size={21}/></button><span>{index+1} / {total}</span><button type="button" aria-label={he?"התמונה הבאה":"Next photo"} onClick={()=>setIndex((index+1)%total)}><ChevronRight size={21}/></button></div>}
  <div className="discover-gallery-credit">{credits.length?credits.map((credit,i)=>credit.uri?<a key={i} href={credit.uri} target="_blank" rel="noopener noreferrer">{credit.displayName}</a>:<span key={i}>{credit.displayName}</span>):place.credit}</div>
  <a className="discover-gallery-more" href={current?.mapsUrl||mapsLink(place)} target="_blank" rel="noopener noreferrer">{he?"עוד במדיה של Google Maps":"More on Google Maps"}</a>
 </div>
}

type LiveDetails = {
 phone:string|null; website:string|null; rating:number|null; ratingCount:number|null;
 openNow:boolean|null; hours:string[]; photos:PlacePhoto[]; reviews?:{rating:number|null;text:string;author:string;authorUrl:string|null;authorPhoto:string|null;mapsUrl:string|null;when:string}[];
};

function PlaceLiveDetails({id,mapsUrl,he,onPhotos}:{id:string;mapsUrl:string;he:boolean;onPhotos:(id:string,photos:PlacePhoto[])=>void}){
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
    {details?.rating!=null&&<span><Star size={17} fill="currentColor"/> {details.rating.toFixed(1)} {details.ratingCount!=null&&`(${details.ratingCount.toLocaleString(he?"he-IL":"en-US")})`} · Google</span>}
    {details?.openNow!=null&&<span><Clock3 size={17}/>{details.openNow?label("פתוח עכשיו לפי Google","Open now on Google"):label("סגור עכשיו לפי Google","Closed now on Google")}</span>}
    <span><UtensilsCrossed size={17}/>{label("כשרות לא אומתה על ידי WEIG","Kosher status not verified by WEIG")}</span>
   </div>
   {details&&details.hours.length>0&&<div className="discover-live-hours"><button type="button" onClick={()=>setShowHours(v=>!v)} aria-expanded={showHours}>{label("שעות פתיחה", "Opening hours")} <ChevronDown size={16}/></button>{showHours&&<ul>{details.hours.map((day,i)=><li key={i}>{day}</li>)}</ul>}</div>}
   {(details?.phone||details?.website)&&<div className="discover-live-links">{details.phone&&<a href={`tel:${details.phone.replace(/[^+0-9]/g,"")}`}><Phone size={17}/>{details.phone}</a>}{details.website&&<a href={details.website} target="_blank" rel="noopener noreferrer"><Globe2 size={17}/>{label("אתר המקום","Website")}</a>}</div>}
   <div className="discover-live-reviews"><button type="button" onClick={loadReviews} disabled={reviewsLoading||!!details?.reviews}>{reviewsLoading?label("טוענים תגובות...","Loading reviews..."):label("הצגת תגובות מגוגל","Show Google reviews")}</button>{reviewsError&&<p role="status">{label("תגובות אינן זמינות כרגע.","Reviews are unavailable right now.")}</p>}
    {details?.reviews&&<><p>{label("תגובות נבחרות לפי סדר הרלוונטיות של Google. הן אינן אימות כשרות.","Selected reviews in Google's relevance order. They do not verify kosher status.")}</p>{details.reviews.map((review,i)=><article key={i} className="discover-live-review"><div>{review.authorPhoto&&<img src={review.authorPhoto} alt="" loading="lazy"/>}{review.authorUrl?<a href={review.authorUrl} target="_blank" rel="noopener noreferrer">{review.author}</a>:<strong>{review.author}</strong>}{review.rating!=null&&<span>★ {review.rating}</span>}</div>{review.text&&<p>{review.text}</p>}{review.mapsUrl&&<a href={review.mapsUrl} target="_blank" rel="noopener noreferrer">{label("התגובה בגוגל מפות","Review on Google Maps")}</a>}</article>)}{!details.reviews.length&&<p>{label("אין תגובות זמינות כאן.","No reviews are available here.")}</p>}</>}
   </div>
   <p className="discover-live-note">{label("שעות פעילות עשויות להשתנות בחגים ובשבתות. כדאי לוודא מול המקום לפני הגעה.","Hours may change on holidays. Confirm with the place before visiting.")} <a href={mapsUrl} target="_blank" rel="noopener noreferrer">Google Maps</a></p>
  </>}
 </section>
}
