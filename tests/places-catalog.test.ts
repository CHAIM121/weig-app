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
 it("disables imported discovery without contacting Google or the database",async()=>{
  configure();const fetcher=vi.spyOn(globalThis,"fetch");
  const response=await GET(new NextRequest("http://localhost/api/places?source=weig&feed=1&lat=31.74&lng=34.99"));
  expect(response.status).toBe(410);expect(await response.json()).toEqual({error:"CATALOG_DISABLED"});
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("loads independent details without invented hours, photos or ratings",async()=>{
  configure();vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify([row])));
  const response=await details(new NextRequest(`http://localhost/api/places/details?id=weig_${row.id}`));
  expect(await response.json()).toMatchObject({source:"weig_catalog",hours:[],photos:[],rating:null,openNow:null});
 });

});
