-- Qualify the snapshot column independently of the local run identifier.
create or replace function private.kashrut_check_stored_data(p_source_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 src public.weig_kashrut_registry_sources;
 previous_run public.weig_kashrut_monitor_runs;
 current_records jsonb; old_records jsonb; changes jsonb='[]';
 total integer; active integer; stale integer; expired integer;
 last_fetch timestamptz; run_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.weig_kashrut_managers where user_id=auth.uid())
 or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Manager required' using errcode='42501';
 end if;
 select * into src from public.weig_kashrut_registry_sources where id=p_source_id;
 if not found then raise exception 'Unknown source' using errcode='22023';end if;
 -- One comparison per source at a time, with a consistent single-statement snapshot.
 perform pg_advisory_xact_lock(hashtextextended('kashrut_monitor:'||p_source_id::text,0));
 select coalesce(jsonb_object_agg(e.source_key,to_jsonb(e)),'{}'),count(*),
 count(*) filter(where e.active_in_directory),
 count(*) filter(where e.active_in_directory and e.evidence_type<>'revocation'
  and (case when e.evidence_type='certificate' then e.verified_at else e.fetched_at end
   is null or case when e.evidence_type='certificate' then e.verified_at else e.fetched_at end <now()-interval '7 days')),
 count(*) filter(where e.active_in_directory and e.evidence_type<>'revocation' and e.valid_until<(now() at time zone 'Asia/Jerusalem')::date),
 max(e.fetched_at)
 into current_records,total,active,stale,expired,last_fetch
 from public.weig_kashrut_evidence e where e.source=src.code;
 select * into previous_run from public.weig_kashrut_monitor_runs
 where source_id=p_source_id order by checked_at desc,id desc limit 1;
 if previous_run.id is not null then
  select snap.records into old_records from private.weig_kashrut_monitor_snapshots snap where snap.run_id=previous_run.id;
  if old_records is null then raise exception 'Previous snapshot missing';end if;
  -- A repeated click within a minute reuses the same result if nothing changed.
  if old_records=current_records and previous_run.checked_at>now()-interval '1 minute' then return previous_run.id;end if;
  select coalesce(jsonb_agg(jsonb_build_object('source_key',key,'kind',kind,'before',before_value,'after',after_value) order by key),'[]') into changes
  from (
   select coalesce(a.key,b.key) as key,b.value as before_value,a.value as after_value,
   case when a.key is null then 'missing_record'
    when b.key is null then 'added'
    when a.value->>'evidence_type'='revocation' and b.value->>'evidence_type'<>'revocation' then 'revoked'
    when a.value->>'active_in_directory'='false' and b.value->>'active_in_directory'='true' then 'disappeared'
    when a.value->>'active_in_directory'='true' and b.value->>'active_in_directory'='false' then 'reappeared'
    when (a.value->>'address',a.value->>'city',a.value->>'country') is distinct from (b.value->>'address',b.value->>'city',b.value->>'country') then 'address_changed'
    else 'updated' end as kind
   from jsonb_each(current_records) a full join jsonb_each(old_records) b on a.key=b.key
   where (a.value-array['fetched_at','verified_at']) is distinct from (b.value-array['fetched_at','verified_at'])
  ) diff;
 end if;
 insert into public.weig_kashrut_monitor_runs(source_id,actor_id,baseline,total_count,active_count,stale_count,expired_count,last_source_fetch,changes)
 values(p_source_id,auth.uid(),previous_run.id is null,total,active,stale,expired,last_fetch,changes) returning id into run_id;
 insert into private.weig_kashrut_monitor_snapshots values(run_id,current_records);
 if exists(select 1 from jsonb_array_elements(changes) c where c->>'kind' in ('missing_record','revoked','disappeared','address_changed'))
 and not exists(select 1 from public.weig_kashrut_review_tasks where source_id=p_source_id and status in ('open','in_review')) then
  insert into public.weig_kashrut_review_tasks(subject_type,source_id,title,reason)
  values('source',p_source_id,'שינוי בנתוני המקור: '||left(src.name_he,170),'זוהו שינויים בבדיקת הנתונים השמורים. יש לעיין בהיסטוריית הבדיקות. היעלמות מרשימה אינה ביטול כשרות, ושינוי כתובת מחייב בדיקת שיוך.');
 end if;
 return run_id;
end $$;
