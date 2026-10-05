export type OfficialCandidate = {
 id:string; place_id:string; business_name:string; address:string; city:string;
 country:string; business_phone:string|null;
};
export type GoogleIdentity = {name:string;city:string;country:string;street:string;number:string;address:string;phone:string};
const normalize=(s:string)=>s.normalize("NFKD").toLowerCase().replace(/[\u0591-\u05c7]/g,"").replace(/['’׳"״]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim();
const city=(s:string)=>normalize(s).replace(/פתח תיקווה/g,"פתח תקווה").replace(/יוקנעם/g,"יקנעם");
function name(s:string,place:GoogleIdentity){
 let n=normalize(s);
 for(const part of [place.city,place.street])if(part)n=n.replace(` ${normalize(part)} `,' ').replace(new RegExp(` ${normalize(part)}$`),'');
 return n.replace(/\b(?:restaurant|restaurants|cafe|café|kosher)\b/g,"").replace(/(?:מסעדת|מסעדה|מאפיית|מאפיה|כשר|כשרה|מהדרין|סניף|בית קפה)(?= |$)/g,"").replace(/\s+/g," ").trim();
}
function names(s:string,place:GoogleIdentity){
 return [...new Set([s,...s.split(/\s*[|/]\s*/)].map(part=>name(part,place).replace(/^קפה (?!קפה(?: |$))/,'')).filter(Boolean))];
}
const sameBusiness=(a:string,b:string,place:GoogleIdentity)=>names(a,place).some(n=>names(b,place).includes(n));
function phone(s:string,country:string){let n=s.replace(/\D/g,"");if(country==="IL")n=n.replace(/^972/,"0");if(country==="US"||country==="CA")n=n.replace(/^1(?=\d{10}$)/,"");return n.length>=8?n:"";}
const contains=(text:string,part:string)=>!!part&&(` ${normalize(text)} `).includes(` ${normalize(part)} `);
/** Never match by name alone or a shared chain phone. Require the actual branch address. */
export function matchingCandidates(place:GoogleIdentity,rows:OfficialCandidate[]):OfficialCandidate[]{
 if(!place.city||!place.country)return [];
 const matches=rows.filter(row=>{
  if(row.country!==place.country||city(row.city)!==city(place.city))return false;
  const sameName=sameBusiness(row.business_name,place.name,place);
  const samePhone=!!phone(place.phone,place.country)&&phone(row.business_phone??"",place.country)===phone(place.phone,place.country);
  const street=normalize(place.street).replace(/ (?:st|street|rd|road|ave|avenue|blvd|boulevard)$/i,"");
  const sameStreet=contains(row.address,street);
  const sameNumber=contains(row.address,place.number);
  // Exact street and house number also exclude another branch sharing a chain phone.
  const addressWithoutNumber=!/\d/.test(row.address);
  return !!place.street&&sameStreet&&((sameName||samePhone)&&!!place.number&&sameNumber||sameName&&samePhone&&addressWithoutNumber);
 });
 // Different identities can carry different certifiers for the same branch. A duplicate
 // listing with a conflicting house number or unrelated name is never selected by rank.
 const distinctNames=new Set(matches.map(r=>name(r.business_name,place)));
 if(distinctNames.size>1)return matches.filter(r=>sameBusiness(r.business_name,place.name,place));
 return matches;
}
