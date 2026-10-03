import { NextRequest,NextResponse } from "next/server";
import {catalogCategories,catalogRequest,presentCatalogPlace} from "@/modules/places/catalog";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(request:NextRequest) {
 const p=request.nextUrl.searchParams;
 const q=(p.get("query")??"").trim(),city=(p.get("city")??"").trim();
 const lat=p.has("lat")?Number(p.get("lat")):null,lng=p.has("lng")?Number(p.get("lng")):null;
 const page=Number(p.get("page")??0), map=p.get("map")==="1";
 if(q.length>100||city.length>60||!Number.isInteger(page)||page<0||page>100||((lat===null)!==(lng===null))||lat!==null&&(!Number.isFinite(lat)||lat< -90||lat>90)||lng!==null&&(!Number.isFinite(lng)||lng< -180||lng>180))return NextResponse.json({error:"INVALID_SEARCH"},{status:400,headers});
 if(!city&&lat===null)return NextResponse.json({error:"LOCATION_REQUIRED"},{status:400,headers});
 const category=p.get("feed")==="1"?null:catalogCategories[p.get("category")??""]??null;
 try {
  const size=map?300:24;
  const rows=await catalogRequest("rpc/weig_search_places",{q,city_filter:city,lat,lng,radius_m:15000,category_filter:category,page_offset:map?0:page*size,page_size:size+1});
  return NextResponse.json({places:rows.slice(0,size).map(presentCatalogPlace),hasMore:rows.length>size,source:"weig_catalog",coverage:"Imported regions only; kosher status is unverified"},{headers});
 } catch(error) {return NextResponse.json({error:error instanceof Error&&error.message==="CATALOG_NOT_CONFIGURED"?"CATALOG_NOT_CONFIGURED":"CATALOG_UNAVAILABLE"},{status:503,headers});}
}
