export type ProviderUnavailable={ok:false;code:"PROVIDER_UNAVAILABLE";provider:string};
export type Place={id:string;name:string};
export interface PlacesProvider { listPlaces():Promise<{ok:true;data:Place[]}|ProviderUnavailable>; }
