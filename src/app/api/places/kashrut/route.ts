import {NextRequest,NextResponse} from "next/server";
import {getPublicSupabaseConfig} from "@/lib/supabase/config";
import {evidenceStatus,type KashrutEvidence} from "@/modules/places/kashrut";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(request:NextRequest){
 const id=request.nextUrl.searchParams.get("id")??"";
 if(!/^[A-Za-z0-9_-]{5,200}$/.test(id))return NextResponse.json({error:"INVALID_PLACE"},{status:400,headers});
 const config=getPublicSupabaseConfig();
 if(!config)return NextResponse.json({error:"KASHRUT_UNAVAILABLE"},{status:503,headers});
 const read=async(path:string)=>{
  const r=await fetch(`${config.url}/rest/v1/${path}`,{headers:{apikey:config.anonKey,Authorization:`Bearer ${config.anonKey}`},cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error("Kashrut unavailable");return r.json();
 };
 try{
  const links=await read(`weig_place_provider_links?provider=eq.${id.startsWith("weig_")?"weig_catalog":"google"}&external_id=eq.${encodeURIComponent(id)}&match_status=eq.approved&select=place_id&limit=1`) as {place_id:string}[];
  if(!links.length)return NextResponse.json({status:"missing",evidence:[]},{headers});
  const fields="id,certifier,level,food_type,evidence_type,source_url,certificate_url,valid_until,verified_at,fetched_at,source_updated_at";
  const rows=await read(`weig_kashrut_evidence?place_id=eq.${encodeURIComponent(links[0].place_id)}&select=${fields}&order=fetched_at.desc&limit=10`) as KashrutEvidence[];
  return NextResponse.json({status:rows.length?"available":"missing",evidence:rows.map(e=>({...e,status:evidenceStatus(e)}))},{headers});
 }catch{return NextResponse.json({error:"KASHRUT_UNAVAILABLE"},{status:503,headers});}
}
