begin;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000001','role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.weig_kashrut_monitor_runs) then raise exception 'Non-manager read history';end if;
 begin perform public.weig_kashrut_check_stored_data('00000000-0000-0000-0000-000000000001');raise exception 'Non-manager ran check';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from public.weig_kashrut_managers limit 1),'role','authenticated')::text,true);
-- Synthetic records and every history/review row are rolled back.
insert into public.weig_kashrut_registry_sources(code,name_he,agency_id,url,format)
 select 'test_monitor_source','בדיקת מעקב',(select id from public.weig_kashrut_agencies limit 1),'https://example.org/','html';
insert into public.weig_kashrut_evidence(place_id,source,source_key,business_name,address,city,certifier,evidence_type,source_url,fetched_at)
 values((select id from public.weig_place_identities limit 1),'test_monitor_source','branch','עסק זמני','כתובת א','עיר','גוף לדוגמה','official_listing','https://example.org/',now());
set local role authenticated;
do $$declare src uuid; first_run uuid; second_run uuid;begin
 select id into src from public.weig_kashrut_registry_sources where code='test_monitor_source';
 first_run=public.weig_kashrut_check_stored_data(src);
 if not exists(select 1 from public.weig_kashrut_monitor_runs where id=first_run and baseline and total_count=1 and jsonb_array_length(changes)=0) then raise exception 'Bad baseline';end if;
 update public.weig_kashrut_review_tasks set status='resolved',decision='אימות במסגרת הבדיקה הזמנית' where source_id=src;
 second_run=public.weig_kashrut_check_stored_data(src);
 if second_run<>first_run then raise exception 'Repeated click not deduplicated';end if;
 begin update public.weig_kashrut_monitor_runs set total_count=999 where id=first_run;raise exception 'History mutable';exception when insufficient_privilege then null;end;
 begin perform records from private.weig_kashrut_monitor_snapshots;raise exception 'Private snapshots exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.weig_kashrut_evidence set address='כתובת ב' where source='test_monitor_source';
set local role authenticated;
do $$declare r uuid;begin
 r=public.weig_kashrut_check_stored_data((select id from public.weig_kashrut_registry_sources where code='test_monitor_source'));
 if not exists(select 1 from public.weig_kashrut_review_tasks where source_id=(select source_id from public.weig_kashrut_monitor_runs where id=r) and status='open') then raise exception 'Risky change did not enqueue review';end if;
 if not exists(select 1 from public.weig_kashrut_monitor_runs where id=r and not baseline and changes->0->>'kind'='address_changed' and changes->0->'before'->>'address'='כתובת א' and changes->0->'after'->>'address'='כתובת ב') then raise exception 'Address change missing';end if;
end $$;
reset role;
update public.weig_kashrut_evidence set active_in_directory=false where source='test_monitor_source';
set local role authenticated;
do $$declare r uuid;begin
 r=public.weig_kashrut_check_stored_data((select id from public.weig_kashrut_registry_sources where code='test_monitor_source'));
 if not exists(select 1 from public.weig_kashrut_monitor_runs where id=r and changes->0->>'kind'='disappeared') then raise exception 'Disappearance mislabeled as revocation';end if;
end $$;
reset role;
update public.weig_kashrut_evidence set evidence_type='revocation' where source='test_monitor_source';
set local role authenticated;
do $$declare r uuid;begin
 r=public.weig_kashrut_check_stored_data((select id from public.weig_kashrut_registry_sources where code='test_monitor_source'));
 if not exists(select 1 from public.weig_kashrut_monitor_runs where id=r and changes->0->>'kind'='revoked') then raise exception 'Explicit revocation missing';end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.weig_kashrut_check_stored_data('00000000-0000-0000-0000-000000000001');raise exception 'Anonymous check allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'passed: manager gates, immutable history, baseline, duplicate clicks, before/after address, disappearance vs revocation, private snapshots' as result;
