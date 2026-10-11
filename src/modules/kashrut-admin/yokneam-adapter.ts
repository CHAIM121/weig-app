import type {CollectedEvidence,Collection} from "./ingestion";

export const yokneamProfile={
 sourceCode:"yokneam_government",agencyCode:"yokneam_council",adapterVersion:"yokneam-ckan-v1",
 resourceId:"c54032cb-5306-4be9-a20d-a0be0ba49cc1",
 sourceUrl:"https://data.gov.il/he/datasets/religion-office/kosherbusiness/c54032cb-5306-4be9-a20d-a0be0ba49cc1",
 termsUrl:"https://data.gov.il/he/terms-of-use",
 coverageKey:"resource:c54032cb-5306-4be9-a20d-a0be0ba49cc1;all-rows;key:resource-row-id;scope:unspecified;v1",
} as const;
export type JsonTransport=(url:string)=>Promise<unknown>;
const api="https://data.gov.il/api/3/action/";
const packageUrl=`${api}package_show?id=kosherbusiness`;
const requiredFields=["_id","council_name","business_name","city_name","street_name","location","business_type","kosher_type","parve","dairy","meat"];
function object(value:unknown):Record<string,unknown>{
 if(!value || typeof value!=="object" || Array.isArray(value))throw Error("invalid_source_shape");
 return value as Record<string,unknown>;
}
function result(value:unknown){const response=object(value);if(response.success!==true)throw Error("source_reported_failure");return object(response.result);}
function sourceMetadata(value:unknown){
 const p=result(value),organization=object(p.organization);
 if(p.name!=="kosherbusiness" || p.private!==false || p.state!=="active" || p.isopen!==true || p.license_id!=="other-open" || organization.name!=="religion-office" || organization.approval_status!=="approved")throw Error("source_identity_or_license_changed");
 if(!Array.isArray(p.resources))throw Error("missing_resources");
 const resource=p.resources.map(object).find(r=>r.id===yokneamProfile.resourceId);
 if(!resource || resource.datastore_active!==true || resource.datastore_contains_all_records_of_source_file!==true || resource.state!=="active" || resource.name!=="בתי עסק מושגחים רבנות יקנעם עלית ")throw Error("resource_identity_or_completeness_changed");
 if(typeof resource.last_modified!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(resource.last_modified))throw Error("invalid_resource_timestamp");
 // CKAN metadata timestamps without a suffix are UTC by API convention, not collection time.
 const sourceUpdatedAt=resource.last_modified+"Z";
 if(!Number.isFinite(Date.parse(sourceUpdatedAt)))throw Error("invalid_resource_timestamp");
 return {sourceUpdatedAt,revision:JSON.stringify([resource.last_modified,resource.metadata_modified,p.metadata_modified,resource.name,p.license_id])};
}
function text(value:unknown){if(value===null)return "";if(typeof value!=="string")throw Error("unexpected_field_type");return value.trim();}
function normalize(raw:unknown,sourceUpdatedAt:string):CollectedEvidence{
 const row=object(raw);
 if(!Number.isSafeInteger(row._id) || Number(row._id)<1)throw Error("invalid_row_id");
 const businessName=text(row.business_name),city=text(row.city_name),address=[text(row.street_name),text(row.location)].filter(Boolean).join(" ");
 if(!businessName || text(row.council_name)!=="יקנעם עילית" || (city && city!=="יקנעם עילית"))throw Error("identity_or_coverage_changed");
 const food:Record<string,"yes"|"unknown">={};
 for(const [key,label] of [["meat","בשרי"],["dairy","חלבי"],["parve","פרווה"]]){
  const value=text(row[key]);if(value && value!==label)throw Error("unknown_food_claim");food[key]=value?"yes":"unknown";
 }
 // Whitelist fields; never persist supervisor contacts, arbitrary payloads, or inferred scope/expiry.
 const sourceText=JSON.stringify({business_name:businessName,council_name:text(row.council_name),city_name:city,street_name:text(row.street_name),location:text(row.location),business_type:text(row.business_type),kosher_type:text(row.kosher_type),meat:text(row.meat),dairy:text(row.dairy),parve:text(row.parve)});
 return {sourceKey:String(row._id),agencyCode:yokneamProfile.agencyCode,businessName,address,city,country:"IL",matchEligible:Boolean(address && city),scope:"unspecified",scopeText:"היקף ההשגחה לא פורט ברשומה; אין להסיק פיקוח על כל העסק",evidenceType:"official_listing",sourceUrl:yokneamProfile.sourceUrl,sourceText,validUntil:null,sourceUpdatedAt,claims:food};
}

/** Read-only public API adapter. Caller must check live source readiness before scheduled use. */
export async function collectYokneam(transport:JsonTransport=fetchGovernmentJson,clock=()=>new Date()):Promise<Collection>{
 const collection:Collection={sourceCode:yokneamProfile.sourceCode,adapterVersion:yokneamProfile.adapterVersion,coverageKey:yokneamProfile.coverageKey,startedAt:clock().toISOString(),finishedAt:"",outcome:"failed",completeness:"unknown",expectedPages:null,receivedPages:0,expectedRecords:null,completenessEvidence:"",failureReason:null,records:[]};
 try{
  const before=sourceMetadata(await transport(packageUrl));
  let total:number|null=null,offset=0;
  const keys=new Set<string>(),pageSize=200;
  do{
   const url=new URL(`${api}datastore_search`);url.searchParams.set("resource_id",yokneamProfile.resourceId);url.searchParams.set("limit",String(pageSize));url.searchParams.set("offset",String(offset));url.searchParams.set("sort","_id asc");
   const page=result(await transport(url.toString()));
   if(page.resource_id!==yokneamProfile.resourceId || page.total_was_estimated!==false || !Number.isSafeInteger(page.total) || Number(page.total)<1 || Number(page.total)>10000)throw Error("invalid_or_estimated_total");
   const fields=page.fields;
   if(!Array.isArray(fields) || requiredFields.some(name=>!fields.some((f:unknown)=>object(f).id===name)))throw Error("source_schema_changed");
   if(total!==null && total!==page.total)throw Error("source_changed_during_pagination");
   total=Number(page.total);collection.expectedRecords=total;collection.expectedPages=Math.ceil(total/pageSize);
   if(!Array.isArray(page.records) || page.records.length!==Math.min(pageSize,total-offset))throw Error("missing_or_truncated_page");
   for(const raw of page.records){
    const record=normalize(raw,before.sourceUpdatedAt);
    if(keys.has(record.sourceKey))throw Error("duplicate_row_id");keys.add(record.sourceKey);collection.records.push(record);
   }
   collection.receivedPages++;offset+=page.records.length;
  }while(offset<total!);
  const after=sourceMetadata(await transport(packageUrl));
  if(before.revision!==after.revision)throw Error("source_changed_during_collection");
  collection.outcome="success";collection.completeness="full";
  collection.completenessEvidence=`CKAN exact total=${total}; all ${collection.receivedPages} sorted pages read; resource declares datastore_contains_all_records_of_source_file; metadata revision unchanged. Complete published file only, not all certified businesses or current certificates.`;
 }catch(error){
  collection.outcome=collection.records.length?"partial":"failed";
  // Error codes only; no response body, arbitrary upstream exception or contact details.
  const code=error instanceof Error?error.message:"collection_failed";
  collection.failureReason=/^[a-z_]+$/.test(code)?code:"collection_failed";
 }
 collection.finishedAt=clock().toISOString();return collection;
}

/** Fixed host/path, no redirect following, bounded bodies and retry only for transient responses. */
export async function fetchGovernmentJson(url:string):Promise<unknown>{
 const parsed=new URL(url);
 if(parsed.origin!=="https://data.gov.il" || !["/api/3/action/package_show","/api/3/action/datastore_search"].includes(parsed.pathname) || parsed.username || parsed.password)throw Error("disallowed_source_url");
 for(let attempt=0;attempt<3;attempt++){
  let response:Response;
  try{response=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(25000),cache:"no-store",headers:{Accept:"application/json","User-Agent":"WEIG-kashrut-readonly/1"}});}catch{throw Error("source_network_failure");}
  if([401,403].includes(response.status))throw Error("source_access_blocked");
  if((response.status===429 || response.status>=500) && attempt<2){await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,250*(2**attempt)));continue;}
  if(!response.ok)throw Error("source_http_failure");
  if(!response.headers.get("content-type")?.includes("application/json"))throw Error("unexpected_content_type");
  const reader=response.body?.getReader();if(!reader)throw Error("empty_response");
  const parts:Uint8Array[]=[];let size=0;
  try{
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000)throw Error("source_response_too_large");parts.push(value);}
  }finally{await reader.cancel();}
  try{return JSON.parse(Buffer.concat(parts).toString("utf8"));}catch{throw Error("invalid_source_json");}
 }
 throw Error("source_retry_exhausted");
}
