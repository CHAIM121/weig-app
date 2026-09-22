import type { ProviderUnavailable } from "@/modules/places/providers/places-provider";
export type Call={id:string;startedAt:string};
export interface TelephonyProvider { listCalls():Promise<{ok:true;data:Call[]}|ProviderUnavailable>; }
