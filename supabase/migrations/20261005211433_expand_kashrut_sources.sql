alter table public.weig_kashrut_evidence add column business_phone text;
alter table public.weig_kashrut_evidence add column country text not null default 'IL';
alter table public.weig_kashrut_evidence add column active_in_directory boolean not null default true;
create index weig_kashrut_evidence_locality_idx on public.weig_kashrut_evidence(country,city) where active_in_directory;
-- Public official business data only. No credentials, writes, or provider links are exposed.
create function public.weig_find_kashrut_candidates(p_city text,p_country text)
returns setof public.weig_kashrut_evidence
language sql stable security definer set search_path = ''
as $$
 select e.* from public.weig_kashrut_evidence e
 where e.active_in_directory and e.city=p_city and e.country=p_country
 and length(p_city) between 2 and 120 and length(p_country)=2
 and ((e.source='beit_shemesh_council' and e.source_url='https://www.rabanutbs.co.il/53/')
 or (e.source='petah_tikva_council' and e.source_url like 'https://mpt.org.il/directory-kashrut/listing/%')
 or (e.source='ou_kosher' and e.source_url like 'https://oukosher.org/restaurants/%'))
 order by e.source,e.source_key limit 1000;
$$;
revoke all on function public.weig_find_kashrut_candidates(text,text) from public;
grant execute on function public.weig_find_kashrut_candidates(text,text) to anon,authenticated,service_role;
