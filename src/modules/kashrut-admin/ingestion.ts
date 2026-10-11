import {createHash} from "node:crypto";

/** Offline staging only. This module never fetches, writes evidence, or starts a schedule. */
export type Scope = "branch" | "kitchen" | "department" | "counter" | "product" | "event" | "unspecified";
export type CollectedEvidence = {
 sourceKey:string;
 agencyCode:string;
 businessName:string;
 address:string;
 city:string;
 country:string;
 /** Missing official branch address/locality must remain unmatchable, not inferred. */
 matchEligible:boolean;
 scope:Scope;
 scopeText:string;
 evidenceType:"official_listing" | "certificate" | "revocation";
 sourceUrl:string;
 sourceText:string;
 validUntil:string|null;
 sourceUpdatedAt:string|null;
 /** Claims contain only explicit source statements, never inferred defaults. */
 claims:Record<string,"yes" | "no" | "unknown" | "not_applicable">;
};
export type Collection = {
 sourceCode:string;
 adapterVersion:string;
 /** Changes when region, query, content kind, or stable-key semantics change. */
 coverageKey:string;
 startedAt:string;
 finishedAt:string;
 outcome:"success" | "partial" | "failed";
 completeness:"full" | "partial" | "unknown";
 expectedPages:number|null;
 receivedPages:number;
 expectedRecords:number|null;
 /** Adapter evidence for completeness, e.g. final cursor and published count. */
 completenessEvidence:string;
 failureReason:string|null;
 records:CollectedEvidence[];
};
export type StagedSnapshot = Collection & {contentHash:string};
export type StageResult =
 | {status:"staged";snapshot:StagedSnapshot}
 | {status:"quarantined";reasons:string[]};

function timestamp(value:string){
 return typeof value==="string" && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && date(value.slice(0,10)) && Number.isFinite(Date.parse(value));
}
function date(value:string){
 return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}
function https(value:string){
 try {const url=new URL(value);return url.protocol==="https:" && !url.username && !url.password;} catch {return false;}
}
const scopes:Scope[]=["branch","kitchen","department","counter","product","event","unspecified"];
const claimValues=["yes","no","unknown","not_applicable"];
function canonical(value:unknown):string{
 if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
 if(value!==null && typeof value==="object")return `{${Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
 return JSON.stringify(value);
}
function recordKey(record:CollectedEvidence){return canonical([record.agencyCode,record.sourceKey,record.scope,record.scopeText]);}
function contentHash(collection:Collection){
 return createHash("sha256").update(canonical({sourceCode:collection.sourceCode,coverageKey:collection.coverageKey,completeness:collection.completeness,records:[...collection.records].sort((a,b)=>recordKey(a)<recordKey(b)?-1:recordKey(a)>recordKey(b)?1:0)})).digest("hex");
}

/** Reject malformed, incomplete and failed results before they can become a baseline. */
export function stageCollection(collection:Collection,now=new Date()):StageResult{
 if(!collection || typeof collection!=="object" || !Array.isArray(collection.records))return {status:"quarantined",reasons:["invalid_collection"]};
 const reasons:string[]=[];
 if(!/^[a-z0-9_]{2,80}$/.test(collection.sourceCode))reasons.push("invalid_source");
 if(!collection.adapterVersion?.trim() || !collection.coverageKey?.trim())reasons.push("missing_adapter_or_coverage");
 if(!["full","partial","unknown"].includes(collection.completeness))reasons.push("invalid_completeness");
 if(!timestamp(collection.startedAt) || !timestamp(collection.finishedAt) || Date.parse(collection.startedAt)>Date.parse(collection.finishedAt) || Date.parse(collection.finishedAt)>now.getTime())reasons.push("invalid_collection_times");
 if(collection.outcome!=="success")reasons.push("collection_not_successful");
 if(collection.failureReason)reasons.push("collection_reported_failure");
 if(!Number.isInteger(collection.receivedPages) || collection.receivedPages<1)reasons.push("invalid_page_count");
 if(collection.expectedPages!==null && (!Number.isInteger(collection.expectedPages) || collection.expectedPages<1 || collection.expectedPages!==collection.receivedPages))reasons.push("missing_or_unexpected_pages");
 if(!Array.isArray(collection.records) || collection.records.length===0)reasons.push("empty_snapshot_requires_review");
 if(collection.expectedRecords!==null && (!Number.isInteger(collection.expectedRecords) || collection.expectedRecords<0 || collection.expectedRecords!==collection.records?.length))reasons.push("record_count_mismatch");
 if(collection.completeness==="full" && (!collection.completenessEvidence?.trim() || collection.expectedPages===null))reasons.push("unproven_completeness");
 const keys=new Set<string>();
 for(const r of collection.records??[]){
  if(!r || typeof r!=="object"){reasons.push("invalid_record");continue;}
  if([r.sourceKey,r.agencyCode,r.businessName,r.scopeText,r.sourceText].some(v=>typeof v!=="string" || !v.trim()))reasons.push("missing_record_identity_or_scope");
  if(typeof r.address!=="string" || typeof r.city!=="string" || typeof r.matchEligible!=="boolean" || (r.matchEligible && (!r.address.trim() || !r.city.trim())))reasons.push("missing_record_identity_or_scope");
  if(!/^[A-Z]{2}$/.test(r.country) || !scopes.includes(r.scope) || !["official_listing","certificate","revocation"].includes(r.evidenceType))reasons.push("invalid_record_kind");
  if(!https(r.sourceUrl))reasons.push("invalid_source_url");
  if(r.validUntil!==null && (typeof r.validUntil!=="string" || !date(r.validUntil)))reasons.push("invalid_expiry");
  if(r.sourceUpdatedAt!==null && (!timestamp(r.sourceUpdatedAt) || Date.parse(r.sourceUpdatedAt)>Date.parse(collection.finishedAt)))reasons.push("invalid_source_timestamp");
  if(!r.claims || typeof r.claims!=="object" || Array.isArray(r.claims) || Object.entries(r.claims).some(([k,v])=>!k.trim() || !claimValues.includes(v)))reasons.push("invalid_claims");
  const key=recordKey(r);
  if(keys.has(key))reasons.push("duplicate_scoped_key");
  keys.add(key);
 }
 if(reasons.length)return {status:"quarantined",reasons:[...new Set(reasons)]};
 // Copy input so mutations by an adapter cannot silently change the staged version.
 const copy=JSON.parse(JSON.stringify(collection)) as Collection;
 return {status:"staged",snapshot:{...copy,contentHash:contentHash(copy)}};
}

export type ProposedChange = {
 kind:"added" | "updated" | "identity_changed" | "explicit_revocation" | "missing_from_full_list";
 before:CollectedEvidence|null;
 after:CollectedEvidence|null;
 requiresReview:true;
};
export type Comparison = {
 status:"review_required" | "unchanged" | "blocked";
 reasons:string[];
 changes:ProposedChange[];
 /** No public-data deletion, deactivation, certification renewal or fetched_at updates. */
 writesPublicEvidence:false;
};
const identity=(r:CollectedEvidence)=>canonical([r.businessName,r.address,r.city,r.country]);

/** Propose changes only. A separate, authorized promotion step must recheck the baseline. */
export function compareStagedCollections(previous:StagedSnapshot|null,next:StagedSnapshot,now=new Date()):Comparison{
 const reasons:string[]=[];
 for(const snapshot of [previous,next]){
  if(!snapshot)continue;
  const checked=stageCollection(snapshot,now);
  if(checked.status!=="staged" || checked.snapshot.contentHash!==snapshot.contentHash)reasons.push("invalid_or_modified_snapshot");
 }
 if(previous && (previous.sourceCode!==next.sourceCode || previous.coverageKey!==next.coverageKey))reasons.push("incompatible_source_or_coverage");
 if(previous && Date.parse(next.startedAt)<Date.parse(previous.finishedAt))reasons.push("overlapping_or_older_collection");
 // Any drop of more than 25% needs whole-run review, even if the adapter claims full coverage.
 if(previous && next.completeness==="full" && previous.completeness==="full" && next.records.length<previous.records.length*0.75)reasons.push("large_count_drop");
 if(reasons.length)return {status:"blocked",reasons:[...new Set(reasons)],changes:[],writesPublicEvidence:false};
 const oldRecords=new Map((previous?.records??[]).map(r=>[recordKey(r),r]));
 const changes:ProposedChange[]=[];
 for(const after of next.records){
  const key=recordKey(after),before=oldRecords.get(key)??null;
  oldRecords.delete(key);
  if(before && canonical(before)===canonical(after))continue;
  const kind=after.evidenceType==="revocation"?"explicit_revocation":!before?"added":identity(before)!==identity(after)?"identity_changed":"updated";
  changes.push({kind,before,after,requiresReview:true});
 }
 // Missing entries are observations, never revocations. Partial/unknown coverage cannot establish absence.
 if(previous?.completeness==="full" && next.completeness==="full"){
  for(const before of oldRecords.values())changes.push({kind:"missing_from_full_list",before,after:null,requiresReview:true});
 }
 return {status:changes.length?"review_required":"unchanged",reasons:[],changes,writesPublicEvidence:false};
}
