-- Organizational relationships are evidence-scoped, never inferred from names.
alter table public.weig_kashrut_agencies add column base_country text check(base_country ~ '^[A-Z]{2}$');
alter table public.weig_kashrut_registry_sources
 add column owner_agency_id uuid references public.weig_kashrut_agencies(id),
 add column content_kind text not null default 'unspecified' check(content_kind in ('unspecified','establishments','products','certificates','alerts','agency_directory')),
 add column access_status text not null default 'not_checked' check(access_status in ('not_checked','allowed','permission_required','prohibited')),
 add column terms_url text check(terms_url ~ '^https://[^[:space:]]+$'),
 add column access_notes text not null default '',
 add column access_reviewed_at timestamptz,
 add column access_reviewed_by uuid references auth.users(id),
 add column stable_key text not null default '',
 add column refresh_frequency text not null default 'unspecified' check(refresh_frequency in ('unspecified','manual','daily','weekly')),
 add column adapter_version text not null default '',
 add column adapter_test_status text not null default 'untested' check(adapter_test_status in ('untested','passed','failed')),
 add column adapter_test_notes text not null default '',
 add column adapter_tested_at timestamptz,
 add constraint source_access_evidence check(access_status<>'allowed' or (terms_url is not null and length(trim(access_notes))>=5 and access_reviewed_at is not null and access_reviewed_by is not null)),
 add constraint source_adapter_evidence check(adapter_test_status<>'passed' or (length(trim(adapter_version))>0 and length(trim(adapter_test_notes))>=5 and adapter_tested_at is not null));
create index weig_source_owner_idx on public.weig_kashrut_registry_sources(owner_agency_id);
create index weig_source_access_reviewer_idx on public.weig_kashrut_registry_sources(access_reviewed_by);

create table public.weig_kashrut_agency_relationships (
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 2 and 200),
 from_agency_id uuid not null references public.weig_kashrut_agencies(id),
 to_agency_id uuid not null references public.weig_kashrut_agencies(id),
 relationship_type text not null check(relationship_type in ('parent_of','branch_of','brand_of','renamed_to','recognizes','recommends')),
 scope text not null check(length(trim(scope)) between 1 and 4000),
 evidence_url text check(evidence_url ~ '^https://[^[:space:]]+$'),
 valid_from date,valid_until date,
 status text not null default 'candidate' check(status in ('candidate','verified','needs_review','inactive')),
 notes text not null default '',verified_at timestamptz,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(from_agency_id<>to_agency_id),check(valid_until is null or valid_from is null or valid_until>=valid_from),
 check(status<>'verified' or (evidence_url is not null and length(trim(notes))>=5 and verified_at is not null))
);
create index weig_relationship_from_idx on public.weig_kashrut_agency_relationships(from_agency_id);
create index weig_relationship_to_idx on public.weig_kashrut_agency_relationships(to_agency_id);
alter table public.weig_kashrut_agency_relationships enable row level security;
revoke all on public.weig_kashrut_agency_relationships from anon,authenticated;
grant select,insert,update on public.weig_kashrut_agency_relationships to authenticated;
grant all on public.weig_kashrut_agency_relationships to service_role;
create policy manager_read on public.weig_kashrut_agency_relationships for select to authenticated using(exists(select 1 from public.weig_kashrut_managers where user_id=(select auth.uid())));
create policy manager_insert on public.weig_kashrut_agency_relationships for insert to authenticated with check(exists(select 1 from public.weig_kashrut_managers where user_id=(select auth.uid())));
create policy manager_update on public.weig_kashrut_agency_relationships for update to authenticated using(exists(select 1 from public.weig_kashrut_managers where user_id=(select auth.uid()))) with check(exists(select 1 from public.weig_kashrut_managers where user_id=(select auth.uid())));
alter table public.weig_kashrut_review_tasks
 add column relationship_id uuid references public.weig_kashrut_agency_relationships(id),
 drop constraint weig_kashrut_review_tasks_subject_type_check,
 drop constraint weig_kashrut_review_tasks_check,
 add constraint review_subject_type check(subject_type in ('agency','source','classification','relationship')),
 add constraint review_exact_subject check(
 (subject_type='agency' and agency_id is not null and source_id is null and classification_id is null and relationship_id is null) or
 (subject_type='source' and source_id is not null and agency_id is null and classification_id is null and relationship_id is null) or
 (subject_type='classification' and classification_id is not null and agency_id is null and source_id is null and relationship_id is null) or
 (subject_type='relationship' and relationship_id is not null and agency_id is null and source_id is null and classification_id is null));
create index weig_review_relationship_idx on public.weig_kashrut_review_tasks(relationship_id);

create function private.kashrut_dossier_prepare() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME='weig_kashrut_registry_sources' then
  -- A different source URL invalidates the prior access decision and adapter test.
  if TG_OP='UPDATE' and NEW.url is distinct from OLD.url then
   NEW.access_status='not_checked';NEW.terms_url=null;NEW.access_notes='';
   NEW.adapter_test_status='untested';NEW.adapter_test_notes='';
  elsif TG_OP='UPDATE' and (NEW.stable_key is distinct from OLD.stable_key or NEW.adapter_version is distinct from OLD.adapter_version or NEW.content_kind is distinct from OLD.content_kind) then
   NEW.adapter_test_status='untested';NEW.adapter_test_notes='';
  end if;
  if NEW.access_status<>'not_checked' then NEW.access_reviewed_at=now();NEW.access_reviewed_by=auth.uid();
  else NEW.access_reviewed_at=null;NEW.access_reviewed_by=null;end if;
  if NEW.adapter_test_status<>'untested' then NEW.adapter_tested_at=now();else NEW.adapter_tested_at=null;end if;
 else
  if NEW.status='verified' then
   if not exists(select 1 from public.weig_kashrut_agencies where id=NEW.from_agency_id and status='verified') or not exists(select 1 from public.weig_kashrut_agencies where id=NEW.to_agency_id and status='verified') then raise exception 'Both relationship identities must be verified';end if;
   NEW.verified_at=now();
  else NEW.verified_at=null;end if;
 end if;
 return NEW;
end $$;
revoke all on function private.kashrut_dossier_prepare() from public,anon,authenticated;
create trigger dossier_prepare before insert or update on public.weig_kashrut_registry_sources for each row execute function private.kashrut_dossier_prepare();
create trigger dossier_prepare before insert or update on public.weig_kashrut_agency_relationships for each row execute function private.kashrut_dossier_prepare();
create trigger prepare_record before insert or update on public.weig_kashrut_agency_relationships for each row execute function private.kashrut_registry_prepare();
create trigger audit_record after insert or update on public.weig_kashrut_agency_relationships for each row execute function private.kashrut_registry_audit();
create function private.kashrut_relationship_enqueue() returns trigger language plpgsql set search_path='' as $$
begin
 if NEW.status in ('candidate','needs_review') and not exists(select 1 from public.weig_kashrut_review_tasks where relationship_id=NEW.id and status in ('open','in_review')) then
  insert into public.weig_kashrut_review_tasks(subject_type,relationship_id,title,reason) values('relationship',NEW.id,'אימות: '||left(NEW.title,190),'יש לאמת את שני הגופים, את פרסום הקשר ואת תחומו ותוקפו.');
 end if;
 return NEW;
end $$;
revoke all on function private.kashrut_relationship_enqueue() from public,anon,authenticated;
create trigger enqueue_review after insert or update on public.weig_kashrut_agency_relationships for each row execute function private.kashrut_relationship_enqueue();
