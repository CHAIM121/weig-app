begin;
select set_config('request.jwt.claims',json_build_object('sub',(select id from auth.users order by created_at limit 1),'role','authenticated')::text,true);
insert into public.weig_kashrut_managers(user_id) select id from auth.users order by created_at limit 1 on conflict(user_id) do nothing;
set local role authenticated;
do $$declare rec uuid; original_time timestamptz; begin
 insert into public.weig_kashrut_agencies(code,name_he,kind,official_url,status,notes)
 values('test_agency_contacts','בדיקת אנשי קשר','independent','https://example.org','verified','בדיקה זמנית') returning id,verified_at into rec,original_time;
 update public.weig_kashrut_agencies set phone='02-6550550',email='office@example.org',contacts='[{"name":"מזכירות","role":"משרד","phone":"050-1234567","email":"contact@example.org"},{"name":"מנהל","role":"","phone":"","email":""}]' where id=rec and version=1;
 if not exists(select 1 from public.weig_kashrut_agencies where id=rec and version=2 and verified_at=original_time and jsonb_array_length(contacts)=2 and email='office@example.org') then raise exception 'Contact persistence/version/verification failed';end if;
 if not exists(select 1 from public.weig_kashrut_registry_audit where record_id=rec and operation='UPDATE' and current->>'phone'='02-6550550' and previous->'contacts'='[]'::jsonb) then raise exception 'Contacts not audited';end if;
 update public.weig_kashrut_agencies set contacts='[]' where id=rec and version=2;
 if not exists(select 1 from public.weig_kashrut_agencies where id=rec and contacts='[]'::jsonb) then raise exception 'Contact removal failed';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000001','role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.weig_kashrut_agencies where phone<>'' or contacts<>'[]'::jsonb) then raise exception 'Contact data exposed to non-manager';end if;
end $$;
reset role;
rollback;
select 'passed: contact persistence, removal, audit, version, verification time, manager-only reads' as result;
