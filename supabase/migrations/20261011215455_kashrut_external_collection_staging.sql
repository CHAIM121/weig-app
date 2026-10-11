-- Manual external collection staging only. No evidence promotion or scheduler.
create table public.weig_kashrut_collection_runs (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.weig_kashrut_registry_sources(id),
 actor_id uuid not null references auth.users(id),
 request_key uuid not null,
 source_version integer not null,
 adapter_version text not null,
 coverage_key text not null check(length(coverage_key) between 1 and 1000),
 baseline_id uuid references public.weig_kashrut_collection_runs(id),
 started_at timestamptz not null default clock_timestamp(),
 lease_until timestamptz not null default clock_timestamp()+interval '5 minutes',
 finished_at timestamptz,
 status text not null default 'running' check(status in ('running','staged','quarantined','failed')),
 record_count integer not null default 0 check(record_count between 0 and 10000),
 source_updated_at timestamptz,
 content_hash text check(content_hash ~ '^[a-f0-9]{64}$'),
 reasons jsonb not null default '[]' check(jsonb_typeof(reasons)='array'),
 changes jsonb not null default '[]' check(jsonb_typeof(changes)='array'),
 change_count integer generated always as (jsonb_array_length(changes)) stored,
 unique(source_id,request_key),
 check((status='running' and finished_at is null) or (status<>'running' and finished_at is not null))
);
create unique index weig_collection_one_running on public.weig_kashrut_collection_runs(source_id) where status='running';
create index weig_collection_source_history on public.weig_kashrut_collection_runs(source_id,started_at desc);
create index weig_collection_actor on public.weig_kashrut_collection_runs(actor_id);
create index weig_collection_baseline on public.weig_kashrut_collection_runs(baseline_id);
alter table public.weig_kashrut_collection_runs enable row level security;
revoke all on public.weig_kashrut_collection_runs from public,anon,authenticated;
grant select on public.weig_kashrut_collection_runs to authenticated;
create policy collection_manager_read on public.weig_kashrut_collection_runs for select to authenticated
 using(exists(select 1 from public.weig_kashrut_managers where user_id=(select auth.uid())) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false));

create table private.weig_kashrut_collection_snapshots (
 run_id uuid primary key references public.weig_kashrut_collection_runs(id),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object')
);
alter table private.weig_kashrut_collection_snapshots enable row level security;
revoke all on private.weig_kashrut_collection_snapshots from public,anon,authenticated;

create function private.kashrut_collection_manager_required() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 or not exists(select 1 from public.weig_kashrut_managers where user_id=auth.uid()) then
  raise exception 'Manager required' using errcode='42501';
 end if;
end $$;
revoke all on function private.kashrut_collection_manager_required() from public,anon,authenticated;

create function private.kashrut_collection_begin(p_source_id uuid,p_source_version integer,p_request_key uuid,p_adapter_version text,p_coverage_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare src public.weig_kashrut_registry_sources; existing public.weig_kashrut_collection_runs; baseline uuid; new_run uuid; prior jsonb;
begin
 perform private.kashrut_collection_manager_required();
 perform pg_advisory_xact_lock(hashtextextended('kashrut_collection:'||p_source_id::text,0));
 select * into src from public.weig_kashrut_registry_sources where id=p_source_id for share;
 if not found then raise exception 'Unknown source' using errcode='22023';end if;
 if src.version<>p_source_version then raise exception 'Source version changed' using errcode='40001';end if;
 if src.status<>'verified' or src.access_status<>'allowed' or src.terms_url is null or length(trim(src.access_notes))<5
 or src.access_reviewed_at is null or src.access_reviewed_by is null
 or src.adapter_test_status<>'passed' or src.adapter_tested_at is null or length(trim(src.adapter_test_notes))<5
 or src.adapter_version<>p_adapter_version or length(trim(src.stable_key))=0
 or src.content_kind<>'establishments' or length(trim(src.coverage))=0 or src.refresh_frequency='unspecified'
 or src.connection_state in ('blocked','paused')
 or not exists(select 1 from public.weig_kashrut_agencies where id=src.agency_id and status='verified') then
  raise exception 'Source not ready for collection' using errcode='22023';
 end if;
 -- Expired retries must return a terminal state rather than 'running' forever.
 update public.weig_kashrut_collection_runs set status='failed',finished_at=clock_timestamp(),reasons='["lease_expired"]'
 where source_id=p_source_id and status='running' and lease_until<=clock_timestamp();
 select * into existing from public.weig_kashrut_collection_runs where source_id=p_source_id and request_key=p_request_key;
 if existing.id is not null then
  if existing.actor_id<>auth.uid() or existing.adapter_version<>p_adapter_version or existing.coverage_key<>p_coverage_key then
   raise exception 'Idempotency key conflict' using errcode='40001';end if;
  return jsonb_build_object('run_id',existing.id,'reused',true,'status',existing.status);
 end if;
 if exists(select 1 from public.weig_kashrut_collection_runs where source_id=p_source_id and status='running') then
  raise exception 'Collection already running' using errcode='55P03';end if;
 select id into baseline from public.weig_kashrut_collection_runs where source_id=p_source_id and coverage_key=p_coverage_key and status='staged' order by started_at desc,id desc limit 1;
 select snapshot into prior from private.weig_kashrut_collection_snapshots where run_id=baseline;
 insert into public.weig_kashrut_collection_runs(source_id,actor_id,request_key,source_version,adapter_version,coverage_key,baseline_id)
 values(p_source_id,auth.uid(),p_request_key,p_source_version,p_adapter_version,p_coverage_key,baseline) returning id into new_run;
 return jsonb_build_object('run_id',new_run,'reused',false,'baseline',prior);
end $$;
revoke all on function private.kashrut_collection_begin(uuid,integer,uuid,text,text) from public,anon,authenticated;
grant execute on function private.kashrut_collection_begin(uuid,integer,uuid,text,text) to authenticated;
create function public.weig_kashrut_collection_begin(p_source_id uuid,p_source_version integer,p_request_key uuid,p_adapter_version text,p_coverage_key text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.kashrut_collection_begin(p_source_id,p_source_version,p_request_key,p_adapter_version,p_coverage_key);
$$;
revoke all on function public.weig_kashrut_collection_begin(uuid,integer,uuid,text,text) from public,anon,authenticated;
grant execute on function public.weig_kashrut_collection_begin(uuid,integer,uuid,text,text) to authenticated;

-- Staging input is a manager-attributed proposal, never proof of authentic source data.
-- Public evidence is not writable here, even through direct RPC invocation by a manager.
create function private.kashrut_collection_finish(p_run_id uuid,p_snapshot jsonb,p_changes jsonb,p_reasons jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare run public.weig_kashrut_collection_runs; src public.weig_kashrut_registry_sources; final_status text; count_records integer=0; reason jsonb=p_reasons; updated_at_source timestamptz;
begin
 perform private.kashrut_collection_manager_required();
 select * into run from public.weig_kashrut_collection_runs where id=p_run_id for update;
 if not found or run.actor_id<>auth.uid() then raise exception 'Unknown actor run' using errcode='42501';end if;
 if run.status<>'running' then raise exception 'Run already finished' using errcode='40001';end if;
 if run.lease_until<=clock_timestamp() then raise exception 'Run lease expired' using errcode='40001';end if;
 select * into src from public.weig_kashrut_registry_sources where id=run.source_id for share;
 if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_typeof(p_reasons) is distinct from 'array'
 or length(p_changes::text)>2000000 or length(p_reasons::text)>10000 then raise exception 'Invalid proposal' using errcode='22023';end if;
 if src.version<>run.source_version then reason=reason||'["source_version_changed"]'::jsonb;end if;
 if p_snapshot is not null then
  if jsonb_typeof(p_snapshot) is distinct from 'object' or length(p_snapshot::text)>2000000
  or p_snapshot->>'sourceCode' is distinct from src.code or p_snapshot->>'adapterVersion' is distinct from run.adapter_version
  or p_snapshot->>'coverageKey' is distinct from run.coverage_key or p_snapshot->>'outcome' is distinct from 'success'
  or jsonb_typeof(p_snapshot->'records') is distinct from 'array' or coalesce(p_snapshot->>'contentHash','')!~'^[a-f0-9]{64}$' then
   raise exception 'Invalid staging snapshot' using errcode='22023';end if;
  count_records=jsonb_array_length(p_snapshot->'records');
  if count_records<1 or count_records>10000 then raise exception 'Invalid record count' using errcode='22023';end if;
  select max((item->>'sourceUpdatedAt')::timestamptz) into updated_at_source from jsonb_array_elements(p_snapshot->'records') item;
 end if;
 final_status=case when p_snapshot is null then 'failed' when jsonb_array_length(reason)>0 then 'quarantined' else 'staged' end;
 update public.weig_kashrut_collection_runs set status=final_status,finished_at=clock_timestamp(),record_count=count_records,
 source_updated_at=updated_at_source,content_hash=p_snapshot->>'contentHash',reasons=reason,
 changes=case when final_status='staged' then p_changes else '[]'::jsonb end where id=p_run_id;
 if p_snapshot is not null then insert into private.weig_kashrut_collection_snapshots values(p_run_id,p_snapshot);end if;
 if (jsonb_array_length(p_changes)>0 or jsonb_array_length(reason)>0 or run.baseline_id is null)
 and not exists(select 1 from public.weig_kashrut_review_tasks where source_id=run.source_id and status in ('open','in_review')) then
  insert into public.weig_kashrut_review_tasks(subject_type,source_id,title,reason)
  values('source',run.source_id,'בדיקת איסוף חיצוני: '||left(src.name_he,170),'נשמרה ריצת איסוף לבדיקת מנהל. נתוני הכשרות הציבוריים לא עודכנו. יש לבדוק מקור, תוקף, תחומי השגחה, שינויים וחוסרים בהיסטוריית האיסוף.');
 end if;
 return final_status;
end $$;
revoke all on function private.kashrut_collection_finish(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.kashrut_collection_finish(uuid,jsonb,jsonb,jsonb) to authenticated;
create function public.weig_kashrut_collection_finish(p_run_id uuid,p_snapshot jsonb,p_changes jsonb,p_reasons jsonb)
returns text language sql security invoker set search_path='' as $$
 select private.kashrut_collection_finish(p_run_id,p_snapshot,p_changes,p_reasons);
$$;
revoke all on function public.weig_kashrut_collection_finish(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.weig_kashrut_collection_finish(uuid,jsonb,jsonb,jsonb) to authenticated;
