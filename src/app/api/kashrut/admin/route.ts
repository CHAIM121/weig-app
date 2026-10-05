import {NextRequest,NextResponse} from "next/server";
import {authorize} from "@/modules/kashrut-admin/authorize";
import {entities,uuid,validateRecord,type Entity} from "@/modules/kashrut-admin/registry";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});

export async function GET(request:NextRequest){
 try{
  const auth=await authorize();if(auth.error)return auth.error;
  if(request?.nextUrl.searchParams.get("access")==="1")return NextResponse.json({manager:true},{headers});
  const keys=Object.keys(entities) as Entity[];
  const results=await Promise.all(keys.map(key=>auth.client!.from(entities[key]).select("*").order("created_at",{ascending:false}).limit(1000)));
  if(results.some(r=>r.error))return fail("טעינת המאגר נכשלה",503);
  const audit=await auth.client!.from("weig_kashrut_registry_audit").select("id,table_name,record_id,operation,created_at,actor_id").order("created_at",{ascending:false}).limit(50);
  if(audit.error)return fail("טעינת היסטוריית השינויים נכשלה",503);
  return NextResponse.json({data:Object.fromEntries(keys.map((k,i)=>[k,results[i].data])),audit:audit.data,userId:auth.user!.id,truncated:results.some(r=>r.data?.length===1000)},{headers});
 }catch{return fail("השירות אינו זמין כרגע",503)}
}
export async function POST(request:NextRequest){
 if(request.headers.get("origin")!==request.nextUrl.origin)return fail("מקור הבקשה אינו מאושר",403);
 if(!request.headers.get("content-type")?.includes("application/json"))return fail("פורמט הבקשה אינו תקין",400);
 try{
  const auth=await authorize();if(auth.error)return auth.error;
  const bodyText=await request.text();if(bodyText.length>20000)return fail("הבקשה גדולה מדי",413);
  let body;try{body=JSON.parse(bodyText)}catch{return fail("הבקשה אינה תקינה",400)}
  if(!body||typeof body!=="object"||!Object.hasOwn(entities,body.entity))return fail("סוג רשומה אינו תקין",400);
  const entity=body.entity as Entity;
  if(body.id&&(!uuid.test(body.id)||!Number.isInteger(body.version)||body.version<1))return fail("מזהה או גרסת רשומה אינם תקינים",400);
  let values;try{values=validateRecord(entity,body.values)}catch(e){return fail(e instanceof Error?e.message:"ערכים אינם תקינים",400)}
  const table=auth.client!.from(entities[entity]);
  // Version filtering prevents silent overwrites of another manager's changes.
  const result=body.id?await table.update(values).eq("id",body.id).eq("version",body.version).select().maybeSingle():await table.insert(values).select().single();
  if(result.error)return fail(result.error.code==="23505"?"המזהה כבר קיים במאגר":"השמירה נכשלה; בדקו את הערכים והפריטים המקושרים",result.error.code==="23505"?409:400);
  if(!result.data)return fail("הרשומה השתנתה מאז שנפתחה. רעננו לפני עריכה נוספת",409);
  return NextResponse.json({record:result.data},{status:body.id?200:201,headers});
 }catch{return fail("השירות אינו זמין כרגע",503)}
}
