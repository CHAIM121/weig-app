create extension if not exists pgcrypto;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 100),
  avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz
);
create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  locale text not null default 'he' check (locale in ('he','en')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.trips (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz
);
create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  created_at timestamptz not null default now(), primary key(trip_id,user_id)
);
create unique index one_owner_per_trip on public.trip_members(trip_id) where role='owner';
create index trips_owner_idx on public.trips(owner_id) where archived_at is null;
create index trip_members_user_idx on public.trip_members(user_id);
create function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger settings_updated before update on public.user_settings for each row execute function public.set_updated_at();
create trigger trips_updated before update on public.trips for each row execute function public.set_updated_at();
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
-- Security-definer helpers prevent recursive policy evaluation; callers cannot alter search_path.
create function public.is_trip_member(check_trip uuid) returns boolean language sql stable security definer set search_path='public' as $$ select exists(select 1 from public.trip_members where trip_id=check_trip and user_id=(select auth.uid())) $$;
create function public.is_trip_owner(check_trip uuid) returns boolean language sql stable security definer set search_path='public' as $$ select exists(select 1 from public.trips where id=check_trip and owner_id=(select auth.uid())) $$;
revoke all on function public.is_trip_member(uuid) from public;
revoke all on function public.is_trip_owner(uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid) to authenticated;
-- RLS is deny-by-default. Only explicit self/member access is granted.
create policy "profiles self read" on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy "profiles self update" on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy "settings self all" on public.user_settings for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "trip members read trips" on public.trips for select to authenticated using (public.is_trip_member(id));
create policy "owners create trips" on public.trips for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "owners update trips" on public.trips for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy "members read memberships" on public.trip_members for select to authenticated using (user_id=(select auth.uid()) or public.is_trip_owner(trip_id));
create policy "owners manage memberships" on public.trip_members for all to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
