// @vitest-environment node
import {describe,expect,it,vi} from "vitest";
import {collectYokneam,fetchGovernmentJson,yokneamProfile} from "@/modules/kashrut-admin/yokneam-adapter";
import {stageCollection} from "@/modules/kashrut-admin/ingestion";
const fields=["_id","council_name","business_name","city_name","street_name","location","business_type","kosher_type","parve","dairy","meat"].map(id=>({id}));
function row(id=1){return {_id:id,council_name:"יקנעם עילית",business_name:`עסק ${id}`,city_name:"יקנעם עילית" as string|null,street_name:"רחוב לדוגמה" as string|null,location:"1" as string|null,business_type:"מזון",kosher_type:"רגיל",parve:null,dairy:null,meat:"בשרי",supervisor_name:"Private contact",supervisor_phone:"secret-phone"};}
function metadata(){return {success:true,result:{name:"kosherbusiness",private:false,state:"active",isopen:true,license_id:"other-open",metadata_modified:"2026-03-24T07:00:00",organization:{name:"religion-office",approval_status:"approved"},resources:[{id:yokneamProfile.resourceId,name:"בתי עסק מושגחים רבנות יקנעם עלית ",state:"active",datastore_active:true,datastore_contains_all_records_of_source_file:true,last_modified:"2026-03-24T06:46:12.205249",metadata_modified:"2026-03-24T06:46:12.237580"}]}};}
function page(records=[row()],total=records.length){return {success:true,result:{resource_id:yokneamProfile.resourceId,total,total_was_estimated:false,fields,records}};}
const clock=()=>new Date("2026-10-11T23:00:00Z");
describe("government source adapter",()=>{
 it("collects an exact published file with source date and unknown scope",async()=>{
  const transport=vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(page()).mockResolvedValueOnce(metadata());
  const result=await collectYokneam(transport,clock);
  expect(result).toMatchObject({outcome:"success",completeness:"full",expectedRecords:1,expectedPages:1,receivedPages:1});
  expect(result.records[0]).toMatchObject({scope:"unspecified",validUntil:null,sourceUpdatedAt:"2026-03-24T06:46:12.205249Z",claims:{meat:"yes",dairy:"unknown",parve:"unknown"}});
  expect(JSON.stringify(result)).not.toContain("Private contact");expect(JSON.stringify(result)).not.toContain("secret-phone");
  expect(stageCollection(result,clock()).status).toBe("staged");
 });
 it("retains incomplete source identities without guessing a town or address",async()=>{
  const incomplete={...row(),city_name:null,street_name:null,location:null};
  const result=await collectYokneam(async url=>url.includes("package_show")?metadata():page([incomplete]),clock);
  expect(result.records[0]).toMatchObject({address:"",city:"",matchEligible:false});
  expect(stageCollection(result,clock()).status).toBe("staged");
 });
 it("reads every page in stable sorted order and verifies the final metadata",async()=>{
  const transport=vi.fn(async(url:string)=>url.includes("package_show")?metadata():new URL(url).searchParams.get("offset")==="0"?page(Array.from({length:200},(_,i)=>row(i+1)),201):page([row(201)],201));
  const result=await collectYokneam(transport,clock);
  expect(result).toMatchObject({outcome:"success",expectedPages:2,receivedPages:2});expect(result.records).toHaveLength(201);
  expect(transport.mock.calls.filter(([url])=>url.includes("datastore_search")).every(([url])=>new URL(url).searchParams.get("sort")==="_id asc")).toBe(true);
 });
 it.each(["schema","estimated","truncated","duplicate","identity","claim"])("rejects %s drift",async scenario=>{
  const data=page();
  if(scenario==="schema")data.result.fields=[];
  if(scenario==="estimated")data.result.total_was_estimated=true;
  if(scenario==="truncated")data.result.total=20;
  if(scenario==="duplicate"){data.result.records=[row(),row()];data.result.total=2;}
  if(scenario==="identity")data.result.records[0].council_name="Other council";
  if(scenario==="claim")data.result.records[0].meat="Unknown label";
  const result=await collectYokneam(async url=>url.includes("package_show")?metadata():data,clock);
  expect(result.outcome).not.toBe("success");expect(stageCollection(result,clock()).status).toBe("quarantined");
 });
 it("rejects changed permission/ownership before requesting records",async()=>{
  const meta=metadata();meta.result.license_id="closed";const transport=vi.fn().mockResolvedValue(meta);
  expect((await collectYokneam(transport,clock)).failureReason).toBe("source_identity_or_license_changed");expect(transport).toHaveBeenCalledTimes(1);
 });
 it("quarantines a replacement file that changes while reading",async()=>{
  const updated=metadata();updated.result.resources[0].last_modified="2026-03-25T00:00:00";
  const transport=vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(page()).mockResolvedValueOnce(updated);
  const result=await collectYokneam(transport,clock);expect(result).toMatchObject({outcome:"partial",failureReason:"source_changed_during_collection"});
 });
 it("does not follow returned URLs or upstream redirects",async()=>{
  await expect(fetchGovernmentJson("https://evil.example/api/3/action/package_show")).rejects.toThrow("disallowed_source_url");
  const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(null,{status:403}));
  try{await expect(fetchGovernmentJson("https://data.gov.il/api/3/action/package_show?id=kosherbusiness")).rejects.toThrow("source_access_blocked");expect(fetcher.mock.calls[0][1]?.redirect).toBe("error");expect(fetcher).toHaveBeenCalledTimes(1);}finally{fetcher.mockRestore();}
 });
 it("retries transient responses and bounds payload size",async()=>{
  const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(new Response('{"success":true}',{headers:{"content-type":"application/json"}}));
  try{expect(await fetchGovernmentJson("https://data.gov.il/api/3/action/package_show?id=kosherbusiness")).toEqual({success:true});expect(fetcher).toHaveBeenCalledTimes(2);}finally{fetcher.mockRestore();}
  const large=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("x".repeat(2_000_001),{headers:{"content-type":"application/json"}}));
  try{await expect(fetchGovernmentJson("https://data.gov.il/api/3/action/package_show?id=kosherbusiness")).rejects.toThrow("source_response_too_large");}finally{large.mockRestore();}
 });
});
