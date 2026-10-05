"use client";
import {useEffect,useState} from "react";
import type {RecordRow} from "@/modules/kashrut-admin/registry";
import styles from "./kashrut-admin.module.css";
type Change={source_key:string;kind:string;before:Record<string,unknown>|null;after:Record<string,unknown>|null};
type Run={id:string;source_id:string;checked_at:string;baseline:boolean;total_count:number;active_count:number;stale_count:number;expired_count:number;last_source_fetch:string|null;changes:Change[]};
const changeLabels:Record<string,string>={added:"נוספה רשומה",missing_record:"רשומה חסרה במאגר",disappeared:"חדלה להופיע ברשימה",reappeared:"חזרה לרשימה",revoked:"הודעת ביטול",address_changed:"כתובת השתנתה — נדרשת בדיקת שיוך",updated:"פרטי רשומה עודכנו"};
const fieldLabels:Record<string,string>={business_name:"שם העסק",address:"כתובת",city:"עיר",country:"מדינה",certifier:"גוף מכשיר",level:"רמה",food_type:"סוג מזון",evidence_type:"סוג ראיה",valid_until:"תוקף",source_url:"מקור",source_label:"פרטי המקור",certificate_url:"תעודה",business_phone:"טלפון",active_in_directory:"מופיע ברשימה",place_id:"זהות מקום",source_updated_at:"עדכון המקור"};
const value=(v:unknown)=>v===true?"כן":v===false?"לא":v==null||v===""?"לא פורסם":String(v);
const date=(s:string|null)=>s?new Date(s).toLocaleString("he-IL",{timeZone:"Asia/Jerusalem"}):"לא נרשמה קריאה";
export function KashrutMonitor({sources,onChecked}:{sources:RecordRow[];onChecked:()=>Promise<void>}){
 const [runs,setRuns]=useState<Run[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState("");
 async function load(){
  setLoading(true);try{const r=await fetch("/api/kashrut/monitor",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"טעינת הבדיקות נכשלה");setRuns(d.runs)}catch(e){setError(e instanceof Error?e.message:"טעינת הבדיקות נכשלה")}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 async function check(id:string){
  setBusy(id);setError("");try{const r=await fetch("/api/kashrut/monitor",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source_id:id})});const d=await r.json();if(!r.ok)throw Error(d.error||"הבדיקה נכשלה");await load();await onChecked()}catch(e){setError(e instanceof Error?e.message:"הבדיקה נכשלה")}finally{setBusy("")}
 }
 return <section aria-label="בדיקות המאגר">
  <p className={styles.note}>בדיקה של הנתונים שכבר שמורים במאגר, ללא קריאה חדשה לאתר המקור. הבדיקה הראשונה שומרת גרסת בסיס; הבאות משוות אליה. תאריך בדיקת המאגר אינו תאריך אימות כשרות. היעלמות מרשימה אינה הודעת ביטול.</p>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {loading&&<p role="status">טוענים בדיקות…</p>}
  <div className={styles.rows}>{sources.map(source=>{
   const latest=runs.find(r=>r.source_id===source.id);
   return <article key={source.id} className={styles.card}><div><h3>{String(source.name_he)}</h3>{latest?<><p>רשומות פעילות: {latest.active_count} · לא פעילות: {latest.total_count-latest.active_count} · דורשות בדיקה מחודשת: {latest.stale_count} · תעודות שפגו: {latest.expired_count}</p><small>בדיקת מאגר: {date(latest.checked_at)}</small><small>קריאה אחרונה שנשמרה מהמקור: {date(latest.last_source_fetch)}</small><p>{latest.baseline?"נשמרה גרסת בסיס להשוואות הבאות":`${latest.changes.length} שינויים לעומת הבדיקה הקודמת`}</p></>:<p>טרם נשמרה גרסת בסיס למקור הזה.</p>}</div><button className={styles.button} disabled={!!busy||loading} onClick={()=>void check(source.id)}>{busy===source.id?"בודקים…":"בדיקת הנתונים השמורים"}</button></article>
  })}</div>
  <section className={styles.panel}><h2>50 בדיקות המאגר האחרונות</h2>{!loading&&!runs.length&&<p>טרם בוצעו בדיקות.</p>}{runs.map(run=><details key={run.id} className={styles.audit}><summary>{String(sources.find(s=>s.id===run.source_id)?.name_he??"מקור רשום")} · {date(run.checked_at)} · {run.baseline?"גרסת בסיס":`${run.changes.length} שינויים`}</summary>{run.baseline?<p>נקודת התחלה למעקב; אינה סריקה חדשה של המקור.</p>:!run.changes.length?<p>לא זוהה שינוי בפרטי הרשומות.</p>:run.changes.map(c=><div key={c.source_key}><h3>{String(c.after?.business_name??c.before?.business_name??c.source_key)} · {changeLabels[c.kind]??c.kind}</h3><dl>{Object.entries(fieldLabels).filter(([k])=>JSON.stringify(c.before?.[k])!==JSON.stringify(c.after?.[k])).map(([k,label])=><div key={k}><dt>{label}</dt><dd>{value(c.before?.[k])} ← {value(c.after?.[k])}</dd></div>)}</dl></div>)}</details>)}</section>
 </section>;
}
