"use client";
import {useEffect,useState} from "react";
import {ShieldCheck,ChevronDown} from "lucide-react";
import type {KashrutEvidence} from "@/modules/places/kashrut";
import styles from "./place-kashrut.module.css";
type Evidence=KashrutEvidence&{status:"listed"|"verified"|"expired"|"revoked"|"stale"};
export function PlaceKashrut({id,he,isFood}:{id:string;he:boolean;isFood:boolean}){
 const [result,setResult]=useState<{id:string;rows:Evidence[];error:boolean}|null>(null);
 useEffect(()=>{const c=new AbortController();fetch(`/api/places/kashrut?id=${encodeURIComponent(id)}`,{signal:c.signal,cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>setResult({id,rows:d.evidence,error:false})).catch(()=>{if(!c.signal.aborted)setResult({id,rows:[],error:true})});return()=>c.abort()},[id]);
 const current=result?.id===id?result:null;
 if(!isFood&&!current?.rows.length)return null;
 const label=(h:string,e:string)=>he?h:e;
 const date=(s:string)=>new Intl.DateTimeFormat(he?"he-IL":"en-GB",{timeZone:"Asia/Jerusalem"}).format(new Date(s));
 const summary=!current?label("בודקים מידע…","Checking…"):current.error?label("מידע אינו זמין כרגע","Temporarily unavailable"):!current.rows.length?label("טרם נמצא מידע רשמי","No official information found yet"):current.rows.map(e=>e.status==="revoked"?label("פורסם ביטול כשרות","Certification withdrawn"):e.status==="expired"?label("תוקף התעודה פג","Certificate expired"):e.status==="stale"?label("נדרשת בדיקה מחדש","Requires a fresh check"):[e.certifier,e.level,e.food_type,e.source_label&&/בלבד|מחלק/.test(e.source_label)?e.source_label:null].filter(Boolean).join(" · ")).join(" / ");
 const content=<><ShieldCheck size={18} className={styles.icon} aria-hidden="true"/><span className={styles.label}>{label("כשרות","Kashrut")}</span><span className={styles.value}>{summary}</span></>;
 if(!current?.rows.length)return <div className={styles.row} aria-live="polite"><div className={styles.summary}>{content}</div></div>;
 return <details className={styles.row} key={id}>
  <summary className={styles.summary}>{content}<ChevronDown size={16} className={styles.chevron} aria-hidden="true"/></summary>
  <div className={styles.details}>{current.rows.map(e=><div key={e.id}>
   {e.source_label&&<p>{e.source_label}</p>}
   <p className={e.status==="revoked"||e.status==="expired"?styles.notice:undefined}>{e.status==="listed"?label("מופיע במקור הרשמי; תוקף תעודה לא פורסם.","Listed in the official source; certificate validity was not published."):e.status==="verified"?label(`תעודה אומתה · בתוקף עד ${date(e.valid_until!)}`,`Certificate verified · valid until ${date(e.valid_until!)}`):e.status==="expired"?label("תוקף התעודה הרשומה פג; אין אישור עדכני במאגר.","The recorded certificate has expired; no current certificate is available."):e.status==="revoked"?label("פורסם ביטול כשרות במקור.","The source reports a withdrawal of certification."):label("המידע דורש בדיקה מחדש; אין אימות עדכני.","This information requires a fresh check; no current verification is available.")}</p>
   <small>{label("נקרא מהמקור ב־","Source retrieved on ")}{date(e.fetched_at)}{!e.source_updated_at?label(" · מועד עדכון הרשימה לא פורסם"," · directory update date was not published"):""}</small>
   <p><a href={e.source_url} target="_blank" rel="noopener noreferrer">{label("למקור הרשמי","Official source")}</a>{e.certificate_url&&<> · <a href={e.certificate_url} target="_blank" rel="noopener noreferrer">{label("לתעודה","Certificate")}</a></>}</p>
  </div>)}</div>
 </details>;
}
