import {afterEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {validateRecord} from "@/modules/kashrut-admin/registry";
const mock=vi.hoisted(()=>({create:vi.fn()}));
vi.mock("@/lib/supabase/auth-server",()=>({createAuthServerClient:mock.create}));
import {GET,POST} from "@/app/api/kashrut/admin/route";
afterEach(()=>vi.resetAllMocks());
const agency={code:"example",name_he:"גוף לדוגמה",name_en:"Example",kind:"independent",aliases:[],countries:["IL"],official_url:"",status:"candidate",notes:""};
describe("registry validation",()=>{
 it("keeps a candidate distinct from a verified agency",()=>expect(validateRecord("agencies",agency).status).toBe("candidate"));
 it("requires an official source and documented evidence before marking verified",()=>{expect(()=>validateRecord("agencies",{...agency,status:"verified"})).toThrow();expect(()=>validateRecord("agencies",{...agency,status:"verified",official_url:"https://example.org/"})).toThrow();expect(validateRecord("agencies",{...agency,status:"verified",official_url:"https://example.org/",notes:"פרסום רשמי שנבדק"}).status).toBe("verified")});
 it("rejects an unsafe URL or embedded credentials",()=>{expect(()=>validateRecord("agencies",{...agency,official_url:"javascript:alert(1)"})).toThrow();expect(()=>validateRecord("agencies",{...agency,official_url:"https://secret:password@example.org/"})).toThrow()});
 it("does not allow client-supplied manager permissions or verification dates",()=>{const out=validateRecord("agencies",{...agency,role:"admin",verified_at:"2099-01-01",version:99});expect(out.role).toBeUndefined();expect(out.verified_at).toBeUndefined();expect(out.version).toBeUndefined()});
 it("validates country codes",()=>expect(()=>validateRecord("agencies",{...agency,countries:["Israel"]})).toThrow());
 it("requires a decision and selected subject when resolving a review",()=>{const review={title:"אימות גוף",subject_type:"agency",agency_id:"11111111-1111-1111-1111-111111111111",reason:"",status:"resolved",decision:""};expect(()=>validateRecord("reviews",review)).toThrow();const out=validateRecord("reviews",{...review,decision:"מקור רשמי נבדק",source_id:"22222222-2222-2222-2222-222222222222"});expect(out.source_id).toBeNull()});
 it("does not mark a scanner active through the registry",()=>expect(()=>validateRecord("sources",{code:"source",name_he:"מקור רשמי",agency_id:"11111111-1111-1111-1111-111111111111",publisher:"",url:"https://example.org/",format:"html",status:"candidate",connection_state:"active",coverage:"",completeness:"unknown",notes:""})).toThrow());
});
describe("manager authorization",()=>{
 it("requires server-validated login",async()=>{mock.create.mockResolvedValue({auth:{getUser:vi.fn().mockResolvedValue({data:{user:null}})}});expect((await GET(new NextRequest("https://weig-app.vercel.app/api/kashrut/admin"))).status).toBe(401)});
 it("does not trust user-editable metadata to grant management access",async()=>{const maybeSingle=vi.fn().mockResolvedValue({data:null});const from=vi.fn().mockReturnValue({select:()=>({eq:()=>({maybeSingle})})});mock.create.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:"user",user_metadata:{role:"admin"}}}})},from});expect((await GET(new NextRequest("https://weig-app.vercel.app/api/kashrut/admin"))).status).toBe(403);expect(from).toHaveBeenCalledTimes(1);expect(from).toHaveBeenCalledWith("weig_kashrut_managers")});
 it("rejects cross-origin writes before touching authentication or data",async()=>{const response=await POST(new NextRequest("https://weig-app.vercel.app/api/kashrut/admin",{method:"POST",headers:{origin:"https://other.example","content-type":"application/json"},body:"{}"}));expect(response.status).toBe(403);expect(mock.create).not.toHaveBeenCalled()});
 it("checks manager authorization before accepting a write",async()=>{mock.create.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:"user"}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})})});const r=await POST(new NextRequest("https://weig-app.vercel.app/api/kashrut/admin",{method:"POST",headers:{origin:"https://weig-app.vercel.app","content-type":"application/json"},body:JSON.stringify({entity:"agencies",values:agency})}));expect(r.status).toBe(403)});
});
