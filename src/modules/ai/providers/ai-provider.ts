import type { ProviderUnavailable } from "@/modules/places/providers/places-provider";
export interface AiProvider { complete(prompt:string):Promise<{ok:true;text:string}|ProviderUnavailable>; }
