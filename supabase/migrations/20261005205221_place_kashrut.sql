create table public.weig_place_identities (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
create table public.weig_place_provider_links (
 provider text not null, external_id text not null, place_id uuid not null references public.weig_place_identities(id),
 match_status text not null default 'pending' check(match_status in ('pending','approved','rejected')),
 match_basis text not null, matched_at timestamptz not null default now(), primary key(provider,external_id)
);
create index weig_place_provider_links_place_idx on public.weig_place_provider_links(place_id);
create table public.weig_kashrut_evidence (
 id uuid primary key default gen_random_uuid(),place_id uuid not null references public.weig_place_identities(id),
 source text not null,source_key text not null,business_name text not null,address text not null default '',city text not null,
 certifier text not null,level text,food_type text,source_label text,
 evidence_type text not null check(evidence_type in ('official_listing','certificate','revocation')),
 source_url text not null check(source_url like 'https://%'),certificate_url text check(certificate_url like 'https://%'),
 valid_until date,verified_at timestamptz,fetched_at timestamptz not null,source_updated_at timestamptz,
 unique(source,source_key),check(evidence_type <> 'certificate' or (valid_until is not null and verified_at is not null))
);
create index weig_kashrut_evidence_place_idx on public.weig_kashrut_evidence(place_id);
alter table public.weig_place_identities enable row level security;
alter table public.weig_place_provider_links enable row level security;
alter table public.weig_kashrut_evidence enable row level security;
revoke all on public.weig_place_identities,public.weig_place_provider_links,public.weig_kashrut_evidence from anon,authenticated;
grant select on public.weig_place_provider_links,public.weig_kashrut_evidence to anon,authenticated;
create policy approved_provider_links_read on public.weig_place_provider_links for select to anon,authenticated using(match_status='approved');
create policy linked_kashrut_read on public.weig_kashrut_evidence for select to anon,authenticated using(exists(select 1 from public.weig_place_provider_links l where l.place_id=weig_kashrut_evidence.place_id and l.match_status='approved'));
grant all on public.weig_place_identities,public.weig_place_provider_links,public.weig_kashrut_evidence to service_role;
