import {describe,it,expect,vi,afterEach} from "vitest";
import {NextRequest} from "next/server";
import {matchingCandidates,type GoogleIdentity,type OfficialCandidate} from "@/modules/places/kashrut/matching";
import {GET} from "@/app/api/places/kashrut/route";
const place:GoogleIdentity={name:"אבולעפיה",city:"פתח תקווה",country:"IL",street:"הסיבים",number:"19",address:"הסיבים 19, פתח תקווה",phone:"03-1234567"};
const candidate:OfficialCandidate={id:"official",place_id:"own",business_name:"אבולעפיה",city:"פתח תקווה",country:"IL",address:"19 הסיבים, פתח תקווה, Israel",business_phone:null};
describe("official branch matching",()=>{
 it("links a unique official name, city, street and house number",()=>expect(matchingCandidates(place,[candidate])).toEqual([candidate]));
 it("matches a Google name with a city and kosher descriptor, using the exact branch address",()=>expect(matchingCandidates({...place,name:"אבולעפיה פתח תקווה | כשר"},[candidate])).toEqual([candidate]));
 it("does not borrow a chain's certification from another house number",()=>expect(matchingCandidates(place,[{...candidate,address:"29 הסיבים, פתח תקווה",business_phone:place.phone}])).toEqual([]));
 it("does not borrow certification from another city",()=>expect(matchingCandidates(place,[{...candidate,city:"ירושלים"}])).toEqual([]));
 it("does not match a name without a branch address",()=>expect(matchingCandidates({...place,street:"",number:""},[candidate])).toEqual([]));
 it("allows a spelling/language difference only with the exact business phone and address",()=>expect(matchingCandidates(place,[{...candidate,business_name:"Abulafia",business_phone:"+972 3 1234567"}])).toHaveLength(1));
 it("rejects several businesses sharing a building and contact phone",()=>expect(matchingCandidates(place,[{...candidate,business_name:"Different",business_phone:place.phone},{...candidate,id:"other",business_name:"Other",business_phone:place.phone}])).toEqual([]));
 it("supports an official street without a house number only with name and exact business phone",()=>{expect(matchingCandidates(place,[{...candidate,address:"הסיבים",business_phone:place.phone}])).toHaveLength(1);expect(matchingCandidates(place,[{...candidate,address:"הסיבים"}])).toEqual([])});
 it("does not confuse house 19 with 119",()=>expect(matchingCandidates(place,[{...candidate,address:"119 הסיבים, פתח תקווה"}])).toEqual([]));
 it("keeps multiple official certifiers for the same branch",()=>expect(matchingCandidates(place,[candidate,{...candidate,id:"second"}])).toHaveLength(2));
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});
describe("automatic lookup",()=>{
 it("resolves an unlinked place against server-fetched Google facts, without public writes",async()=>{
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test");vi.stubEnv("GOOGLE_PLACES_API_KEY","test");
  const official={...candidate,certifier:"רבנות פתח תקווה",level:"רגילה",food_type:null,source_label:"כשרות רגילה בתוקף",evidence_type:"official_listing",source_url:"https://mpt.org.il/directory-kashrut/listing/test/",certificate_url:null,valid_until:null,verified_at:null,fetched_at:new Date().toISOString(),source_updated_at:null};
  const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response("[]")).mockResolvedValueOnce(new Response(JSON.stringify({id:"ChIJ_test",displayName:{text:place.name},nationalPhoneNumber:place.phone,addressComponents:[{longText:place.city,types:["locality"]},{shortText:"IL",types:["country"]},{longText:place.street,types:["route"]},{longText:place.number,types:["street_number"]}]}))).mockResolvedValueOnce(new Response(JSON.stringify([official])));
  const response=await GET(new NextRequest("http://localhost/api/places/kashrut?id=ChIJ_test&name=fake"));
  const result=await response.json();expect(result.evidence[0].certifier).toBe("רבנות פתח תקווה");expect(result.evidence[0].status).toBe("listed");
  expect(result.evidence[0].business_phone).toBeUndefined();expect(fetcher.mock.calls[2][0]).toContain("rpc/weig_find_kashrut_candidates");expect(fetcher.mock.calls[2][1]?.body).toBe(JSON.stringify({p_city:place.city,p_country:"IL"}));
 });
 it("does not claim missing when Google identity lookup fails",async()=>{
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test");vi.stubEnv("GOOGLE_PLACES_API_KEY","test");
  vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response("[]")).mockResolvedValueOnce(new Response("",{status:503}));
  expect((await GET(new NextRequest("http://localhost/api/places/kashrut?id=ChIJ_test"))).status).toBe(503);
 });
});
