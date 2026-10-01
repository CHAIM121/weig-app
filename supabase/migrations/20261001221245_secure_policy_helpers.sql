-- Keep privileged RLS helpers outside the exposed public API schema. Signed-in
-- clients may use them only while Postgres evaluates a policy.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_trip_member(check_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members
    where trip_id = check_trip
      and user_id = (select auth.uid())
  )
$$;

create function private.is_trip_owner(check_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips
    where id = check_trip
      and owner_id = (select auth.uid())
  )
$$;

revoke all on function private.is_trip_member(uuid) from public, anon;
revoke all on function private.is_trip_owner(uuid) from public, anon;
grant execute on function private.is_trip_member(uuid) to authenticated;
grant execute on function private.is_trip_owner(uuid) to authenticated;

drop policy "owners and members read trips" on public.trips;
create policy "owners and members read trips"
on public.trips
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_trip_member(id)
);

drop policy "members read memberships" on public.trip_members;
drop policy "owners manage memberships" on public.trip_members;

create policy "members read memberships"
on public.trip_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_trip_owner(trip_id)
);

create policy "owners add memberships"
on public.trip_members
for insert
to authenticated
with check (private.is_trip_owner(trip_id));

create policy "owners update memberships"
on public.trip_members
for update
to authenticated
using (private.is_trip_owner(trip_id))
with check (private.is_trip_owner(trip_id));

create policy "owners delete memberships"
on public.trip_members
for delete
to authenticated
using (private.is_trip_owner(trip_id));

drop function public.is_trip_member(uuid);
drop function public.is_trip_owner(uuid);
