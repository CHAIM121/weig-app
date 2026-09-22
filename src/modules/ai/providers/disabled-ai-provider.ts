import type { AiProvider } from "./ai-provider";
export const disabledAiProvider:AiProvider={async complete(){return {ok:false,code:"PROVIDER_UNAVAILABLE",provider:"ai"}}};
