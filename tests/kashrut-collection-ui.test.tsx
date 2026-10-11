import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {KashrutCollection} from "@/components/kashrut-collection";
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const agency={id:"agency",version:1,status:"verified"};
const source={id:"11111111-1111-4111-8111-111111111111",version:1,agency_id:"agency",name_he:"מקור יקנעם",code:"yokneam_government",status:"verified",connection_state:"manual_import",access_status:"allowed",terms_url:"https://example.org/terms",access_notes:"Access permission checked",coverage:"Published resource",content_kind:"establishments",stable_key:"scoped id",refresh_frequency:"manual",adapter_version:"yokneam-ckan-v1",adapter_test_status:"passed",adapter_test_notes:"Fixture tests passed"};
it("disables external collection until access and adapter readiness pass",async()=>{
 vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({runs:[]})));
 render(<KashrutCollection sources={[{...source,access_status:"not_checked"}]} agencies={[agency]} onCollected={async()=>{}}/>);
 await screen.findByText("אין עדיין ריצות איסוף חיצוני.");expect(screen.getByRole("button",{name:"איסוף לבדיקה"})).toBeDisabled();expect(screen.getByText(/חסרה הרשאה מתועדת לאיסוף/)).toBeInTheDocument();
});
it("shows source dates separately and reports staging without claiming publication",async()=>{
 const refreshed=vi.fn();
 vi.spyOn(globalThis,"fetch").mockImplementation(async(_url,options)=>new Response(JSON.stringify(options?.method==="POST"?{status:"staged",run_id:"run"}:{runs:[{id:"run",source_id:source.id,started_at:"2026-10-11T22:00:00Z",finished_at:"2026-10-11T22:01:00Z",status:"staged",record_count:63,source_updated_at:"2026-03-24T06:46:12Z",reasons:[],change_count:63}]})));
 render(<KashrutCollection sources={[source]} agencies={[agency]} onCollected={refreshed}/>);
 await screen.findByText(/עדכון המידע במקור/);expect(screen.getByText(/24.3.2026/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"איסוף לבדיקה"}));await screen.findByText(/הריצה נשמרה בהיסטוריית האיסוף לבדיקה/);expect(refreshed).toHaveBeenCalled();
});
