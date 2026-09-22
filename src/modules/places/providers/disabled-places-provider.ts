import type { PlacesProvider } from "./places-provider";
export const disabledPlacesProvider:PlacesProvider={async listPlaces(){return {ok:false,code:"PROVIDER_UNAVAILABLE",provider:"places"}}};
