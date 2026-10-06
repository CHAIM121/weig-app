-- Preserve actual review times when unrelated metadata is edited.
create or replace function private.kashrut_dossier_prepare() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME='weig_kashrut_registry_sources' then
  -- A different source URL invalidates the prior access decision and adapter test.
  if TG_OP='UPDATE' and NEW.url is distinct from OLD.url then
   NEW.access_status='not_checked';NEW.terms_url=null;NEW.access_notes='';
   NEW.adapter_test_status='untested';NEW.adapter_test_notes='';
  elsif TG_OP='UPDATE' and (NEW.stable_key is distinct from OLD.stable_key or NEW.adapter_version is distinct from OLD.adapter_version or NEW.content_kind is distinct from OLD.content_kind) then
   NEW.adapter_test_status='untested';NEW.adapter_test_notes='';
  end if;
  if NEW.access_status='not_checked' then NEW.access_reviewed_at=null;NEW.access_reviewed_by=null;
  elsif TG_OP='INSERT' then NEW.access_reviewed_at=now();NEW.access_reviewed_by=auth.uid();
  elsif (NEW.access_status,NEW.terms_url,NEW.access_notes) is distinct from (OLD.access_status,OLD.terms_url,OLD.access_notes) then NEW.access_reviewed_at=now();NEW.access_reviewed_by=auth.uid();
  else NEW.access_reviewed_at=OLD.access_reviewed_at;NEW.access_reviewed_by=OLD.access_reviewed_by;end if;
  if NEW.adapter_test_status='untested' then NEW.adapter_tested_at=null;
  elsif TG_OP='INSERT' then NEW.adapter_tested_at=now();
  elsif (NEW.adapter_test_status,NEW.adapter_test_notes) is distinct from (OLD.adapter_test_status,OLD.adapter_test_notes) then NEW.adapter_tested_at=now();
  else NEW.adapter_tested_at=OLD.adapter_tested_at;end if;
 else
  if NEW.status='verified' then
   if not exists(select 1 from public.weig_kashrut_agencies where id=NEW.from_agency_id and status='verified') or not exists(select 1 from public.weig_kashrut_agencies where id=NEW.to_agency_id and status='verified') then raise exception 'Both relationship identities must be verified';end if;
   NEW.verified_at=now();
  else NEW.verified_at=null;end if;
 end if;
 return NEW;
end $$;
revoke all on function private.kashrut_dossier_prepare() from public,anon,authenticated;
