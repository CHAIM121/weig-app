import {NextRequest,NextResponse} from "next/server";
import {authorize} from "@/modules/kashrut-admin/authorize";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
const pageSize=24;
const escapeLike=(value:string)=>value.replace(/[\\%_]/g,"\\$&");

export async function GET(request:NextRequest){
 try{
  const auth=await authorize();
  if(auth.error)return auth.error;
  const params=request.nextUrl.searchParams;
  const page=Number(params.get("page")??"0");
  const search=(params.get("search")??"").trim();
  const certifier=(params.get("certifier")??"").trim();
  const listing=params.get("listing")??"all";
  if(!Number.isSafeInteger(page)||page<0||page>100000||search.length>100||certifier.length>100||!["all","active","inactive"].includes(listing))
   return fail("מסנני החיפוש אינם תקינים",400);
  let query=auth.client!.from("weig_kashrut_evidence")
   .select("id,place_id,business_name,address,city,country,business_phone,certifier,level,food_type,source,source_label,source_url,certificate_url,evidence_type,valid_until,verified_at,fetched_at,source_updated_at,active_in_directory",{count:"exact"})
   .order("business_name",{ascending:true}).order("id",{ascending:true}).range(page*pageSize,(page+1)*pageSize-1);
  if(search)query=query.ilike("business_name","%"+escapeLike(search)+"%");
  if(certifier)query=query.ilike("certifier","%"+escapeLike(certifier)+"%");
  if(listing!=="all")query=query.eq("active_in_directory",listing==="active");
  const result=await query;
  if(result.error)return fail("טעינת פרטי החנויות נכשלה",503);
  return NextResponse.json({stores:result.data??[],total:result.count??0,page,pageSize},{headers});
 }catch{return fail("שירות החנויות אינו זמין כרגע",503)}
}
