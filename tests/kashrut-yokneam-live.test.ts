// @vitest-environment node
import {writeFile} from "node:fs/promises";
import {it,expect} from "vitest";
import {collectYokneam} from "@/modules/kashrut-admin/yokneam-adapter";
import {stageCollection,compareStagedCollections} from "@/modules/kashrut-admin/ingestion";

/** Explicit opt-in only: public API read, no Supabase calls or public evidence mutation. */
it.skipIf(process.env.WEIG_KASHRUT_LIVE!=="1")("reads and stages the real official resource without publishing",async()=>{
 const collection=await collectYokneam();
 expect(collection.failureReason).toBeNull();expect(collection.outcome).toBe("success");
 const result=stageCollection(collection);expect(result.status).toBe("staged");
 if(result.status!=="staged")throw Error(result.reasons.join(","));
 const proposal=compareStagedCollections(null,result.snapshot);
 expect(proposal.status).toBe("review_required");expect(proposal.writesPublicEvidence).toBe(false);
 expect(JSON.stringify(collection)).not.toContain("supervisor_phone");
 expect(collection.records.every(record=>record.validUntil===null&&record.scope==="unspecified")).toBe(true);
 await writeFile("/tmp/weig-yokneam-live-staging.json",JSON.stringify(result.snapshot,null,2),{mode:0o600});
 console.info(JSON.stringify({source:collection.sourceCode,records:collection.records.length,missingBranchIdentity:collection.records.filter(r=>!r.matchEligible).length,sourceUpdatedAt:collection.records[0]?.sourceUpdatedAt,collectedAt:collection.finishedAt,publicWrites:false}));
},120000);
