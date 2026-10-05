-- Integration checks use a temporary membership for an existing account.
-- Everything, including the temporary grant and test records, is rolled back.
begin;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000001','role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.weig_kashrut_agencies) then raise exception 'Non-manager can read registry';end if;
 begin
 insert into public.weig_kashrut_agencies(code,name_he,kind) values('test_registry_denied','בדיקת גישה','independent');
 raise exception 'Non-manager can insert registry';
 exception when insufficient_privilege then null;end;
 begin
 insert into public.weig_kashrut_managers(user_id) values(auth.uid());
 raise exception 'User can self-provision management';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select id from auth.users order by created_at limit 1),'role','authenticated')::text,true);
insert into public.weig_kashrut_managers(user_id) select id from auth.users order by created_at limit 1 on conflict(user_id) do nothing;
set local role authenticated;
do $$declare rec uuid; changed integer;begin
 if (select count(*) from public.weig_kashrut_agencies)<22 then raise exception 'Manager cannot read seeded registry';end if;
 insert into public.weig_kashrut_agencies(code,name_he,kind) values('test_registry_allowed','בדיקת ניהול','independent') returning id into rec;
 if not exists(select 1 from public.weig_kashrut_review_tasks where agency_id=rec and status='open') then raise exception 'Candidate did not enter review queue';end if;
 update public.weig_kashrut_agencies set name_he='בדיקת ניהול מעודכנת' where id=rec and version=1;
 if not exists(select 1 from public.weig_kashrut_agencies where id=rec and version=2) then raise exception 'Version not incremented';end if;
 update public.weig_kashrut_agencies set name_he='עדכון ישן' where id=rec and version=1;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Stale update was allowed';end if;
 if (select count(*) from public.weig_kashrut_registry_audit where record_id=rec)<>2 then raise exception 'Audit trail missing';end if;
 update public.weig_kashrut_review_tasks set status='resolved',decision='נבדקו הפרטים במסגרת בדיקה זמנית' where agency_id=rec;
 if not exists(select 1 from public.weig_kashrut_review_tasks where agency_id=rec and reviewed_by=auth.uid() and reviewed_at is not null) then raise exception 'Review decision not attributed';end if;
 begin
 delete from public.weig_kashrut_agencies where id=rec;
 raise exception 'Hard deletion allowed';
 exception when insufficient_privilege then null;end;
 begin
 insert into public.weig_kashrut_registry_audit(table_name,record_id,operation) values('fake',rec,'INSERT');
 raise exception 'Client can forge audit history';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.weig_kashrut_agencies;raise exception 'Anonymous registry access allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'passed: membership, RLS, write denial, manager edits, audit, review attribution, version conflicts, anonymous denial' as result;
