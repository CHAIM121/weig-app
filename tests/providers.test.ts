import {describe,expect,it} from "vitest";
import {disabledPlacesProvider} from "@/modules/places/providers/disabled-places-provider";
import {disabledTelephonyProvider} from "@/modules/calls/providers/disabled-telephony-provider";
import {disabledAiProvider} from "@/modules/ai/providers/disabled-ai-provider";
describe("disabled adapters",()=>{it.each([["places",()=>disabledPlacesProvider.listPlaces()],["telephony",()=>disabledTelephonyProvider.listCalls()],["ai",()=>disabledAiProvider.complete("hello")]])("returns explicit unavailable for %s",async(provider,run)=>expect(await run()).toEqual({ok:false,code:"PROVIDER_UNAVAILABLE",provider}))});
