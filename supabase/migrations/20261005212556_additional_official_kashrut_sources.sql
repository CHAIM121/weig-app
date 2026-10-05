create or replace function public.weig_find_kashrut_candidates(p_city text,p_country text)
returns setof public.weig_kashrut_evidence
language sql stable security definer set search_path = ''
as $$
 select e.* from public.weig_kashrut_evidence e
 where e.active_in_directory and e.city=p_city and e.country=p_country
 and length(p_city) between 2 and 120 and length(p_country)=2
 and ((e.source='beit_shemesh_council' and e.source_url='https://www.rabanutbs.co.il/53/')
 or (e.source='petah_tikva_council' and e.source_url like 'https://mpt.org.il/directory-kashrut/listing/%')
 or (e.source='netanya_council' and e.source_url like 'https://mdn.org.il/directory-kashrut/listing/%')
 or (e.source='yokneam_government' and e.source_url='https://data.gov.il/he/datasets/religion-office/kosherbusiness/c54032cb-5306-4be9-a20d-a0be0ba49cc1')
 or (e.source='ou_kosher' and e.source_url like 'https://oukosher.org/restaurants/%'))
 order by e.source,e.source_key limit 1000;
$$;
