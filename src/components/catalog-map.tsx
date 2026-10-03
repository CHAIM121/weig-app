"use client";
import { useEffect,useRef,useState } from "react";
import type {Map as LeafletMap} from "leaflet";
import type {Coordinates} from "@/modules/places/travel";
type Pin={id:string;he:string;en:string;location?:Coordinates|null};
export function CatalogMap({places,he,onSelect,onArea}:{places:Pin[];he:boolean;onSelect:(p:Pin)=>void;onArea:(lat:number,lng:number)=>void}) {
 const container=useRef<HTMLDivElement>(null),mapRef=useRef<LeafletMap|null>(null);
 const selectRef=useRef(onSelect);selectRef.current=onSelect;
 const [error,setError]=useState(false);
 useEffect(()=>{
  let active=true;let map:LeafletMap|undefined;setError(false);
  import("leaflet").then(L=>{
   if(!active||!container.current)return;
   map=L.map(container.current).setView([31.745,34.99],13);mapRef.current=map;
   const tiles=L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL||"https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:process.env.NEXT_PUBLIC_MAP_ATTRIBUTION||'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
   tiles.on("tileerror",()=>{if(active)setError(true)});tiles.addTo(map);
   const located=places.filter(p=>p.location);
   located.forEach(p=>{
    const button=document.createElement("button");button.type="button";button.textContent=he?p.he:p.en;button.onclick=()=>selectRef.current(p);
    L.marker([p.location!.latitude,p.location!.longitude],{title:he?p.he:p.en,alt:he?p.he:p.en,icon:L.divIcon({className:"weig-map-pin",iconSize:[20,20]})}).addTo(map!).bindPopup(button);
   });
   if(located.length)map.fitBounds(L.latLngBounds(located.map(p=>[p.location!.latitude,p.location!.longitude])),{padding:[24,24],maxZoom:15});
  }).catch(()=>{if(active)setError(true)});
  return()=>{active=false;map?.remove();mapRef.current=null};
 },[places,he]);
 return <section className="weig-catalog-map"><button type="button" onClick={()=>{const c=mapRef.current?.getCenter();if(c)onArea(c.lat,c.lng)}}>{he?"חפש באזור המפה":"Search this map area"}</button><div ref={container} style={{height:"min(65vh,580px)",minHeight:340}} aria-label={he?"מפת מקומות WEIG":"WEIG places map"}/><p>{he?`${places.length} תוצאות באזור החיפוש. לחצו על נקודה לפרטים.`:`${places.length} results in the search area. Select a pin for details.`}</p>{error&&<p role="status">{he?"חלק ממפת הרקע לא נטען. פרטי המקומות זמינים ברשימה.":"Some map tiles could not load. Place details remain available in the list."}</p>}</section>;
}
