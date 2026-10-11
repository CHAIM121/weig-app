"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {RecordRow} from "@/modules/kashrut-admin/registry";
import {sourceReadiness} from "@/modules/kashrut-admin/source-readiness";
import type {ProposedChange} from "@/modules/kashrut-admin/ingestion";
import styles from "./kashrut-admin.module.css";
type Run={id:string;source_id:string;started_at:string;finished_at:string|null;status:string;record_count:number;source_updated_at:string|null;reasons:string[];change_count:number};
const statuses:Record<string,string>={running:"איסוף בתהליך",staged:"נשמר לבדיקה",quarantined:"נדרשת בדיקת הריצה",failed:"האיסוף לא הושלם"};
const kinds:Record<string,string>={added:"רשומה חדשה",updated:"פרטים השתנו",identity_changed:"זהות הסניף השתנתה",explicit_revocation:"ביטול מפורש",missing_from_full_list:"חסר ברשימה המלאה — אינו ביטול"};
const date=(value:string|null)=>value?new Date(value).toLocaleString("he-IL",{timeZone:"Asia/Jerusalem"}):"לא פורסם";
export function KashrutCollection({sources,agencies,onCollected}:{sources:RecordRow[];agencies:RecordRow[];onCollected:()=>Promise<void>}){
 const [runs,setRuns]=useState<Run[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState("");
 const keys=useRef<Record<string,string>>({});
 const [details,setDetails]=useState<Record<string,ProposedChange[]>>({}),[detailBusy,setDetailBusy]=useState("");
 async function loadDetails(id:string){
  setDetailBusy(id);
  try{const r=await fetch(`/api/kashrut/collect?run_id=${id}`,{cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"טעינת פרטי הריצה נכשלה");setDetails(previous=>({...previous,[id]:data.run.changes}));}
  catch(e){setError(e instanceof Error?e.message:"טעינת פרטי הריצה נכשלה");}
  finally{setDetailBusy("");}
 }
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);
  try{const r=await fetch("/api/kashrut/collect",{cache:"no-store",signal});const data=await r.json();if(!r.ok)throw Error(data.error||"טעינת האיסופים נכשלה");if(!signal?.aborted){setRuns(data.runs);setError("");}}
  catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:"טעינת האיסופים נכשלה");}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
 async function collect(id:string){
  setBusy(id);setError("");setMessage("");
  try{
   const key=keys.current[id]??crypto.randomUUID();keys.current[id]=key;
   const r=await fetch("/api/kashrut/collect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source_id:id,request_key:key})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"האיסוף נכשל");
   if(data.status!=="running")delete keys.current[id];
   setMessage(data.status==="running"?"הריצה כבר בתהליך. רעננו את היסטוריית האיסוף בהמשך.":"הריצה נשמרה בהיסטוריית האיסוף לבדיקה. כרטיסי המקומות לא עודכנו.");
   await load();await onCollected();
  }catch(e){setError(e instanceof Error?e.message:"האיסוף נכשל");}
  finally{setBusy("");}
 }
 return <section className={styles.panel} aria-label="איסוף ממקורות חיצוניים">
  <h2>איסוף ממקורות חיצוניים</h2>
  <p className={styles.note}>קריאה חדשה מהמקור ושמירת גרסה לבדיקה. תאריך האיסוף ותאריך עדכון המקור מוצגים בנפרד. האיסוף אינו מאמת תעודה ואינו משנה את כרטיסי המקומות. אין סריקה מתוזמנת פעילה.</p>
  {loading&&<p role="status">טוענים היסטוריית איסוף…</p>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {message&&<p role="status">{message}</p>}
  <button className={styles.button} disabled={loading||!!busy} onClick={()=>void load()}>רענון היסטוריית האיסוף</button>
  {sources.map(source=>{
   const blockers=sourceReadiness(source,agencies.find(a=>a.id===source.agency_id)).blockers;
   const supported=source.code==="yokneam_government" && source.adapter_version==="yokneam-ckan-v1";
   const reason=[...blockers,...(!supported?["לא הוגדר מתאם בדוק למקור הזה"]:[])].join(" · ");
   return <article key={source.id} className={styles.card}><div><h3>{String(source.name_he)}</h3><p>{reason||"תנאי הסף הושלמו לאיסוף ידני לבדיקה"}</p></div><button className={styles.button} disabled={loading||!!busy||!!reason} onClick={()=>void collect(source.id)}>{busy===source.id?"אוספים מהמקור…":"איסוף לבדיקה"}</button></article>;
  })}
  {!loading&&!runs.length&&<p>אין עדיין ריצות איסוף חיצוני.</p>}
  {runs.map(run=><details key={run.id} className={styles.audit}><summary>{String(sources.find(s=>s.id===run.source_id)?.name_he??"מקור רשום")} · {statuses[run.status]??run.status} · {run.record_count} רשומות</summary><p>תחילת איסוף: {date(run.started_at)} · סיום: {date(run.finished_at)}</p><p>עדכון המידע במקור: {date(run.source_updated_at)}</p>{run.reasons.length>0&&<p>סיבות לבדיקה: {run.reasons.join(" · ")}</p>}<p>{run.change_count} הצעות לבדיקה</p>{run.change_count>0&&!details[run.id]&&<button className={styles.button} disabled={!!detailBusy} onClick={()=>void loadDetails(run.id)}>{detailBusy===run.id?"טוענים פרטים…":"פרטי השינויים"}</button>}{(details[run.id]??[]).map((change,i)=><div key={i}><h3>{change.after?.businessName??change.before?.businessName} · {kinds[change.kind]}</h3><p>לפני: {change.before?`${change.before.address} · ${change.before.city} · ${change.before.scopeText}`:"אין רשומה קודמת"}</p><p>אחרי: {change.after?`${change.after.address} · ${change.after.city} · ${change.after.scopeText}`:"לא הופיע ברשימה שנאספה"}</p></div>)}</details>)}
 </section>;
}
