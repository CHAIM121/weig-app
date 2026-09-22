// Static guard always runs; integration RLS can target a fresh local/test Supabase via env.
import {readFileSync} from "node:fs";import {describe,expect,it} from "vitest";
const sql=readFileSync("supabase/migrations/20260922000000_initial_schema.sql","utf8");
describe("RLS migration",()=>{it.each(["profiles","user_settings","trips","trip_members"])("enables RLS for %s",table=>expect(sql).toContain(`alter table public.${table} enable row level security`));it("limits trip management to owners",()=>expect(sql).toContain('policy "owners manage memberships"'))});
