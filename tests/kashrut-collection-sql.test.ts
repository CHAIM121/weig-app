// @vitest-environment node
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
import {beforeAll,afterAll,describe,it,expect} from "vitest";
const manager="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
let db:PGlite,source:string,version:number;
async function actor(user=manager,anonymous=false){
 await db.exec("reset role");
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,role:"authenticated",is_anonymous:anonymous})]);
 await db.exec("set role authenticated");
}
async function begin(key:string){return (await db.query<{result:{run_id:string;reused:boolean;baseline:unknown}}>("select public.weig_kashrut_collection_begin($1,$2,$3,'yokneam-ckan-v1','test-coverage') as result",[source,version,key])).rows[0].result;}
const snapshot={sourceCode:"yokneam_government",adapterVersion:"yokneam-ckan-v1",coverageKey:"test-coverage",outcome:"success",records:[{sourceUpdatedAt:"2026-03-24T06:46:12Z"}],contentHash:"a".repeat(64)};
async function finish(id:string,records:unknown=snapshot,reasons:string[]=[]){return (await db.query<{result:string}>("select public.weig_kashrut_collection_finish($1,$2::jsonb,'[]'::jsonb,$3::jsonb) as result",[id,records===null?null:JSON.stringify(records),JSON.stringify(reasons)])).rows[0].result;}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;grant usage on schema auth,private to authenticated;
 create table auth.users(id uuid primary key);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 insert into auth.users values('${manager}'),('${other}');`);
 for(const path of ["20261005222744_kashrut_management_registry.sql","20261006114103_kashrut_relationships_and_source_profiles.sql","20261006114830_kashrut_dossier_review_timestamps.sql","20261011215455_kashrut_external_collection_staging.sql"]){
  await db.exec(await readFile(`supabase/migrations/${path}`,"utf8"));
 }
 await db.exec(`insert into public.weig_kashrut_managers(user_id) values('${manager}');create table public.weig_kashrut_evidence(id integer,fetched_at text);insert into public.weig_kashrut_evidence values(1,'original-fetch');`);
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:manager})]);
 await db.exec("update public.weig_kashrut_agencies set status='verified',official_url='https://example.org/official' where code='yokneam_council';update public.weig_kashrut_registry_sources set content_kind='establishments',access_status='allowed',terms_url='https://data.gov.il/he/terms-of-use',access_notes='Documented open data permission',stable_key='resource scoped row id',adapter_version='yokneam-ckan-v1',refresh_frequency='manual' where code='yokneam_government';update public.weig_kashrut_registry_sources set adapter_test_status='passed',adapter_test_notes='Controlled fixture cases passed' where code='yokneam_government';");
 const row=(await db.query<{id:string;version:number}>("select id,version from public.weig_kashrut_registry_sources where code='yokneam_government'")).rows[0];source=row.id;version=row.version;
},30000);
afterAll(async()=>{await db?.close();});
describe.sequential("actual collection SQL and database access",()=>{
 it("denies non-managers, anonymous identities and direct history/snapshot writes",async()=>{
  await actor(other);await expect(begin("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({code:"42501"});
  expect((await db.query("select * from public.weig_kashrut_collection_runs")).rows).toHaveLength(0);
  await actor(manager,true);await expect(begin("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({code:"42501"});
  await actor();await expect(db.exec("update public.weig_kashrut_collection_runs set record_count=999")).rejects.toMatchObject({code:"42501"});
  await expect(db.exec("select * from private.weig_kashrut_collection_snapshots")).rejects.toMatchObject({code:"42501"});
  await db.exec("reset role;set role anon");await expect(begin("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({code:"42501"});
 });
 it("deduplicates requests and leases one running collection per source",async()=>{
  await actor();const key="00000000-0000-4000-8000-000000000002",first=await begin(key),reused=await begin(key);
  expect(reused).toMatchObject({run_id:first.run_id,reused:true,status:"running"});
  await expect(begin("00000000-0000-4000-8000-000000000003")).rejects.toMatchObject({code:"55P03"});
  expect(await finish(first.run_id)).toBe("staged");
  await expect(finish(first.run_id)).rejects.toMatchObject({code:"40001"});
 });
 it("returns an immutable baseline and never writes public evidence",async()=>{
  await actor();const run=await begin("00000000-0000-4000-8000-000000000004");expect(run.baseline).toEqual(snapshot);
  expect(await finish(run.run_id,null,["source_access_blocked"])).toBe("failed");
  await db.exec("reset role");expect((await db.query("select * from public.weig_kashrut_evidence")).rows).toEqual([{id:1,fetched_at:"original-fetch"}]);
 });
 it("invalidates a collection when the source dossier changes mid-run",async()=>{
  await actor();const run=await begin("00000000-0000-4000-8000-000000000005");
  await db.exec("update public.weig_kashrut_registry_sources set coverage='Updated coverage' where code='yokneam_government'");
  expect(await finish(run.run_id)).toBe("quarantined");
  expect((await db.query<{reasons:string[]}>("select reasons from public.weig_kashrut_collection_runs where id=$1",[run.run_id])).rows[0].reasons).toContain("source_version_changed");
  const latest=(await db.query<{version:number}>("select version from public.weig_kashrut_registry_sources where id=$1",[source])).rows[0];version=latest.version;
 });
 it("rejects stale source versions and blocked sources",async()=>{
  await actor();await expect(db.query("select public.weig_kashrut_collection_begin($1,$2,$3,'yokneam-ckan-v1','test-coverage')",[source,version-1,"00000000-0000-4000-8000-000000000006"])).rejects.toMatchObject({code:"40001"});
  await db.exec("update public.weig_kashrut_registry_sources set connection_state='blocked' where code='yokneam_government'");
  version=(await db.query<{version:number}>("select version from public.weig_kashrut_registry_sources where id=$1",[source])).rows[0].version;
  await expect(begin("00000000-0000-4000-8000-000000000007")).rejects.toMatchObject({code:"22023"});
  await db.exec("update public.weig_kashrut_registry_sources set connection_state='manual_import' where code='yokneam_government'");
  version=(await db.query<{version:number}>("select version from public.weig_kashrut_registry_sources where id=$1",[source])).rows[0].version;
 });
 it("recovers an expired lease and fences the old worker",async()=>{
  await actor();const stale=await begin("00000000-0000-4000-8000-000000000008");
  await db.exec("reset role");await db.query("update public.weig_kashrut_collection_runs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[stale.run_id]);
  await actor();expect(await begin("00000000-0000-4000-8000-000000000008")).toMatchObject({reused:true,status:"failed"});
  const fresh=await begin("00000000-0000-4000-8000-000000000009");
  await expect(finish(stale.run_id)).rejects.toMatchObject({code:"40001"});expect(await finish(fresh.run_id)).toBe("staged");
 });
 it("does not expose history after removing manager membership",async()=>{
  await db.exec("reset role");await db.query("delete from public.weig_kashrut_managers where user_id=$1",[manager]);
  await actor();expect((await db.query("select * from public.weig_kashrut_collection_runs")).rows).toHaveLength(0);
  await expect(begin("00000000-0000-4000-8000-000000000010")).rejects.toMatchObject({code:"42501"});
 });
});
