import {afterEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {GET} from "@/app/api/places/route";
import {GET as details} from "@/app/api/places/details/route";
import {catalogCategories} from "@/modules/places/catalog";
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});
const row={id:"00000000-0000-0000-0000-000000000001",name:"Test park",names:{},latitude:31.74,longitude:34.99,address:"Test city",category:"park",phone:null,website:null,release:"2026-09-23.1",imported_at:"2026-10-03"};
function configure(){vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","public-test-key");vi.stubEnv("GOOGLE_PLACES_API_KEY","")}
describe("independent catalog",()=>{
 it("maps Overture's current Jewish worship category",()=>{expect(catalogCategories.synagogues).toContain("jewish_place_of_worship")});
 it("works without Google and preserves the WEIG identity and attribution",async()=>{
  configure();const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify([row])));
  const response=await GET(new NextRequest("http://localhost/api/places?source=weig&feed=1&lat=31.74&lng=34.99"));
  const body=await response.json();expect(response.status).toBe(200);expect(body.places[0].id).toBe(`weig_${row.id}`);expect(body.places[0].verification).toBe("unverified");expect(body.places[0].photoName).toBeNull();expect(fetcher.mock.calls[0][0]).toContain("rpc/weig_search_places");expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it("never treats an imported restaurant as kosher",async()=>{
  configure();const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("[]"));
  await GET(new NextRequest("http://localhost/api/places?source=weig&category=restaurants&city=בית%20שמש"));
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).category_filter).toEqual([]);
 });
 it("rejects malformed coordinates and requires an area before contacting the database",async()=>{
  configure();const fetcher=vi.spyOn(globalThis,"fetch");
  expect((await GET(new NextRequest("http://localhost/api/places?source=weig&lat=no&lng=34.99"))).status).toBe(400);
  expect((await GET(new NextRequest("http://localhost/api/places?source=weig&feed=1"))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("loads independent details without invented hours, photos or ratings",async()=>{
  configure();vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify([row])));
  const response=await details(new NextRequest(`http://localhost/api/places/details?id=weig_${row.id}`));
  expect(await response.json()).toMatchObject({source:"weig_catalog",hours:[],photos:[],rating:null,openNow:null});
 });
 it("keeps source failures explicit instead of silently substituting Google",async()=>{
  configure();vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("",{status:500}));
  const response=await GET(new NextRequest("http://localhost/api/places?source=weig&city=Test"));
  expect(response.status).toBe(503);expect(await response.json()).toEqual({error:"CATALOG_UNAVAILABLE"});
 });
});
