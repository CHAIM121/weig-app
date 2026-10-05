import {NextRequest,NextResponse} from "next/server";
import {getPublicSupabaseConfig} from "@/lib/supabase/config";
import {evidenceStatus,type KashrutEvidence} from "@/modules/places/kashrut";
import {matchingCandidates,type GoogleIdentity,type OfficialCandidate} from "@/modules/places/kashrut/matching";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
type Component={longText?:string;shortText?:string;types?:string[]};
type GooglePlace={id:string;displayName?:{text:string};formattedAddress?:string;nationalPhoneNumber?:string;addressComponents?:Component[]};
function identity(p:GooglePlace):GoogleIdentity{
 const components=p.addressComponents??[];
 const component=(type:string)=>components.find(c=>c.types?.includes(type));
 return {name:p.displayName?.text??"",city:component("locality")?.longText??component("postal_town")?.longText??"",country:component("country")?.shortText??"",street:component("route")?.longText??"",number:component("street_number")?.longText??"",address:p.formattedAddress??"",phone:p.nationalPhoneNumber??""};
}
export async function GET(request:NextRequest){
 const id=request.nextUrl.searchParams.get("id")??"";
 if(!/^[A-Za-z0-9_-]{5,200}$/.test(id))return NextResponse.json({error:"INVALID_PLACE"},{status:400,headers});
 const config=getPublicSupabaseConfig();
 if(!config)return NextResponse.json({error:"KASHRUT_UNAVAILABLE"},{status:503,headers});
 const read=async(path:string,body?:object)=>{
  const r=await fetch(`${config.url}/rest/v1/${path}`,{method:body?"POST":"GET",headers:{apikey:config.anonKey,Authorization:`Bearer ${config.anonKey}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error("Kashrut unavailable");return r.json();
 };
 const reply=(rows:KashrutEvidence[])=>NextResponse.json({status:rows.length?"available":"missing",evidence:rows.map(e=>({id:e.id,certifier:e.certifier,level:e.level,food_type:e.food_type,source_label:e.source_label,evidence_type:e.evidence_type,source_url:e.source_url,certificate_url:e.certificate_url,valid_until:e.valid_until,verified_at:e.verified_at,fetched_at:e.fetched_at,source_updated_at:e.source_updated_at,status:evidenceStatus(e)}))},{headers});
 try{
  const links=await read(`weig_place_provider_links?provider=eq.${id.startsWith("weig_")?"weig_catalog":"google"}&external_id=eq.${encodeURIComponent(id)}&match_status=eq.approved&select=place_id&limit=1`) as {place_id:string}[];
  if(links.length){
   const fields="id,certifier,level,food_type,source_label,evidence_type,source_url,certificate_url,valid_until,verified_at,fetched_at,source_updated_at";
   return reply(await read(`weig_kashrut_evidence?place_id=eq.${encodeURIComponent(links[0].place_id)}&active_in_directory=eq.true&select=${fields}&order=fetched_at.desc&limit=10`));
  }
  const key=process.env.GOOGLE_PLACES_API_KEY;
  if(id.startsWith("weig_")||!key)return reply([]);
  // Resolve the canonical Google identity on the server. Never accept user-supplied
  // names, addresses or phones as proof that a place has official supervision.
  const google=async(language:string)=>{
   const r=await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=${language}`,{headers:{"X-Goog-Api-Key":key,"X-Goog-FieldMask":"id,displayName,addressComponents,formattedAddress,nationalPhoneNumber"},cache:"no-store",signal:AbortSignal.timeout(8500)});
   if(!r.ok)throw new Error("Google identity unavailable");const p=await r.json() as GooglePlace;
   if(p.id!==id)throw new Error("Unexpected identity");return identity(p);
  };
  const p=await google("he");
  if(!p.city||!p.country)return reply([]);
  let candidates=await read("rpc/weig_find_kashrut_candidates",{p_city:p.city.replace("יוקנעם","יקנעם").replace("פתח תיקווה","פתח תקווה"),p_country:p.country}) as (OfficialCandidate&KashrutEvidence)[];
  let matches=matchingCandidates(p,candidates);
  // OU uses English street names; compare its records with Google's English identity.
  if(candidates.some(c=>c.source_url.startsWith("https://oukosher.org/"))||candidates.some(c=>/[A-Za-z]{3}/.test(c.business_name))||p.country!=="IL"){
   const en=await google("en");
   if(p.country!=="IL")candidates=await read("rpc/weig_find_kashrut_candidates",{p_city:en.city,p_country:en.country});
   const alternate=matchingCandidates({...en,city:p.country==="IL"?p.city:en.city},candidates);
   if(p.country==="IL")alternate.push(...matchingCandidates({...p,name:en.name},candidates).filter(e=>!alternate.some(m=>m.id===e.id)));
   matches=[...matches,...alternate.filter(e=>!matches.some(m=>m.id===e.id))];
  }
  // Matching is read-only; public visitors cannot create approved provider links.
  return reply(matches as (OfficialCandidate&KashrutEvidence)[]);
 }catch{return NextResponse.json({error:"KASHRUT_UNAVAILABLE"},{status:503,headers});}
}
