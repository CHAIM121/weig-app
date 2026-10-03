import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export type CatalogPlace = {id:string; name:string; names:Record<string,unknown>; latitude:number; longitude:number; address:string; category:string; phone:string|null; website:string|null; release:string; imported_at:string};
export const catalogCategories:Record<string,string[]> = {
  restaurants:[], // Requires accepted, unexpired kosher evidence; never infer from category/name.
  bakeries:["cafe","bakery","coffee_shop"], groceries:["grocery_store","supermarket"],
  synagogues:["synagogue","jewish_place_of_worship"], tombs:[], mikvaot:[], chabad:[],
  nature:["national_park","nature_reserve","hiking_trail"], parks:["park","national_park","playground"],
  family:["museum","zoo","amusement_park","aquarium","playground"],
  beaches:["beach","hot_spring"], stays:["hotel","hostel","guest_house"],
  transport:["parking","bus_station","train_station"], essentials:["pharmacy","gas_station","atm"],
};
export async function catalogRequest(path:string, body?:unknown) {
  const config=getPublicSupabaseConfig();
  if(!config) throw new Error("CATALOG_NOT_CONFIGURED");
  const response=await fetch(`${config.url}/rest/v1/${path}`,{method:body?"POST":"GET",headers:{apikey:config.anonKey,Authorization:`Bearer ${config.anonKey}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!response.ok) throw new Error("CATALOG_UNAVAILABLE");
  return response.json() as Promise<CatalogPlace[]>;
}
export function presentCatalogPlace(p:CatalogPlace) {
  return {id:`weig_${p.id}`,name:p.name,address:p.address,location:{latitude:p.latitude,longitude:p.longitude},
    mapsUrl:`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`,
    photoName:null,photoCredits:[],attributions:[{provider:"Overture Maps",providerUri:"https://docs.overturemaps.org/attribution/"}],
    theme:/restaurant|cafe|bakery|grocery/.test(p.category)?"food":/museum|zoo|playground|amusement/.test(p.category)?"family":/synagogue|jewish_place_of_worship|historic/.test(p.category)?"heritage":/park|nature|trail|beach/.test(p.category)?"nature":"other",
    source:"weig_catalog",verification:"unverified",release:p.release};
}
export async function catalogPlace(id:string) {
  const uuid=id.replace(/^weig_/,"");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid))return null;
  return (await catalogRequest(`weig_places?id=eq.${uuid}&limit=1`))[0]??null;
}
