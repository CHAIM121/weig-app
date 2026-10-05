import {NextRequest,NextResponse} from "next/server";
import {authorize} from "@/modules/kashrut-admin/authorize";
import {uuid} from "@/modules/kashrut-admin/registry";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
export async function GET(){
 try{
  const auth=await authorize();if(auth.error)return auth.error;
  const result=await auth.client!.from("weig_kashrut_monitor_runs").select("id,source_id,checked_at,mode,baseline,total_count,active_count,stale_count,expired_count,last_source_fetch,changes").order("checked_at",{ascending:false}).limit(50);
  if(result.error)return fail("טעינת היסטוריית הבדיקות נכשלה",503);
  return NextResponse.json({runs:result.data},{headers});
 }catch{return fail("השירות אינו זמין כרגע",503)}
}
export async function POST(request:NextRequest){
 if(request.headers.get("origin")!==request.nextUrl.origin)return fail("מקור הבקשה אינו מאושר",403);
 if(!request.headers.get("content-type")?.includes("application/json"))return fail("פורמט הבקשה אינו תקין",400);
 try{
  const auth=await authorize();if(auth.error)return auth.error;
  const raw=await request.text();if(raw.length>1000)return fail("הבקשה גדולה מדי",413);
  let body;try{body=JSON.parse(raw)}catch{return fail("הבקשה אינה תקינה",400)}
  if(!body||typeof body.source_id!=="string"||!uuid.test(body.source_id)||Object.keys(body).some(k=>k!=="source_id"))return fail("יש לבחור מקור רשום; נתונים לבדיקה נקראים מהמאגר בלבד",400);
  const result=await auth.client!.rpc("weig_kashrut_check_stored_data",{p_source_id:body.source_id});
  if(result.error)return fail("בדיקת המאגר נכשלה",result.error.code==="42501"?403:503);
  return NextResponse.json({run_id:result.data},{headers});
 }catch{return fail("השירות אינו זמין כרגע",503)}
}
