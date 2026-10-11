// @vitest-environment node
import {describe,expect,it} from "vitest";
import {compareStagedCollections,stageCollection,type CollectedEvidence,type Collection,type StagedSnapshot} from "@/modules/kashrut-admin/ingestion";

const now=new Date("2026-10-11T22:00:00Z");
function record(key="1",changes:Partial<CollectedEvidence>={}):CollectedEvidence{
 return {sourceKey:key,agencyCode:"test_agency",businessName:`Business ${key}`,address:`Main ${key}`,city:"Test City",country:"IL",matchEligible:true,scope:"branch",scopeText:"Entire branch",evidenceType:"official_listing",sourceUrl:"https://example.org/list",sourceText:"Published branch listing",validUntil:null,sourceUpdatedAt:null,claims:{milk:"unknown"},...changes};
}
function collection(changes:Partial<Collection>={}):Collection{
 return {sourceCode:"test_source",adapterVersion:"1",coverageKey:"city:test;key:id;kind:establishments",startedAt:"2026-10-10T12:00:00Z",finishedAt:"2026-10-10T12:01:00Z",outcome:"success",completeness:"full",expectedPages:1,receivedPages:1,expectedRecords:null,completenessEvidence:"Final cursor exhausted; one page",failureReason:null,records:[record()],...changes};
}
function stage(changes:Partial<Collection>={}):StagedSnapshot{
 const result=stageCollection(collection(changes),now);
 if(result.status!=="staged")throw Error(result.reasons.join(","));
 return result.snapshot;
}
function later(changes:Partial<Collection>={}):StagedSnapshot{
 return stage({startedAt:"2026-10-11T12:00:00Z",finishedAt:"2026-10-11T12:01:00Z",...changes});
}
describe("external collection staging",()=>{
 it.each(["failed","partial"] as const)("quarantines a %s run without creating a snapshot",outcome=>{
  expect(stageCollection(collection({outcome,failureReason:"Pagination failed"}),now).status).toBe("quarantined");
 });
 it("rejects empty successful responses and missing pages",()=>{
  expect(stageCollection(collection({records:[]}),now).status).toBe("quarantined");
  expect(stageCollection(collection({expectedPages:2}),now).status).toBe("quarantined");
 });
 it("requires evidence for full coverage and checks the source record count",()=>{
  expect(stageCollection(collection({completenessEvidence:""}),now).status).toBe("quarantined");
  expect(stageCollection(collection({expectedPages:null}),now).status).toBe("quarantined");
  expect(stageCollection(collection({expectedRecords:50}),now).status).toBe("quarantined");
 });
 it("rejects ambiguous identity, duplicate scoped keys and malformed claims",()=>{
  for(const records of [[record("1",{city:""})],[record(),record()],[record("1",{claims:{milk:"inferred"} as never})]]){
   expect(stageCollection(collection({records}),now).status).toBe("quarantined");
  }
 });
 it("preserves two agencies and restricted departments at one branch",()=>{
  const snapshot=stage({records:[record(),record("1",{agencyCode:"other_agency"}),record("1",{scope:"counter",scopeText:"Deli only"})]});
  expect(snapshot.records).toHaveLength(3);
  expect(snapshot.records[2].scope).toBe("counter");
  expect(snapshot.records[2].claims.milk).toBe("unknown");
 });
 it("rejects invalid expiry, credential URLs and future source dates",()=>{
  for(const changes of [{validUntil:"2026-02-30"},{sourceUrl:"https://user:pass@example.org"},{sourceUpdatedAt:"2027-01-01T00:00:00Z"}]){
   expect(stageCollection(collection({records:[record("1",changes)]}),now).status).toBe("quarantined");
  }
 });
 it("rejects future, unordered and timezone-less collection timestamps",()=>{
  for(const changes of [{finishedAt:"2027-01-01T00:00:00Z"},{finishedAt:"2026-10-09T00:00:00Z"},{startedAt:"2026-10-10T12:00:00"}]){
   expect(stageCollection(collection(changes),now).status).toBe("quarantined");
  }
 });
 it("hashes canonical content independent of order and run times, preserving claims",()=>{
  const before=stage({records:[record("1"),record("2")]});
  const after=later({records:[record("2"),record("1")]});
  expect(before.contentHash).toBe(after.contentHash);
  expect(later({records:[record("1",{claims:{milk:"yes"}})]}).contentHash).not.toBe(stage().contentHash);
 });
 it("copies adapter input instead of retaining mutable references",()=>{
  const input=collection(),result=stageCollection(input,now);
  input.records[0].businessName="Changed afterwards";
  expect(result.status==="staged" && result.snapshot.records[0].businessName).toBe("Business 1");
 });
});
describe("review proposals without public writes",()=>{
 it("creates reviewed baseline additions",()=>{
  const result=compareStagedCollections(null,stage(),now);
  expect(result.changes[0]).toMatchObject({kind:"added",requiresReview:true,before:null});
  expect(result.writesPublicEvidence).toBe(false);
 });
 it("does not renew evidence or certificates when content is unchanged",()=>{
  const before=stage(),after=later(),saved=JSON.stringify(before);
  expect(compareStagedCollections(before,after,now)).toMatchObject({status:"unchanged",changes:[],writesPublicEvidence:false});
  expect(JSON.stringify(before)).toBe(saved);
 });
 it("distinguishes an explicit revocation from disappearance",()=>{
  const before=stage({records:[record("1"),record("2"),record("3"),record("4")]}),after=later({records:[record("1",{evidenceType:"revocation",sourceText:"Explicit withdrawal"}),record("2"),record("3")]});
  expect(compareStagedCollections(before,after,now).changes.map(c=>c.kind)).toEqual(["explicit_revocation","missing_from_full_list"]);
 });
 it.each(["partial","unknown"] as const)("does not infer absence from %s coverage",completeness=>{
  const before=stage({records:[record("1"),record("2")]}),after=later({records:[record("1")],completeness});
  expect(compareStagedCollections(before,after,now).changes).toEqual([]);
  expect(compareStagedCollections(stage({completeness}),later({records:[record("2")]}),now).changes.map(c=>c.kind)).toEqual(["added"]);
 });
 it("blocks unexpected large drops rather than proposing bulk removals",()=>{
  const result=compareStagedCollections(stage({records:[record("1"),record("2"),record("3"),record("4")]}),later(),now);
  expect(result).toMatchObject({status:"blocked",reasons:["large_count_drop"],changes:[]});
 });
 it("requires review and rematching for a branch address change",()=>{
  const result=compareStagedCollections(stage(),later({records:[record("1",{address:"Different street 9"})]}),now);
  expect(result.changes[0]).toMatchObject({kind:"identity_changed",requiresReview:true});
 });
 it("keeps scope changes separate rather than extending a deli claim to the whole store",()=>{
  const result=compareStagedCollections(stage({records:[record("1",{scope:"counter",scopeText:"Deli only"})]}),later(),now);
  expect(result.changes.map(c=>c.kind)).toEqual(["added","missing_from_full_list"]);
 });
 it("reviews certificate expiry and changed claims without claiming verification",()=>{
  const result=compareStagedCollections(stage(),later({records:[record("1",{evidenceType:"certificate",validUntil:"2026-10-09",claims:{milk:"no"}})]}),now);
  expect(result.changes[0]).toMatchObject({kind:"updated",requiresReview:true});
  expect(result.changes[0].after?.validUntil).toBe("2026-10-09");
 });
 it("blocks different coverage, source and overlapping or older runs",()=>{
  for(const after of [later({coverageKey:"other-city"}),later({sourceCode:"other_source"}),stage()]){
   expect(compareStagedCollections(stage(),after,now).status).toBe("blocked");
  }
 });
 it("detects snapshot mutation before proposing any changes",()=>{
  const before=stage();before.records[0].businessName="Tampered";
  expect(compareStagedCollections(before,later(),now)).toMatchObject({status:"blocked",reasons:["invalid_or_modified_snapshot"],changes:[]});
 });
});
