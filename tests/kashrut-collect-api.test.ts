import {afterEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const mock=vi.hoisted(()=>({create:vi.fn(),collect:vi.fn()}));
vi.mock("@/lib/supabase/auth-server",()=>({createAuthServerClient:mock.create}));
vi.mock("@/modules/kashrut-admin/yokneam-adapter",async importOriginal=>({...await importOriginal<object>(),collectYokneam:mock.collect}));
import {GET,POST} from "@/app/api/kashrut/collect/route";
import {yokneamProfile} from "@/modules/kashrut-admin/yokneam-adapter";
afterEach(()=>vi.resetAllMocks());
const id="11111111-1111-4111-8111-111111111111",key="22222222-2222-4222-8222-222222222222";
const source={id,version:1,code:yokneamProfile.sourceCode,url:yokneamProfile.sourceUrl,agency_id:id,status:"verified",access_status:"allowed",terms_url:yokneamProfile.termsUrl,access_notes:"Open data checked",coverage:"Published resource",content_kind:"establishments",stable_key:"version scoped row id",refresh_frequency:"manual",adapter_version:yokneamProfile.adapterVersion,adapter_test_status:"passed",adapter_test_notes:"Fixture tests passed",connection_state:"manual_import"};
function client(manager=true,overrides:object={}){
 const rpc=vi.fn().mockResolvedValueOnce({data:{run_id:id,reused:false,baseline:null}}).mockResolvedValue({data:"failed"});
 const from=vi.fn((table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==="weig_kashrut_managers"?(manager?{user_id:id}:null):table==="weig_kashrut_registry_sources"?{...source,...overrides}:{id,version:1,status:"verified",code:yokneamProfile.agencyCode}})}),order:()=>({limit:async()=>({data:[]})})})}));
 const c={auth:{getUser:async()=>({data:{user:{id}}})},from,rpc};mock.create.mockResolvedValue(c);return c;
}
const request=(body:object,origin="https://weig-app.vercel.app")=>new NextRequest("https://weig-app.vercel.app/api/kashrut/collect",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
it("denies non-managers before any source access",async()=>{
 const c=client(false);expect((await GET(new NextRequest("https://weig-app.vercel.app/api/kashrut/collect"))).status).toBe(403);expect((await POST(request({source_id:id,request_key:key}))).status).toBe(403);expect(c.rpc).not.toHaveBeenCalled();expect(mock.collect).not.toHaveBeenCalled();
});
it("rejects cross-origin requests and injected collection payloads",async()=>{
 expect((await POST(request({source_id:id,request_key:key},"https://other.example"))).status).toBe(403);
 const c=client();expect((await POST(request({source_id:id,request_key:key,url:"https://evil.example",records:[]}))).status).toBe(400);expect(c.rpc).not.toHaveBeenCalled();
});
it("requires documented readiness and exact registered adapter identity",async()=>{
 client(true,{access_status:"not_checked"});expect((await POST(request({source_id:id,request_key:key}))).status).toBe(409);
 client(true,{url:"https://other.example"});expect((await POST(request({source_id:id,request_key:key}))).status).toBe(409);expect(mock.collect).not.toHaveBeenCalled();
});
it("does not fetch twice when a request already owns a run",async()=>{
 const c=client();c.rpc.mockReset().mockResolvedValue({data:{run_id:id,reused:true,status:"staged"}});
 const response=await POST(request({source_id:id,request_key:key}));expect(response.status).toBe(200);expect(mock.collect).not.toHaveBeenCalled();expect(c.rpc).toHaveBeenCalledTimes(1);
});
it("records a source failure without staging or updating public evidence",async()=>{
 const c=client();mock.collect.mockResolvedValue({sourceCode:yokneamProfile.sourceCode,adapterVersion:yokneamProfile.adapterVersion,coverageKey:yokneamProfile.coverageKey,startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),outcome:"failed",completeness:"unknown",expectedPages:null,receivedPages:0,expectedRecords:null,completenessEvidence:"",failureReason:"source_access_blocked",records:[]});
 const response=await POST(request({source_id:id,request_key:key}));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({status:"failed",writes_public_evidence:false});
 expect(c.rpc.mock.calls[1][1]).toMatchObject({p_snapshot:null,p_changes:[],p_reasons:expect.arrayContaining(["source_access_blocked"])});
 expect(c.from.mock.calls.some(([table])=>table==="weig_kashrut_evidence")).toBe(false);
});
it("does not claim persistence when finalization fails",async()=>{
 const c=client();c.rpc.mockReset().mockResolvedValueOnce({data:{run_id:id,reused:false,baseline:null}}).mockResolvedValueOnce({error:{code:"40001"}});
 mock.collect.mockResolvedValue({records:[],outcome:"failed"});
 expect((await POST(request({source_id:id,request_key:key}))).status).toBe(503);
});
