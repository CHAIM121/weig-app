export type KashrutEvidence = {
 id:string; certifier:string; level:string|null; food_type:string|null;
 evidence_type:"official_listing"|"certificate"|"revocation";
 source_url:string; certificate_url:string|null; valid_until:string|null;
 verified_at:string|null; fetched_at:string; source_updated_at:string|null;
};
export function evidenceStatus(e:KashrutEvidence,now=new Date()):"listed"|"verified"|"expired"|"revoked"|"stale" {
 if(e.evidence_type==="revocation")return "revoked";
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jerusalem",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 if(e.valid_until&&e.valid_until<today)return "expired";
 const checked=e.evidence_type==="certificate"?e.verified_at:e.fetched_at;
 if(!checked||!Number.isFinite(Date.parse(checked))||now.getTime()-Date.parse(checked)>7*86400000)return "stale";
 return e.evidence_type==="certificate"&&e.valid_until&&e.verified_at?"verified":"listed";
}
