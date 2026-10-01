// Static guard always runs; integration RLS can target a fresh local/test Supabase via env.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const initial = readFileSync("supabase/migrations/20260922000000_initial_schema.sql", "utf8");
const bootstrap = readFileSync("supabase/migrations/20261001220948_bootstrap_authenticated_users.sql", "utf8");
const hardened = readFileSync("supabase/migrations/20261001221245_secure_policy_helpers.sql", "utf8");
const feedback = readFileSync("supabase/migrations/20261001231034_add_place_visit_feedback.sql", "utf8");

describe("RLS migrations", () => {
  it.each(["profiles", "user_settings", "trips", "trip_members"])("enables RLS for %s", (table) =>
    expect(initial).toContain(`alter table public.${table} enable row level security`),
  );

  it("limits trip management to owners", () =>
    expect(initial).toContain('policy "owners manage memberships"'));

  it("creates the profile and settings records after auth signup", () => {
    expect(bootstrap).toContain("create trigger on_auth_user_created");
    expect(bootstrap).toContain("insert into public.profiles");
    expect(bootstrap).toContain("insert into public.user_settings");
    expect(bootstrap).toContain("revoke all on function public.handle_new_user() from public, anon, authenticated");
  });

  it("lets trip owners read their trip before membership creation", () => {
    expect(bootstrap).toContain('policy "owners and members read trips"');
    expect(bootstrap).toContain("owner_id = (select auth.uid())");
  });

  it("keeps privileged RLS helpers outside the exposed API schema", () => {
    expect(hardened).toContain("create schema if not exists private");
    expect(hardened).toContain("private.is_trip_member");
    expect(hardened).toContain("private.is_trip_owner");
    expect(hardened).toContain("drop function public.is_trip_member");
    expect(hardened).toContain("drop function public.is_trip_owner");
  });

  it("uses separate owner membership policies for each write action", () => {
    expect(hardened).toContain('policy "owners add memberships"');
    expect(hardened).toContain('policy "owners update memberships"');
    expect(hardened).toContain('policy "owners delete memberships"');
  });

  it("protects visit prompts and private feedback with per-user RLS", () => {
    expect(feedback).toContain("alter table public.place_visit_prompts enable row level security");
    expect(feedback).toContain("alter table public.place_feedback enable row level security");
    expect(feedback).toContain('(select auth.uid()) = user_id');
    expect(feedback).toContain('policy "users update their feedback"');
  });

  it("publishes feedback without exposing account ids", () => {
    expect(feedback).toContain("create table public.place_feedback_public");
    expect(feedback).toContain("create function private.sync_place_feedback_public()");
    expect(feedback).toContain("grant select on table public.place_feedback_public to anon, authenticated");
    const publicTable = feedback.split("create table public.place_feedback_public")[1]?.split(");")[0] ?? "";
    expect(publicTable).not.toContain("user_id");
  });
});
