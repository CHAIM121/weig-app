import type { TelephonyProvider } from "./telephony-provider";
export const disabledTelephonyProvider:TelephonyProvider={async listCalls(){return {ok:false,code:"PROVIDER_UNAVAILABLE",provider:"telephony"}}};
