import {NextResponse} from "next/server";
import {authorize} from "@/modules/kashrut-admin/authorize";
import {getPublicSupabaseConfig} from "@/lib/supabase/config";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});

export async function GET(){
 try{
  const auth=await authorize();
  if(auth.error)return auth.error;
  const client=auth.client!;
  const [profiles,sources,agencyCount,evidenceCount]=await Promise.all([
   client.from("profiles").select("id,display_name,created_at,updated_at,archived_at",{count:"exact"}).order("created_at",{ascending:false}).limit(250),
   client.from("weig_kashrut_registry_sources").select("id,name_he,publisher,url,format,status,connection_state,content_kind,access_status,coverage,updated_at").order("name_he").limit(250),
   client.from("weig_kashrut_agencies").select("id",{count:"exact",head:true}),
   client.from("weig_kashrut_evidence").select("id",{count:"exact",head:true}),
  ]);
  if(profiles.error||sources.error||agencyCount.error||evidenceCount.error)return fail("טעינת נתוני הניהול נכשלה",503);
  return NextResponse.json({
   profiles:profiles.data??[],profilesCount:profiles.count??0,profilesTruncated:(profiles.count??0)>250,
   sources:sources.data??[],agencyCount:agencyCount.count??0,evidenceCount:evidenceCount.count??0,
   providers:[
    {id:"google-places",name:"Google Places",category:"מקומות וחיפוש",state:process.env.GOOGLE_PLACES_API_KEY?"configured":"missing",description:"מפתח API מוגדר בשרת; מצב התקשורת בפועל לא נבדק."},
    {id:"openai",name:"OpenAI",category:"עוזר AI",state:process.env.OPENAI_API_KEY?"configured":"missing",description:"מפתח API מוגדר בשרת; זמינות השירות בפועל לא נבדקה."},
    {id:"supabase",name:"Supabase",category:"בסיס נתונים והזדהות",state:getPublicSupabaseConfig()?"configured":"missing",description:"החיבור לבסיס הנתונים פעיל לבקשת ניהול זו."},
    {id:"waze",name:"Waze",category:"ניווט",state:"link",description:"פתיחה בניווט דרך קישור חיצוני, ללא מפתח API."},
   ],
  },{headers});
 }catch{return fail("שירות הניהול אינו זמין כרגע",503)}
}
