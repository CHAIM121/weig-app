-- Only independently supplied WEIG content belongs in this table. No Google payloads.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique not null check (google_place_id ~ '^[A-Za-z0-9_-]{5,200}$'),
  category text not null check (category in ('kosher_restaurant','cafe_bakery','grocery_takeout','synagogue','tzadik_grave','mikveh','chabad_house','nature_trail','family_attraction','park_viewpoint','beach_spring','hotel_tzimmer','transport_parking','useful_services')),
  name_he text check (char_length(name_he) between 1 and 200),
  address_he text check (char_length(address_he) <= 500),
  phone text check (char_length(phone) <= 60),
  website text check (website is null or website like 'https://%'),
  opening_hours jsonb,
  own_lat double precision check (own_lat between -90 and 90),
  own_lng double precision check (own_lng between -180 and 180),
  description_he text,
  photos text[] not null default '{}',
  menu_url text,
  minyan_times jsonb,
  mikveh_hours jsonb,
  kashrut_attributes jsonb,
  -- Future Phase 2/3 trusted writers maintain these. Public clients cannot set them.
  verification_count integer not null default 0 check (verification_count >= 0),
  business_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((own_lat is null) = (own_lng is null))
);
comment on table public.places is 'Google ID plus independently authored WEIG data ONLY. Do not populate from Google responses, translations or summaries.';
create index places_category_idx on public.places(category);
create trigger places_updated before update on public.places for each row execute function public.set_updated_at();
alter table public.places enable row level security;
revoke all on public.places from anon, authenticated;
grant select on public.places to anon, authenticated;
grant all on public.places to service_role;
create policy "publish independently contributed places" on public.places for select to anon, authenticated
  using (name_he is not null and (verification_count >= 1 or business_claimed));

-- Coordinates only. 29-day retention leaves a full day for cleanup failures before
-- the contractual 30-day maximum. Read policies enforce the earlier hard expiry.
create table public.google_place_cache (
  google_place_id text primary key check (google_place_id ~ '^[A-Za-z0-9_-]{5,200}$'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  acquired_at timestamptz not null,
  expires_at timestamptz not null,
  check (expires_at <= acquired_at + interval '29 days'),
  check (expires_at > acquired_at)
);
create index google_place_cache_expiry_idx on public.google_place_cache(expires_at);
alter table public.google_place_cache enable row level security;
revoke all on public.google_place_cache from anon, authenticated;
grant select on public.google_place_cache to anon, authenticated;
grant all on public.google_place_cache to service_role;
create policy "unexpired coordinates only" on public.google_place_cache for select to anon, authenticated using (expires_at > now());

create function public.weig_search_own_places(
  p_query text default '', p_city text default '', p_category text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_radius double precision default 5000, p_offset integer default 0
) returns setof public.places language sql stable security invoker set search_path = '' as $$
  select p.* from public.places p
  left join public.google_place_cache c on c.google_place_id=p.google_place_id and c.expires_at > now()
  where (p.verification_count >= 1 or p.business_claimed) and p.name_he is not null
    and (p_category is null or p.category = p_category)
    and (p_query = '' or strpos(lower(p.name_he), lower(p_query)) > 0 or strpos(lower(coalesce(p.address_he,'')), lower(p_query)) > 0)
    and (p_city = '' or strpos(lower(coalesce(p.address_he,'')), lower(p_city)) > 0)
    and (p_lat is null or p_lng is null or (
      coalesce(p.own_lat,c.lat) is not null and coalesce(p.own_lng,c.lng) is not null and
      6371000 * 2 * asin(sqrt(least(1.0, greatest(0.0,
        power(sin(radians(coalesce(p.own_lat,c.lat) - p_lat)/2),2) + cos(radians(p_lat))*cos(radians(coalesce(p.own_lat,c.lat)))*power(sin(radians(coalesce(p.own_lng,c.lng) - p_lng)/2),2)
      )))) <= least(greatest(p_radius,1),50000)
    ))
  order by p.verification_count desc, p.id limit 12 offset least(greatest(p_offset,0),60)
$$;
revoke all on function public.weig_search_own_places(text,text,text,double precision,double precision,double precision,integer) from public;
grant execute on function public.weig_search_own_places(text,text,text,double precision,double precision,double precision,integer) to anon, authenticated, service_role;

create function public.weig_cache_coordinates(p_rows jsonb, p_acquired_at timestamptz)
returns void language sql security invoker set search_path = '' as $$
  insert into public.google_place_cache(google_place_id,lat,lng,acquired_at,expires_at)
  select r.google_place_id,r.lat,r.lng,p_acquired_at,p_acquired_at+interval '29 days'
  from jsonb_to_recordset(p_rows) as r(google_place_id text,lat double precision,lng double precision)
  where p_acquired_at <= now() and p_acquired_at > now()-interval '29 days'
  on conflict (google_place_id) do update set lat=excluded.lat,lng=excluded.lng,
    acquired_at=excluded.acquired_at,expires_at=excluded.expires_at
  where public.google_place_cache.acquired_at < excluded.acquired_at
$$;
revoke all on function public.weig_cache_coordinates(jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.weig_cache_coordinates(jsonb,timestamptz) to service_role;

create table public.google_call_daily (
  day date not null,
  sku text not null check (char_length(sku) between 1 and 80),
  calls bigint not null default 0,
  failures bigint not null default 0,
  primary key(day,sku)
);
alter table public.google_call_daily enable row level security;
revoke all on public.google_call_daily from anon, authenticated;
grant all on public.google_call_daily to service_role;
create function public.weig_record_google_call(p_sku text, p_failed boolean)
returns void language sql security invoker set search_path = '' as $$
  insert into public.google_call_daily(day,sku,calls,failures)
  values ((now() at time zone 'UTC')::date,p_sku,1,case when p_failed then 1 else 0 end)
  on conflict (day,sku) do update set calls=public.google_call_daily.calls+1,
    failures=public.google_call_daily.failures+excluded.failures
$$;
revoke all on function public.weig_record_google_call(text,boolean) from public, anon, authenticated;
grant execute on function public.weig_record_google_call(text,boolean) to service_role;

-- No new snapshots of Google names/addresses/URLs in the legacy feedback tables.
-- Preserve user reviews and stable IDs, and scrub historical Google snapshots too.
create function public.weig_scrub_google_snapshot() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.place_id not like 'weig\_%' escape '\' then
    new.place_name := new.place_id;
    if tg_table_name = 'place_visit_prompts' then
      new.place_area := null;
      new.maps_url := null;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.weig_scrub_google_snapshot() from public;
create trigger scrub_google_visit_snapshot before insert or update on public.place_visit_prompts
  for each row execute function public.weig_scrub_google_snapshot();
create trigger scrub_google_feedback_snapshot before insert or update on public.place_feedback
  for each row execute function public.weig_scrub_google_snapshot();

update public.place_visit_prompts set place_name=place_id,place_area=null,maps_url=null
  where place_id not like 'weig\_%' escape '\';
update public.place_feedback set place_name=place_id
  where place_id not like 'weig\_%' escape '\';
-- The existing feedback sync trigger updates its public read model as well.

-- pg_cron must be available on the target Supabase project. Fail deployment if not:
-- silently skipping cleanup would violate the retention design.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('weig-google-coordinate-expiry','* * * * *',
  $$delete from public.google_place_cache where expires_at <= now()$$);
