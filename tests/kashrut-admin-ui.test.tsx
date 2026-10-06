import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {KashrutAdmin} from "@/components/kashrut-admin";
afterEach(()=>{cleanup();vi.restoreAllMocks()});
const snapshot={data:{agencies:[{id:"11111111-1111-1111-1111-111111111111",version:1,code:"body",name_he:"גוף בבדיקה",kind:"independent",status:"candidate",aliases:[],countries:["IL"],official_url:null,notes:"",updated_at:"2026-10-06T00:00:00Z"}],classifications:[],sources:[],reviews:[]},audit:[],truncated:false};
it("shows a login gate without leaking registry data",async()=>{
 vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({error:"LOGIN_REQUIRED"}),{status:401}));render(<KashrutAdmin locale="he"/>);
 expect(await screen.findByText("כניסה למערכת הניהול")).toBeInTheDocument();expect(screen.queryByText("גוף בבדיקה")).not.toBeInTheDocument();
});
it("allows a manager to create a source linked to an agency, defaulting to planned candidate",async()=>{
 const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response(JSON.stringify(snapshot))).mockResolvedValueOnce(new Response(JSON.stringify({record:{id:"new"}}),{status:201})).mockResolvedValue(new Response(JSON.stringify(snapshot)));
 render(<KashrutAdmin locale="he"/>);await screen.findByText("גוף בבדיקה");fireEvent.click(screen.getByRole("button",{name:"מקורות מידע"}));fireEvent.click(screen.getByRole("button",{name:"הוספת מקור"}));
 fireEvent.change(screen.getByLabelText(/מזהה קבוע/),{target:{value:"new_source"}});fireEvent.change(screen.getByLabelText(/שם בעברית/),{target:{value:"רשימה רשמית"}});fireEvent.change(screen.getByLabelText(/הגוף המכשיר/),{target:{value:snapshot.data.agencies[0].id}});fireEvent.change(screen.getByLabelText(/כתובת המקור/),{target:{value:"https://example.org/directory"}});
 fireEvent.click(screen.getByRole("button",{name:"שמירת רשומה"}));await screen.findByText("השינוי נשמר במאגר ובהיסטוריית השינויים.");
 const call=fetcher.mock.calls.find(([,init])=>init?.method==="POST");const body=JSON.parse(String(call?.[1]?.body));expect(body.values.agency_id).toBe(snapshot.data.agencies[0].id);expect(body.values.status).toBe("candidate");expect(body.values.connection_state).toBe("planned");
});
it("preserves edits and shows a conflict instead of silently overwriting",async()=>{
 vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response(JSON.stringify(snapshot))).mockResolvedValue(new Response(JSON.stringify({error:"הרשומה השתנתה מאז שנפתחה"}),{status:409}));render(<KashrutAdmin locale="he"/>);await screen.findByText("גוף בבדיקה");fireEvent.click(screen.getByRole("button",{name:"עריכה"}));fireEvent.change(screen.getByLabelText(/שם בעברית/),{target:{value:"שם מעודכן"}});fireEvent.click(screen.getByRole("button",{name:"שמירת רשומה"}));await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("הרשומה השתנתה"));expect(screen.getByLabelText(/שם בעברית/)).toHaveValue("שם מעודכן");
});
it("allows a scoped relationship to be reviewed without starting collection",async()=>{
 const two={...snapshot,data:{...snapshot.data,agencies:[...snapshot.data.agencies,{...snapshot.data.agencies[0],id:"22222222-2222-2222-2222-222222222222",name_he:"גוף נוסף"}]}};
 const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response(JSON.stringify(two))).mockResolvedValueOnce(new Response(JSON.stringify({record:{id:"new"}}),{status:201})).mockResolvedValue(new Response(JSON.stringify(two)));
 render(<KashrutAdmin locale="he"/>);await screen.findByText("גוף בבדיקה");fireEvent.click(screen.getByRole("button",{name:"קשרים בין גופים"}));fireEvent.click(screen.getByRole("button",{name:"הוספת קשר"}));
 fireEvent.change(screen.getByLabelText(/שם הקשר/),{target:{value:"קשר מועמד"}});fireEvent.change(screen.getByLabelText(/מהגוף/),{target:{value:snapshot.data.agencies[0].id}});fireEvent.change(screen.getByLabelText(/אל הגוף/),{target:{value:"22222222-2222-2222-2222-222222222222"}});fireEvent.change(screen.getByLabelText(/תחום ותנאי/),{target:{value:"תחום לבדיקה בלבד"}});fireEvent.click(screen.getByRole("button",{name:"שמירת רשומה"}));await screen.findByText("השינוי נשמר במאגר ובהיסטוריית השינויים.");
 const body=JSON.parse(String(fetcher.mock.calls.find(([,init])=>init?.method==="POST")?.[1]?.body));expect(body.entity).toBe("relationships");expect(body.values.status).toBe("candidate");expect(fetcher.mock.calls.every(([url])=>url==="/api/kashrut/admin")).toBe(true);
});
