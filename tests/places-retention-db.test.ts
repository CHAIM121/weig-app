// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261022074044_places_retention_and_google_metrics.sql", "utf8");

describe("Phase 1 SQL retention and permissions", () => {
  it("executes SQL, filters expired coordinates, restricts writes, and deletes expired rows", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
        create table public.place_visit_prompts(place_id text,place_name text,place_area text,maps_url text);
        create table public.place_feedback(place_id text,place_name text);
        insert into public.place_visit_prompts values ('ChIJold','Google name','Google area','Google URL');
        insert into public.place_feedback values ('ChIJold','Google name');
        -- pg_cron cannot run inside PGlite. Stub its scheduling API to verify the
        -- exact job definition; execute the registered SQL separately below.
        create schema cron;
        create table cron.test_jobs(name text,schedule text,command text);
        create function cron.schedule(text,text,text) returns bigint language sql as $$
          insert into cron.test_jobs values ($1,$2,$3) returning 1::bigint
        $$;
      `);
      await db.exec(migration.replace('create extension if not exists pg_cron with schema pg_catalog;', ''));
      expect((await db.query<{ place_name: string }>("select place_name from public.place_feedback")).rows[0].place_name).toBe("ChIJold");
      await db.exec(`
        insert into public.places(google_place_id,category,name_he,address_he,own_lat,own_lng,verification_count)
        values ('ChIJowned','synagogue','בית הכנסת','בית שמש',31.75,34.99,1),('ChIJhidden','synagogue','מוסתר','בית שמש',31.75,34.99,0);
        insert into public.google_place_cache values
          ('ChIJfresh',31.75,34.99,now()-interval '1 day',now()+interval '28 days'),
          ('ChIJexpired',31.75,34.99,now()-interval '30 days',now()-interval '1 day');
        set role anon;
      `);
      expect((await db.query("select * from public.google_place_cache")).rows).toHaveLength(1);
      expect((await db.query("select * from public.places")).rows).toHaveLength(1);
      expect((await db.query("select * from public.weig_search_own_places('בית','',null,31.75,34.99,5000,0)")).rows).toHaveLength(1);
      expect((await db.query("select * from public.weig_search_own_places('בית','',null,32.75,34.99,5000,0)")).rows).toHaveLength(0);
      await expect(db.exec("update public.places set verification_count=100")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.google_call_daily")).rejects.toThrow(/permission denied/);
      await expect(db.exec("select public.weig_cache_coordinates('[]'::jsonb,now())")).rejects.toThrow(/permission denied/);
      await db.exec("reset role; set role service_role;");
      await db.exec("select public.weig_record_google_call('text_search_enterprise',false); select public.weig_record_google_call('text_search_enterprise',true);");
      expect((await db.query<{calls:number;failures:number}>("select calls::int,failures::int from public.google_call_daily")).rows[0]).toEqual({calls:2,failures:1});
      await db.exec("select public.weig_cache_coordinates('[{\"google_place_id\":\"ChIJnew\",\"lat\":31.75,\"lng\":34.99}]'::jsonb,now());");
      await db.exec("reset role;");
      const job = (await db.query<{command:string;schedule:string}>("select command,schedule from cron.test_jobs")).rows[0];
      expect(job.schedule).toBe("* * * * *");
      await db.exec(job.command);
      expect((await db.query("select * from public.google_place_cache where google_place_id='ChIJexpired'")).rows).toHaveLength(0);
      await expect(db.exec("insert into public.google_place_cache values ('ChIJbad',0,0,now(),now()+interval '31 days')")).rejects.toThrow(/check constraint/);
      const columns = (await db.query<{column_name:string}>("select column_name from information_schema.columns where table_name='google_place_cache' order by ordinal_position")).rows.map(c=>c.column_name);
      expect(columns).toEqual(['google_place_id','lat','lng','acquired_at','expires_at']);
    } finally { await db.close(); }
  }, 20000);
});
