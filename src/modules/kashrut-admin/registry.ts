export const entities={agencies:"weig_kashrut_agencies",classifications:"weig_kashrut_classifications",sources:"weig_kashrut_registry_sources",reviews:"weig_kashrut_review_tasks"} as const;
export type Entity=keyof typeof entities;
export type RecordRow={id:string;version:number;[key:string]:unknown};
export const labels:Record<string,string>={candidate:"מועמד לאימות",verified:"זהות / מקור אומתו",needs_review:"דורש בדיקה מחדש",inactive:"לא פעיל",national_authority:"רשות ארצית",local_authority:"רשות מקומית",independent:"גוף עצמאי / בד״ץ",international:"ארגון בינלאומי",community:"גוף קהילתי",recommender:"גוף ממליץ",level:"רמה שפורסמה",food:"סוג מזון",equipment:"ציוד",milk:"מאפייני חלב",meat:"מאפייני בשר",baking:"מאפייה ודגנים",cooking:"בישול",passover:"פסח",produce:"תוצרת חקלאית",scope:"היקף השגחה",other:"אחר",planned:"חיבור מתוכנן",manual_import:"יבוא ידני",testing:"בבדיקה",active:"פעיל",blocked:"גישה חסומה",paused:"מושהה",full:"רשימה מלאה",partial:"רשימה חלקית",unknown:"לא ידוע",open:"ממתין לבדיקה",in_review:"בבדיקה",resolved:"הבדיקה הושלמה",rejected:"נדחה",agency:"גוף",source:"מקור",classification:"סיווג",html:"אתר / רשימה",api:"API",pdf:"PDF",dataset:"קובץ נתונים",certificate:"תעודה",alerts:"הודעות ועדכונים"};
export type Field={key:string;label:string;type?:"text"|"textarea"|"array"|"boolean";options?:readonly string[];reference?:Entity;required?:boolean};
const identity:Field[]=[{key:"code",label:"מזהה קבוע",required:true},{key:"name_he",label:"שם בעברית",required:true},{key:"name_en",label:"שם בשפה נוספת"}];
const status:Field={key:"status",label:"מצב אימות",required:true,options:["candidate","verified","needs_review","inactive"]};
export const fields:Record<Entity,Field[]>={
 agencies:[...identity,{key:"kind",label:"סוג הגוף",required:true,options:["national_authority","local_authority","independent","international","community","recommender"]},{key:"aliases",label:"שמות חלופיים (מופרדים בפסיק)",type:"array"},{key:"countries",label:"קודי מדינות פעילות שפורסמו (IL, US, GB)",type:"array"},{key:"official_url",label:"אתר / ערוץ רשמי (HTTPS)"},status,{key:"notes",label:"ראיות, תחומי פעילות והערות",type:"textarea"}],
 classifications:[...identity,{key:"category",label:"קבוצת סיווג",required:true,options:["level","food","equipment","milk","meat","baking","cooking","passover","produce","scope","other"]},{key:"aliases",label:"מילים חלופיות (מופרדות בפסיק)",type:"array"},{key:"description",label:"משמעות והגבלות",type:"textarea"},{key:"active",label:"סיווג פעיל",type:"boolean"}],
 sources:[identity[0],identity[1],{key:"agency_id",label:"הגוף המכשיר / בעל המקור",reference:"agencies",required:true},{key:"publisher",label:"מפרסם המידע"},{key:"url",label:"כתובת המקור (HTTPS)",required:true},{key:"format",label:"פורמט",required:true,options:["html","api","pdf","dataset","certificate","alerts"]},status,{key:"connection_state",label:"מצב החיבור",required:true,options:["planned","manual_import","testing","blocked","paused"]},{key:"coverage",label:"כיסוי שפורסם"},{key:"completeness",label:"שלמות הרשימה",required:true,options:["unknown","full","partial"]},{key:"notes",label:"ראיות אימות ומגבלות גישה",type:"textarea"}],
 reviews:[{key:"title",label:"כותרת הבדיקה",required:true},{key:"subject_type",label:"סוג פריט",required:true,options:["agency","source","classification"]},{key:"agency_id",label:"גוף לבדיקה",reference:"agencies"},{key:"source_id",label:"מקור לבדיקה",reference:"sources"},{key:"classification_id",label:"סיווג לבדיקה",reference:"classifications"},{key:"reason",label:"סיבת הבדיקה",type:"textarea"},{key:"status",label:"מצב הבדיקה",required:true,options:["open","in_review","resolved","rejected"]},{key:"decision",label:"החלטה מנומקת",type:"textarea"}]
};
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function https(value:string){try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!/\s/.test(value)}catch{return false}}
export function validateRecord(entity:Entity,input:unknown):Record<string,unknown>{
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("פרטי הרשומה אינם תקינים");
 const raw=input as Record<string,unknown>,out:Record<string,unknown>={};
 for(const f of fields[entity]){
  const v=raw[f.key];
  if(f.type==="boolean"){if(typeof v!=="boolean")throw Error("יש לבחור מצב לסיווג");out[f.key]=v;continue}
  if(f.type==="array"){
   if(!Array.isArray(v)||v.length>40||v.some(x=>typeof x!=="string"||x.trim().length>160))throw Error(`ערך לא תקין: ${f.label}`);
   const values=[...new Set(v.map(x=>(x as string).trim()).filter(Boolean))];
   if(f.key==="countries"&&values.some(x=>!/^[A-Z]{2}$/.test(x)))throw Error("יש להזין קודי מדינות בשתי אותיות גדולות");out[f.key]=values;continue;
  }
  if(v!==null&&v!==undefined&&typeof v!=="string")throw Error(`ערך לא תקין: ${f.label}`);
  const value=typeof v==="string"?v.trim():"";
  if(value.length>(f.type==="textarea"?4000:f.key==="url"||f.key==="official_url"?2000:200))throw Error(`ערך ארוך מדי: ${f.label}`);
  if(f.required&&!value)throw Error(`חסר: ${f.label}`);
  if(f.options&&!f.options.includes(value))throw Error(`בחירה לא תקינה: ${f.label}`);
  if(f.reference&&value&&!uuid.test(value))throw Error(`פריט לא תקין: ${f.label}`);
  if(f.key==="code"&&!/^[a-z0-9_]{2,80}$/.test(value))throw Error("המזהה חייב להכיל אותיות אנגליות קטנות, ספרות או קו תחתון");
  if((f.key==="url"||f.key==="official_url")&&value&&!https(value))throw Error("כתובת המקור חייבת להיות HTTPS ללא פרטי כניסה");
  if((f.key==="name_he"||f.key==="title")&&value.length<2)throw Error("השם חייב להכיל לפחות שני תווים");
  out[f.key]=f.reference||f.key==="official_url"?value||null:value;
 }
 if(entity==="agencies"&&out.status==="verified"&&!out.official_url)throw Error("אימות גוף מחייב אתר או ערוץ רשמי");
 if((entity==="agencies"||entity==="sources")&&out.status==="verified"&&String(out.notes).length<5)throw Error("יש לתעד את ראיות האימות בהערות");
 if(entity==="reviews"){
  const key={agency:"agency_id",source:"source_id",classification:"classification_id"}[out.subject_type as string];
  if(!key||!out[key])throw Error("יש לבחור פריט לבדיקה");
  for(const k of ["agency_id","source_id","classification_id"])if(k!==key)out[k]=null;
  if(["resolved","rejected"].includes(String(out.status))&&String(out.decision).length<3)throw Error("סיום בדיקה מחייב החלטה מנומקת");
 }
 return out;
}
