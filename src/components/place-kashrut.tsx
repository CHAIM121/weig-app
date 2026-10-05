"use client";
import {useEffect,useState} from "react";
import type {KashrutEvidence} from "@/modules/places/kashrut";
type Evidence=KashrutEvidence&{status:"listed"|"verified"|"expired"|"revoked"|"stale"};
export function PlaceKashrut({id,he,isFood}:{id:string;he:boolean;isFood:boolean}){
 const [result,setResult]=useState<{id:string;rows:Evidence[];error:boolean}|null>(null);
 useEffect(()=>{const c=new AbortController();fetch(`/api/places/kashrut?id=${encodeURIComponent(id)}`,{signal:c.signal,cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>setResult({id,rows:d.evidence,error:false})).catch(()=>{if(!c.signal.aborted)setResult({id,rows:[],error:true})});return()=>c.abort()},[id]);
 const current=result?.id===id?result:null;
 if(!isFood&&!current?.rows.length)return null;
 const label=(h:string,e:string)=>he?h:e;
 const date=(s:string)=>new Intl.DateTimeFormat(he?"he-IL":"en-GB",{timeZone:"Asia/Jerusalem"}).format(new Date(s));
 return <section className="discover-kashrut" aria-label={label("פרטי כשרות","Kashrut details")} aria-live="polite">
  <strong>{label("כשרות","Kashrut")}</strong>
  {!current?<p>{label("בודקים מידע כשרות…","Checking kashrut information…")}</p>:current.error?<p>{label("מידע הכשרות אינו זמין כרגע.","Kashrut information is temporarily unavailable.")}</p>:!current.rows.length?<p>{label("טרם אומתה","Not yet verified")}</p>:current.rows.map(e=><div key={e.id}>
   <p><strong>{e.certifier}</strong>{e.level?` · ${e.level}`:""}{e.food_type?` · ${e.food_type}`:""}</p>
   <p>{e.status==="listed"?label("מופיע ברשימת הפיקוח הרשמית; תוקף תעודה לא פורסם.","Listed in the official supervision directory; certificate validity was not published."):e.status==="verified"?label(`תעודה אומתה · בתוקף עד ${date(e.valid_until!)}`,`Certificate verified · valid until ${date(e.valid_until!)}`):e.status==="expired"?label("תוקף התעודה הרשומה פג; אין אישור עדכני במאגר.","The recorded certificate has expired; no current certificate is available."):e.status==="revoked"?label("פורסם ביטול כשרות במקור.","The source reports a withdrawal of certification."):label("המידע דורש בדיקה מחדש; אין אימות עדכני.","This information requires a fresh check; no current verification is available.")}</p>
   <small>{label("המידע נקרא מהמקור ב־","Source retrieved on ")}{date(e.fetched_at)}{!e.source_updated_at?label(" · מועד עדכון הרשימה לא פורסם"," · directory update date was not published"):""}</small>
   <p><a href={e.source_url} target="_blank" rel="noopener noreferrer">{label("למקור הרשמי","Official source")}</a>{e.certificate_url&&<> · <a href={e.certificate_url} target="_blank" rel="noopener noreferrer">{label("לתעודה","Certificate")}</a></>}</p>
  </div>)}
 </section>;
}
