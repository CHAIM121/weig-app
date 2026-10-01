-- Provision the application-owned records every authenticated WEIG user needs.
-- The function is a trigger-only security definer because auth.users is not
-- writable through the public Data API. It is not callable by API roles.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
begin
  resolved_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  )), '');

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    resolved_name,
    nullif(coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ), '')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill safely if authentication was tested before this migration landed.
insert into public.profiles (id, display_name, avatar_url)
select
  users.id,
  nullif(trim(coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name',
    split_part(coalesce(users.email, ''), '@', 1)
  )), ''),
  nullif(coalesce(
    users.raw_user_meta_data ->> 'avatar_url',
    users.raw_user_meta_data ->> 'picture'
  ), '')
from auth.users as users
on conflict (id) do nothing;

insert into public.user_settings (user_id)
select profiles.id
from public.profiles as profiles
on conflict (user_id) do nothing;

-- A trip owner must be able to read the trip immediately after creating it,
-- even before the owner membership row has been inserted.
drop policy "trip members read trips" on public.trips;
create policy "owners and members read trips"
on public.trips
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_trip_member(id)
);
