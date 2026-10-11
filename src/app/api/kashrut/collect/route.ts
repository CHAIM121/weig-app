import {NextRequest,NextResponse} from "next/server";
import {authorize} from "@/modules/kashrut-admin/authorize";
import {uuid} from "@/modules/kashrut-admin/registry";
import {sourceReadiness} from "@/modules/kashrut-admin/source-readiness";
import {collectYokneam,yokneamProfile} from "@/modules/kashrut-admin/yokneam-adapter";
import {stageCollection,compareStagedCollections,type StagedSnapshot} from "@/modules/kashrut-admin/ingestion";
export const runtime="nodejs";
export const maxDuration=300;
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
export async function GET(request:NextRequest){
 try{
  const auth=await authorize();if(auth.error)return auth.error;
  const id=request.nextUrl.searchParams.get("run_id");
  if(id && !uuid.test(id))return fail("מזהה ריצה אינו תקין",400);
  const table=auth.client!.from("weig_kashrut_collection_runs");
  const result=id?await table.select("id,changes").eq("id",id).maybeSingle():await table.select("id,source_id,started_at,finished_at,status,record_count,source_updated_at,reasons,change_count").order("started_at",{ascending:false}).limit(50);
  if(result.error)return fail("היסטוריית האיסוף אינה זמינה; תשתית המסד צריכה להיות מותקנת",503);
  if(id && !result.data)return fail("הריצה אינה קיימת",404);
  return NextResponse.json(id?{run:result.data}:{runs:result.data},{headers});
 }catch{return fail("השירות אינו זמין כרגע",503);}
}
export async function POST(request:NextRequest){
 if(request.headers.get("origin")!==request.nextUrl.origin)return fail("מקור הבקשה אינו מאושר",403);
 if(!request.headers.get("content-type")?.includes("application/json"))return fail("פורמט הבקשה אינו תקין",400);
 try{
  const auth=await authorize();if(auth.error)return auth.error;
  const raw=await request.text();if(raw.length>1000)return fail("הבקשה גדולה מדי",413);
  let body;try{body=JSON.parse(raw);}catch{return fail("הבקשה אינה תקינה",400);}
  if(!body || typeof body.source_id!=="string" || !uuid.test(body.source_id) || typeof body.request_key!=="string" || !uuid.test(body.request_key) || Object.keys(body).some(k=>!["source_id","request_key"].includes(k)))return fail("יש לבחור מקור ומזהה ריצה; כתובות ותוכן איסוף אינם מתקבלים מהלקוח",400);
  const sourceResult=await auth.client!.from("weig_kashrut_registry_sources").select("*").eq("id",body.source_id).maybeSingle();
  if(sourceResult.error)return fail("טעינת המקור נכשלה",503);
  const source=sourceResult.data;if(!source)return fail("המקור אינו קיים",404);
  const agencyResult=await auth.client!.from("weig_kashrut_agencies").select("*").eq("id",source.agency_id).maybeSingle();
  if(agencyResult.error)return fail("טעינת הגוף נכשלה",503);
  const readiness=sourceReadiness(source,agencyResult.data??undefined);
  if(!readiness.ready)return NextResponse.json({error:"המקור טרם עבר את תנאי האיסוף",blockers:readiness.blockers},{status:409,headers});
  if(source.code!==yokneamProfile.sourceCode || source.url!==yokneamProfile.sourceUrl || source.adapter_version!==yokneamProfile.adapterVersion || agencyResult.data?.code!==yokneamProfile.agencyCode || source.content_kind!=="establishments")return fail("אין מתאם בדוק שתואם למקור ולגוף הרשומים",409);
  const begin=await auth.client!.rpc("weig_kashrut_collection_begin",{p_source_id:source.id,p_source_version:source.version,p_request_key:body.request_key,p_adapter_version:yokneamProfile.adapterVersion,p_coverage_key:yokneamProfile.coverageKey});
  if(begin.error)return fail("לא ניתן להתחיל איסוף; בדקו הרשאות, גרסת מקור וריצה פעילה",begin.error.code==="42501"?403:begin.error.code==="55P03"||begin.error.code==="40001"?409:503);
  if(begin.data.reused)return NextResponse.json({run_id:begin.data.run_id,status:begin.data.status,reused:true},{headers});
  const collection=await collectYokneam(),staged=stageCollection(collection);
  const comparison=staged.status==="staged"?compareStagedCollections(begin.data.baseline as StagedSnapshot|null,staged.snapshot):null;
  const reasons=staged.status==="quarantined"?[...staged.reasons,...(collection.failureReason?[collection.failureReason]:[])]:comparison!.reasons;
  const finished=await auth.client!.rpc("weig_kashrut_collection_finish",{p_run_id:begin.data.run_id,p_snapshot:staged.status==="staged"?staged.snapshot:null,p_changes:comparison?.changes??[],p_reasons:reasons});
  if(finished.error)return fail("האיסוף בוצע אך שמירת הריצה נכשלה; נתוני הכשרות לא עודכנו",503);
  return NextResponse.json({run_id:begin.data.run_id,status:finished.data,records:collection.records.length,changes:comparison?.changes.length??0,writes_public_evidence:false},{headers});
 }catch{return fail("האיסוף נכשל; נתוני הכשרות לא עודכנו",503);}
}
