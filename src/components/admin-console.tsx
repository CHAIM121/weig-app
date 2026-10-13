"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ShieldCheck,PlugZap,UsersRound,Store,RefreshCcw,ExternalLink,Search,Database,KeyRound} from "lucide-react";
import {KashrutAdmin} from "./kashrut-admin";
import styles from "./admin-console.module.css";

type Section="kashrut"|"integrations"|"users";
type KashrutView="contacts"|"stores";
type Provider={id:string;name:string;category:string;state:"configured"|"missing"|"link";description:string};
type Source={id:string;name_he:string;publisher:string|null;url:string|null;format:string;status:string;connection_state:string;content_kind:string;access_status:string;coverage:string;updated_at:string};
type Profile={id:string;display_name:string|null;created_at:string;updated_at:string;archived_at:string|null};
type Overview={profiles:Profile[];profilesCount:number;profilesTruncated:boolean;sources:Source[];agencyCount:number;evidenceCount:number;providers:Provider[]};
type StoreRow={
 id:string;place_id:string;business_name:string;address:string;city:string;country:string;business_phone:string|null;
 certifier:string;level:string|null;food_type:string|null;source:string;source_label:string|null;
 source_url:string;certificate_url:string|null;evidence_type:string;valid_until:string|null;
 verified_at:string|null;fetched_at:string;source_updated_at:string|null;active_in_directory:boolean;
};
type StoresResponse={stores:StoreRow[];total:number;page:number;pageSize:number};
const safeLink=(value:string|null|undefined)=>{if(!value)return null;try{const url=new URL(value);return url.protocol==="https:"?url.href:null}catch{return null}};
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleDateString("he-IL",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Jerusalem"}):"לא פורסם";
const pageLabels:Record<Section,{title:string;subtitle:string}>={
 kashrut:{title:"ניהול כשרות",subtitle:"גופי כשרות ואנשי קשר, חנויות ומידע על הכשרות שלהן."},
 integrations:{title:"API וחברות מקושרות",subtitle:"חיבורי המערכת ומקורות המידע הרשומים. לא מוצגים כאן מפתחות או סודות."},
 users:{title:"משתמשים",subtitle:"חשבונות המשתמשים הרשומים במאגר WEIG."},
};

export function AdminConsole({locale}:{locale:string}){
 const [section,setSection]=useState<Section>("kashrut");
 const [kashrutView,setKashrutView]=useState<KashrutView>("contacts");
 const [data,setData]=useState<Overview|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [gate,setGate]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const abort=new AbortController();
  async function load(){
   setLoading(true);setError("");
   try{
    const response=await fetch("/api/admin/overview",{signal:abort.signal,cache:"no-store"});
    const result=await response.json();
    if(!response.ok){
     if(response.status===401||response.status===403){setGate(result.error);setData(null);return}
     throw new Error(result.error||"טעינת נתוני הניהול נכשלה");
    }
    setGate("");setData(result as Overview);
   }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"טעינת הנתונים נכשלה")}
   finally{if(!abort.signal.aborted)setLoading(false)}
  }
  void load();
  return()=>abort.abort();
 },[reload]);
 const titles=pageLabels[section];
 return <div className={styles.page} dir="rtl">
  <div className={styles.hero}>
   <div><span className={styles.eyebrow}>WEIG · ADMINISTRATION</span><h1>ניהול המערכת</h1><p>מרכז בקרה אחד לניהול המידע, החיבורים והמשתמשים של WEIG.</p></div>
   <button type="button" className={styles.refresh} onClick={()=>setReload(v=>v+1)} disabled={loading}><RefreshCcw size={17}/> רענון נתונים</button>
  </div>
  {error&&<div className={styles.error} role="alert">{error}</div>}
  {loading&&!data&&!gate&&<div className={styles.empty} role="status">טוענים את מרכז הניהול…</div>}
  {gate&&<div className={styles.gate}><ShieldCheck size={30}/><h2>{gate==="LOGIN_REQUIRED"?"נדרשת כניסה":"אין הרשאת מנהל לחשבון זה"}</h2><p>מרכז הניהול זמין רק לחשבונות מורשים. הרשאות המשתמשים אינן נקבעות באמצעות כתובת הדף.</p><Link className={styles.primary} href={"/"+locale+"/auth"}>כניסה לחשבון</Link></div>}
  {data&&<div className={styles.workspace}>
   <nav className={styles.sections} aria-label="מחלקות הניהול">
    <button type="button" className={styles.sectionButton} aria-current={section==="kashrut"?"page":undefined} onClick={()=>setSection("kashrut")}><ShieldCheck size={22}/><span><b>כשרות</b><small>{data.agencyCount} גופים · {data.evidenceCount} רשומות עסקים</small></span></button>
    <button type="button" className={styles.sectionButton} aria-current={section==="integrations"?"page":undefined} onClick={()=>setSection("integrations")}><PlugZap size={22}/><span><b>API וחברות מקושרות</b><small>{data.providers.length} שירותים · {data.sources.length} מקורות</small></span></button>
    <button type="button" className={styles.sectionButton} aria-current={section==="users"?"page":undefined} onClick={()=>setSection("users")}><UsersRound size={22}/><span><b>משתמשים</b><small>{data.profilesCount} חשבונות</small></span></button>
   </nav>
   <section className={styles.content} aria-label={titles.title}>
    <header className={styles.contentHead}><div><h2>{titles.title}</h2><p>{titles.subtitle}</p></div></header>
    {section==="kashrut"&&<>
     <div className={styles.subTabs} role="tablist" aria-label="פרטי כשרות">
      <button type="button" role="tab" aria-selected={kashrutView==="contacts"} onClick={()=>setKashrutView("contacts")}><UsersRound size={19}/><span>פרטי קשר</span><small>גופים, כתובות ואנשי קשר</small></button>
      <button type="button" role="tab" aria-selected={kashrutView==="stores"} onClick={()=>setKashrutView("stores")}><Store size={19}/><span>פרטי חנויות</span><small>פרטי עסק והכשרות שלו</small></button>
     </div>
     <div role="tabpanel">{kashrutView==="contacts"?<KashrutAdmin locale={locale} embedded/>:<StoresDirectory/>}</div>
    </>}
    {section==="integrations"&&<IntegrationsPanel data={data}/>}
    {section==="users"&&<UsersPanel data={data}/>}
   </section>
  </div>}
 </div>;
}

function StoresDirectory(){
 const [search,setSearch]=useState("");
 const [certifier,setCertifier]=useState("");
 const [active,setActive]=useState({search:"",certifier:""});
 const [listing,setListing]=useState("all");
 const [page,setPage]=useState(0);
 const [reload,setReload]=useState(0);
 const [result,setResult]=useState<StoresResponse|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  const abort=new AbortController();
  async function load(){
   setLoading(true);setError("");
   try{
    const query=new URLSearchParams({page:String(page),search:active.search,certifier:active.certifier,listing});
    const response=await fetch("/api/admin/stores?"+query.toString(),{signal:abort.signal,cache:"no-store"});
    const json=await response.json();
    if(!response.ok)throw new Error(json.error||"פרטי החנויות אינם זמינים");
    setResult(json as StoresResponse);
   }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"שגיאה בטעינת החנויות")}
   finally{if(!abort.signal.aborted)setLoading(false)}
  }
  void load();return()=>abort.abort();
 },[active,page,listing,reload]);
 const total=result?.total??0;
 return <div className={styles.directory}>
  <form className={styles.searchBar} onSubmit={e=>{e.preventDefault();setPage(0);setActive({search:search.trim(),certifier:certifier.trim()})}}>
   <label><span>חיפוש חנות</span><input placeholder="שם חנות או מסעדה…" value={search} onChange={e=>setSearch(e.target.value)} maxLength={100}/></label>
   <label><span>גוף כשרות</span><input placeholder="לדוגמה: רבנות בית שמש" value={certifier} onChange={e=>setCertifier(e.target.value)} maxLength={100}/></label>
   <label className={styles.listFilter}><span>מופיע במקור</span><select value={listing} onChange={e=>{setListing(e.target.value);setPage(0)}}><option value="all">הכול</option><option value="active">ברשימה</option><option value="inactive">לא ברשימה</option></select></label>
   <button className={styles.primary} type="submit"><Search size={17}/> חיפוש</button>
  </form>
  <div className={styles.resultSummary}><span>{loading?"טוענים…":"נמצאו "+total.toLocaleString("he-IL")+" רשומות כשרות של עסקים"}</span><button type="button" onClick={()=>setReload(v=>v+1)} className={styles.linkButton} disabled={loading}><RefreshCcw size={15}/> רענון</button></div>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {!loading&&result?.stores.length===0&&<div className={styles.empty}>לא נמצאו חנויות לפי הסינון. נסו שם אחר או הסירו מסנן.</div>}
  <div className={styles.storeGrid}>{result?.stores.map(store=>{
   const sourceUrl=safeLink(store.source_url);
   const certificateUrl=safeLink(store.certificate_url);
   const phone=store.business_phone?.replace(/[^+\d]/g,"");
   const expired=store.valid_until!=null&&store.valid_until<new Date().toISOString().slice(0,10);
   return <article className={styles.storeCard} key={store.id}>
    <div className={styles.cardTop}><div><div className={styles.storeLabel}>פרטי החנות</div><h3>{store.business_name}</h3><p>{[store.address,store.city].filter(Boolean).join(" · ")}</p>{store.business_phone&&<p>טלפון: <a href={"tel:"+phone} dir="ltr">{store.business_phone}</a></p>}</div><span className={store.active_in_directory?styles.flagGood:styles.flagNeutral}>{store.active_in_directory?"מופיע במקור":"אינו מופיע במקור"}</span></div>
    <div className={styles.kashrutBox}><div className={styles.storeLabel}>פרטי הכשרות</div>
     <div className={styles.certName}><ShieldCheck size={19}/><strong>{store.certifier||"גוף כשרות לא צוין"}</strong></div>
     <dl><div><dt>רמת כשרות</dt><dd>{store.level||"לא צוינה"}</dd></div><div><dt>סוג מזון</dt><dd>{store.food_type||"לא צוין"}</dd></div><div><dt>תוקף תעודה</dt><dd className={expired?styles.expired:""}>{store.valid_until?date(store.valid_until)+(expired?" · עבר":""):"לא פורסם"}</dd></div></dl>
     <p className={styles.disclaimer}>רישום במקור אינו מהווה אישור שתעודה תקפה כעת.</p>
    </div>
    <details className={styles.details}><summary>מקור המידע ופרטים נוספים</summary><div className={styles.detailBody}>
     <p>מזהה מקור: <bdi>{store.source}</bdi></p><p>סוג ראיה: <bdi>{store.evidence_type}</bdi></p>
     <p>עדכון המקור: {date(store.source_updated_at)} · נקלט: {date(store.fetched_at)}</p>
     <p>מדינה: {store.country||"לא צוינה"}</p>
     {sourceUrl&&<a href={sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> מעבר למקור הרשמי</a>}
     {certificateUrl&&<a href={certificateUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> צפייה בתעודה</a>}
     {!sourceUrl&&<p>קישור למקור אינו זמין.</p>}
    </div></details>
   </article>;
  })}</div>
  {result&&result.total>result.pageSize&&<nav className={styles.pagination} aria-label="עמודי חנויות">
   <button type="button" disabled={page===0||loading} onClick={()=>setPage(p=>Math.max(0,p-1))}>הקודם</button>
   <span>עמוד {page+1} מתוך {Math.ceil(result.total/result.pageSize)}</span>
   <button type="button" disabled={loading||(page+1)*result.pageSize>=result.total} onClick={()=>setPage(p=>p+1)}>הבא</button>
  </nav>}
 </div>;
}

function IntegrationsPanel({data}:{data:Overview}){
 const status=(state:string)=>state==="configured"?"מוגדר בשרת":state==="missing"?"לא מוגדר":state==="link"?"קישור חיצוני":state==="active"?"מסומן כפעיל":state==="planned"?"מתוכנן":state==="testing"?"בבדיקה":state==="manual_import"?"יבוא ידני":state==="blocked"?"גישה חסומה":state;
 return <div>
  <p className={styles.smallNote}>הסטטוס של ממשקי API מציין אם הוגדר חיבור, ולא בדיקת תקינות חיה או הרשאה לאיסוף נתונים. מפתחות API לא נחשפים בממשק.</p>
  <h3 className={styles.listTitle}><KeyRound size={20}/> שירותים וחברות</h3>
  <div className={styles.integrationGrid}>{data.providers.map(provider=><article key={provider.id} className={styles.integrationCard}>
   <div className={styles.integrationTop}><span className={styles.integrationIcon}><PlugZap size={20}/></span><span className={provider.state==="configured"?styles.flagGood:styles.flagNeutral}>{status(provider.state)}</span></div>
   <h4>{provider.name}</h4><small>{provider.category}</small><p>{provider.description}</p>
  </article>)}</div>
  <h3 className={styles.listTitle}><Database size={20}/> מאגרי כשרות ומקורות מקושרים <span className={styles.countBadge}>{data.sources.length}</span></h3>
  <div className={styles.sourceList}>{data.sources.map(source=><article className={styles.sourceRow} key={source.id}>
   <div><h4>{source.name_he}</h4><p>{source.publisher||"ללא מפרסם רשום"} · {source.format||"סוג לא צוין"} · {source.coverage||"היקף לא צוין"}</p><small>חיבור: {status(source.connection_state)} · מצב מקור: {source.status} · תנאי גישה: {source.access_status}</small></div>
   {safeLink(source.url)&&<a href={safeLink(source.url)!} target="_blank" rel="noopener noreferrer" aria-label={"המקור של "+source.name_he}><ExternalLink size={18}/></a>}
  </article>)}</div>
 </div>;
}

function UsersPanel({data}:{data:Overview}){
 return <div>
  <div className={styles.usersSummary}><UsersRound size={24}/><div><strong>{data.profilesCount.toLocaleString("he-IL")} משתמשים</strong><span>פרופילים פעילים וארכיוניים במאגר WEIG</span></div></div>
  <p className={styles.smallNote}>מוצגים פרטי הפרופיל הזמינים בלבד. כתובות אימייל אינן נשמרות בטבלת הפרופילים, והרשאות כניסה או מחיקת משתמשים אינן ניתנות לשינוי ממסך זה.</p>
  {data.profilesTruncated&&<p className={styles.smallNote}>מוצגים 250 פרופילים אחרונים בלבד.</p>}
  <div className={styles.userList}>{data.profiles.map(user=><article key={user.id} className={styles.userRow}>
   <div className={styles.avatar}>{(user.display_name||"W").charAt(0)}</div>
   <div className={styles.userDetails}><h3>{user.display_name||"משתמש ללא שם תצוגה"}</h3><small>מזהה: <bdi>{user.id}</bdi></small><p>נרשם: {date(user.created_at)} · עדכון: {date(user.updated_at)}</p></div>
   <span className={user.archived_at?styles.flagNeutral:styles.flagGood}>{user.archived_at?"בארכיון":"פעיל"}</span>
  </article>)}</div>
  {!data.profiles.length&&<div className={styles.empty}>אין פרופילים להצגה.</div>}
 </div>;
}
