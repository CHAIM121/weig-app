import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {AdminConsole} from "@/components/admin-console";

vi.mock("@/components/kashrut-admin",()=>({KashrutAdmin:()=> <div>ניהול אנשי קשר</div>}));
afterEach(()=>{cleanup();vi.restoreAllMocks()});
const overview={
 profiles:[{id:"11111111-1111-1111-1111-111111111111",display_name:"משתמש בדיקה",created_at:"2026-10-10T10:00:00Z",updated_at:"2026-10-11T10:00:00Z",archived_at:null}],
 profilesCount:1,profilesTruncated:false,
 sources:[{id:"1",name_he:"מקור רשמי",publisher:"רשות מקומית",url:"https://example.org",format:"html",status:"candidate",connection_state:"planned",content_kind:"establishments",access_status:"not_checked",coverage:"בית שמש",updated_at:"2026-10-11"}],
 agencyCount:34,evidenceCount:1661,
 providers:[{id:"google-places",name:"Google Places",category:"מקומות",state:"configured",description:"מוגדר בשרת"}],
};
it("offers separate management sections and switches between contacts and stores",async()=>{
 const fetcher=vi.spyOn(globalThis,"fetch").mockImplementation(async input=>{
  const url=String(input);
  if(url.includes("/api/admin/overview"))return new Response(JSON.stringify(overview));
  if(url.includes("/api/admin/stores"))return new Response(JSON.stringify({stores:[{id:"1",place_id:"p",business_name:"מסעדת בדיקה",address:"רחוב 10",city:"בית שמש",country:"IL",business_phone:"02-1234567",certifier:"רבנות בית שמש",level:"מהדרין",food_type:"בשרי",source:"beit_shemesh_council",source_label:"רשימה רשמית",source_url:"https://example.org",certificate_url:null,evidence_type:"official_listing",valid_until:null,verified_at:null,fetched_at:"2026-10-11T10:00:00Z",source_updated_at:null,active_in_directory:true}],total:1,page:0,pageSize:24}));
  throw new Error("Unexpected API: "+url);
 });
 render(<AdminConsole locale="he"/>);
 expect(await screen.findByText("ניהול אנשי קשר")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("tab",{name:/פרטי חנויות/}));
 expect(await screen.findByText("מסעדת בדיקה")).toBeInTheDocument();
 expect(screen.getByText("רבנות בית שמש")).toBeInTheDocument();
 expect(screen.getByText("לא פורסם")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:/API וחברות מקושרות/}));
 expect(screen.getByText("Google Places")).toBeInTheDocument();
 expect(screen.getByText("מקור רשמי")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:/משתמשים/}));
 expect(screen.getByText("משתמש בדיקה")).toBeInTheDocument();
 expect(fetcher.mock.calls.some(([url])=>String(url).includes("/api/admin/stores"))).toBe(true);
});
it("blocks the administration screen if permission is missing",async()=>{
 vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({error:"MANAGER_REQUIRED"}),{status:403}));
 render(<AdminConsole locale="he"/>);
 expect(await screen.findByText("אין הרשאת מנהל לחשבון זה")).toBeInTheDocument();
 expect(screen.queryByText("ניהול אנשי קשר")).not.toBeInTheDocument();
});
