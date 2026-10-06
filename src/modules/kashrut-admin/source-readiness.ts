import type {RecordRow} from "./registry";
/** Planning gate only: passing this check never starts a fetch or scheduler. */
export function sourceReadiness(source:RecordRow,agency?:RecordRow){
 const blockers:string[]=[];
 if(agency?.status!=="verified")blockers.push("הגוף טרם אומת");
 if(source.status!=="verified")blockers.push("המקור טרם אומת");
 if(source.access_status!=="allowed"||!source.terms_url||String(source.access_notes??"").trim().length<5)blockers.push("חסרה הרשאה מתועדת לאיסוף");
 if(!source.coverage||!source.content_kind||source.content_kind==="unspecified")blockers.push("חסר היקף איסוף מוגדר");
 if(!source.stable_key)blockers.push("חסר מזהה רשומה יציב");
 if(!source.refresh_frequency||source.refresh_frequency==="unspecified")blockers.push("לא הוגדרה תדירות");
 if(source.adapter_test_status!=="passed"||!source.adapter_version||String(source.adapter_test_notes??"").trim().length<5)blockers.push("החיבור טרם עבר בדיקות מתועדות");
 if(["blocked","paused"].includes(String(source.connection_state)))blockers.push("החיבור חסום או מושהה");
 return {ready:blockers.length===0,blockers};
}
