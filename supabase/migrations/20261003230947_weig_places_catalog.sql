create extension if not exists postgis with schema extensions;
create table public.weig_places (
  id uuid primary key default gen_random_uuid(),
  overture_id text not null unique,
  name text not null check(length(name) between 1 and 500),
  names jsonb not null default '{}',
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  location extensions.geography(Point,4326) generated always as
    (extensions.st_setsrid(extensions.st_makepoint(longitude,latitude),4326)::extensions.geography) stored,
  address text not null default '', city text, country text,
  category text not null, phone text, website text,
  confidence double precision check(confidence between 0 and 1),
  operating_status text, release text not null,
  imported_at timestamptz not null default now(),
  published boolean not null default true
);
create index weig_places_location_idx on public.weig_places using gist(location) where published;
create index weig_places_city_idx on public.weig_places(lower(city));
create index weig_places_category_idx on public.weig_places(category) where published;
create table public.weig_place_sources (
  place_id uuid not null references public.weig_places(id),
  source text not null,
  external_id text not null,
  source_url text not null,
  license text not null,
  release text not null,
  retrieved_at timestamptz not null default now(),
  payload jsonb not null,
  primary key(source,external_id)
);
create index weig_place_sources_place_idx on public.weig_place_sources(place_id);
create table public.weig_place_claims (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.weig_places(id),
  field text not null,
  value jsonb not null,
  source_url text not null,
  license text not null,
  observed_at timestamptz not null,
  expires_at timestamptz,
  status text not null default 'pending' check(status in ('pending','accepted','rejected','conflict')),
  unique(place_id,field,source_url)
);
create index weig_place_claims_place_idx on public.weig_place_claims(place_id);
create table public.weig_place_imports (
  id uuid primary key default gen_random_uuid(), source text not null,
  release text not null, region text not null, records integer not null,
  completed_at timestamptz not null default now()
);
alter table public.weig_places enable row level security;
alter table public.weig_place_sources enable row level security;
alter table public.weig_place_claims enable row level security;
alter table public.weig_place_imports enable row level security;
revoke all on public.weig_places, public.weig_place_sources, public.weig_place_claims, public.weig_place_imports from anon, authenticated;
grant select on public.weig_places to anon, authenticated;
create policy weig_places_public_read on public.weig_places for select to anon,authenticated using(published);
grant all on public.weig_places, public.weig_place_sources, public.weig_place_claims, public.weig_place_imports to service_role;

create function public.weig_search_places(q text default '', city_filter text default '',
 lat double precision default null, lng double precision default null,
 radius_m integer default 15000, category_filter text[] default null,
 page_offset integer default 0, page_size integer default 24)
returns setof public.weig_places language sql stable security invoker
set search_path = public,extensions
as $$
 select p.* from public.weig_places p
 where p.published and length(q)<=100 and length(city_filter)<=60
 and (q='' or position(lower(q) in lower(p.name||' '||p.address||' '||p.names::text))>0)
 and (city_filter='' or position(lower(city_filter) in lower(coalesce(p.city,'')||' '||p.address))>0)
 and (category_filter is null or p.category=any(category_filter))
 and ((lat is null and lng is null) or
   (lat between -90 and 90 and lng between -180 and 180 and
    extensions.st_dwithin(p.location,extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography,least(greatest(radius_m,100),50000))))
 order by case when lat is not null and lng is not null then p.location operator(extensions.<->) extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography end,
 p.name,p.id limit least(greatest(page_size,1),301) offset least(greatest(page_offset,0),10000)
$$;
revoke all on function public.weig_search_places(text,text,double precision,double precision,integer,text[],integer,integer) from public;
grant execute on function public.weig_search_places(text,text,double precision,double precision,integer,text[],integer,integer) to anon,authenticated,service_role;

create function public.weig_import_overture(records jsonb, region_name text)
returns integer language plpgsql security invoker set search_path=public,extensions as $$
declare item jsonb; place_uuid uuid; imported integer:=0;
begin
 if jsonb_array_length(records)>500 then raise exception 'Batch exceeds 500'; end if;
 for item in select value from jsonb_array_elements(records) loop
  insert into public.weig_places(overture_id,name,names,latitude,longitude,address,city,country,category,phone,website,confidence,operating_status,release,published)
  values(item->>'external_id',item->>'name',coalesce(item->'names','{}'),(item->>'latitude')::double precision,(item->>'longitude')::double precision,
    coalesce(item->>'address',''),item->>'city',item->>'country',item->>'category',item->>'phone',item->>'website',(item->>'confidence')::double precision,item->>'operating_status',item->>'release',coalesce(item->>'operating_status','')<>'permanently_closed')
  on conflict(overture_id) do update set name=excluded.name,names=excluded.names,latitude=excluded.latitude,longitude=excluded.longitude,address=excluded.address,city=excluded.city,country=excluded.country,category=excluded.category,phone=excluded.phone,website=excluded.website,confidence=excluded.confidence,operating_status=excluded.operating_status,release=excluded.release,imported_at=now(),published=excluded.published
  returning id into place_uuid;
  insert into public.weig_place_sources(place_id,source,external_id,source_url,license,release,payload)
  values(place_uuid,'overture',item->>'external_id','https://docs.overturemaps.org/guides/places/','See payload.sources; Overture Places CDLA-Permissive-2.0 / Apache-2.0 / CC0-1.0',item->>'release',item->'raw')
  on conflict(source,external_id) do update set payload=excluded.payload,release=excluded.release,retrieved_at=now();
  imported:=imported+1;
 end loop;
 if imported>0 then
  insert into public.weig_place_imports(source,release,region,records) values('overture',records->0->>'release',region_name,imported);
 end if;
 return imported;
end $$;
revoke all on function public.weig_import_overture(jsonb,text) from public,anon,authenticated;
grant execute on function public.weig_import_overture(jsonb,text) to service_role;
