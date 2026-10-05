import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {KashrutMonitor} from "@/components/kashrut-monitor";
afterEach(()=>{cleanup();vi.restoreAllMocks()});
const source={id:"source",version:1,name_he:"מקור בדיקה"};
it("keeps the database check distinct from a source refresh and shows before/after changes",async()=>{
 const run={id:"run",source_id:"source",checked_at:"2026-10-05T23:00:00Z",baseline:false,total_count:10,active_count:8,stale_count:2,expired_count:1,last_source_fetch:"2026-10-01T00:00:00Z",changes:[{source_key:"branch",kind:"address_changed",before:{business_name:"עסק בדיקה",address:"רחוב 1"},after:{business_name:"עסק בדיקה",address:"רחוב 2"}}]};
 vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({runs:[run]})));
 render(<KashrutMonitor sources={[source]} onChecked={async()=>{}}/>);
 expect(await screen.findByText(/רשומות פעילות: 8/)).toBeInTheDocument();expect(screen.getByText(/ללא קריאה חדשה לאתר המקור/)).toBeInTheDocument();expect(screen.getByText(/נדרשת בדיקת שיוך/)).toBeInTheDocument();expect(screen.getByText(/רחוב 1 ← רחוב 2/)).toBeInTheDocument();
});
it("shows a failed check and does not claim to have refreshed the source",async()=>{
 vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response(JSON.stringify({runs:[]}))).mockResolvedValue(new Response(JSON.stringify({error:"בדיקת המאגר נכשלה"}),{status:503}));
 render(<KashrutMonitor sources={[source]} onChecked={async()=>{}}/>);await screen.findByText("טרם בוצעו בדיקות.");fireEvent.click(screen.getByRole("button",{name:"בדיקת הנתונים השמורים"}));expect(await screen.findByRole("alert")).toHaveTextContent("בדיקת המאגר נכשלה");
});
