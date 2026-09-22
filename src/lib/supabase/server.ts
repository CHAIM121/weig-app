import { cookies } from "next/headers";
import { getPublicSupabaseConfig } from "./config";
import type { SupabaseRestClient } from "./browser";
export async function createSupabaseServerClient():Promise<SupabaseRestClient|null>{const config=getPublicSupabaseConfig();if(!config)return null;const store=await cookies();const token=store.get("sb-access-token")?.value??config.anonKey;return {url:config.url,anonKey:config.anonKey,request:(path,init)=>fetch(`${config.url}${path}`,{...init,headers:{apikey:config.anonKey,Authorization:`Bearer ${token}`,...init?.headers}})}}
