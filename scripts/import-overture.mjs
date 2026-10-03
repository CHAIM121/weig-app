// Server/admin only. Never put the service key in NEXT_PUBLIC_* variables.
import {readFile} from "node:fs/promises";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key||!process.argv[2]||!process.argv[3])throw new Error("Set Supabase URL/service key; pass records.json and region name");
const records=JSON.parse(await readFile(process.argv[2],"utf8"));
if(!Array.isArray(records))throw new Error("Expected an array");
let imported=0;
for(let offset=0;offset<records.length;offset+=250){
 const response=await fetch(`${url}/rest/v1/rpc/weig_import_overture`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({records:records.slice(offset,offset+250),region_name:process.argv[3]}),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Import stopped at ${offset}; HTTP ${response.status}. Re-running preserves IDs.`);
 imported+=await response.json();console.log(`Imported ${imported}/${records.length}`);
}
