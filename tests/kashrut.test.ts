import {afterEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {GET} from "@/app/api/places/kashrut/route";
import {evidenceStatus,type KashrutEvidence} from "@/modules/places/kashrut";
const now=new Date("2026-10-05T20:00:00Z");
const listing:KashrutEvidence={id:"evidence",certifier:"רבנות בית שמש",level:null,food_type:"חלבי",evidence_type:"official_listing",source_url:"https://www.rabanutbs.co.il/53/",certificate_url:null,valid_until:null,verified_at:null,fetched_at:now.toISOString(),source_updated_at:null};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});
describe("kashrut evidence",()=>{
 it("does not turn an official directory row into a verified certificate",()=>expect(evidenceStatus(listing,now)).toBe("listed"));
 it("does not treat an expired certificate as current",()=>expect(evidenceStatus({...listing,evidence_type:"certificate",valid_until:"2026-10-04",verified_at:now.toISOString()},now)).toBe("expired"));
 it("uses the Israeli date around midnight",()=>expect(evidenceStatus({...listing,valid_until:"2026-10-05"},new Date("2026-10-05T22:00:00Z"))).toBe("expired"));
 it("requires a fresh check even if validity is in the future",()=>expect(evidenceStatus({...listing,evidence_type:"certificate",valid_until:"2027-01-01",verified_at:"2026-09-01T00:00:00Z"},now)).toBe("stale"));
 it("keeps explicit withdrawal visible",()=>expect(evidenceStatus({...listing,evidence_type:"revocation"},now)).toBe("revoked"));
});
describe("place linking",()=>{
 const configure=()=>{vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","public-test-key")};
 it("returns missing without borrowing evidence from a similarly named place",async()=>{
  configure();const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("[]"));
  const response=await GET(new NextRequest("http://localhost/api/places/kashrut?id=ChIJ_test"));
  expect(await response.json()).toEqual({status:"missing",evidence:[]});expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toContain("match_status=eq.approved");
 });
 it("reports a source outage separately from missing evidence",async()=>{
  configure();vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("",{status:503}));
  expect((await GET(new NextRequest("http://localhost/api/places/kashrut?id=ChIJ_test"))).status).toBe(503);
 });
 it("rejects malformed identifiers before making a database request",async()=>{
  const fetcher=vi.spyOn(globalThis,"fetch");expect((await GET(new NextRequest("http://localhost/api/places/kashrut?id=bad%26filter"))).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();
 });
});
