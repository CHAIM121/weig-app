import {afterEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const mock=vi.hoisted(()=>({create:vi.fn()}));
vi.mock("@/lib/supabase/auth-server",()=>({createAuthServerClient:mock.create}));
import {GET,POST} from "@/app/api/kashrut/monitor/route";
afterEach(()=>vi.resetAllMocks());
const source="11111111-1111-1111-1111-111111111111";
function client(manager=true){
 const rpc=vi.fn().mockResolvedValue({data:"run"});
 const c={auth:{getUser:async()=>({data:{user:{id:"user"}}})},from:vi.fn().mockReturnValue({select:()=>({eq:()=>({maybeSingle:async()=>({data:manager?{user_id:"user"}:null})})})}),rpc};
 mock.create.mockResolvedValue(c);return c;
}
const request=(body:object,origin="https://weig-app.vercel.app")=>new NextRequest("https://weig-app.vercel.app/api/kashrut/monitor",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
it("denies a non-manager before reading snapshots or running a check",async()=>{const c=client(false);expect((await GET()).status).toBe(403);expect((await POST(request({source_id:source}))).status).toBe(403);expect(c.rpc).not.toHaveBeenCalled()});
it("rejects cross-origin checks",async()=>{expect((await POST(request({source_id:source},"https://other.example"))).status).toBe(403);expect(mock.create).not.toHaveBeenCalled()});
it("cannot accept client-supplied records, timestamps or actor identities",async()=>{const c=client();expect((await POST(request({source_id:source,records:[],actor_id:"other"}))).status).toBe(400);expect(c.rpc).not.toHaveBeenCalled()});
it("reads the check input from the database and passes only the source id",async()=>{const c=client();const result=await POST(request({source_id:source}));expect(result.status).toBe(200);expect(await result.json()).toEqual({run_id:"run"});expect(c.rpc).toHaveBeenCalledWith("weig_kashrut_check_stored_data",{p_source_id:source})});
it("reports a failed check without a fabricated success",async()=>{const c=client();c.rpc.mockResolvedValue({data:null,error:{code:"42501"}} as never);expect((await POST(request({source_id:source}))).status).toBe(403)});
