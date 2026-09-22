import { getPublicSupabaseConfig } from "./config";
export type SupabaseRestClient={url:string;anonKey:string;request(path:string,init?:RequestInit):Promise<Response>};
export function createSupabaseBrowserClient():SupabaseRestClient|null{const config=getPublicSupabaseConfig();if(!config)return null;return {url:config.url,anonKey:config.anonKey,request:(path,init)=>fetch(`${config.url}${path}`,{...init,headers:{apikey:config.anonKey,Authorization:`Bearer ${config.anonKey}`,...init?.headers}})}}
