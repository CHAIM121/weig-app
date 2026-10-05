-- Access membership is provisioned by the project owner, never by the public app.
create table public.weig_kashrut_managers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.weig_kashrut_managers enable row level security;
revoke all on public.weig_kashrut_managers from anon,authenticated;
grant select on public.weig_kashrut_managers to authenticated;
grant all on public.weig_kashrut_managers to service_role;
create policy own_manager_membership on public.weig_kashrut_managers for select to authenticated using(user_id=(select auth.uid()));

create table public.weig_kashrut_agencies (
 id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[a-z0-9_]{2,80}$'),
 name_he text not null check(length(name_he) between 2 and 160),name_en text not null default '',
 kind text not null check(kind in ('national_authority','local_authority','independent','international','community','recommender')),
 aliases text[] not null default '{}',countries text[] not null default '{}',
 official_url text check(official_url ~ '^https://[^[:space:]]+$'),
 status text not null default 'candidate' check(status in ('candidate','verified','needs_review','inactive')),
 verified_at timestamptz,notes text not null default '',version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(status<>'verified' or (official_url is not null and verified_at is not null))
);
create table public.weig_kashrut_classifications (
 id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[a-z0-9_]{2,80}$'),
 name_he text not null check(length(name_he) between 2 and 160),name_en text not null default '',
 category text not null check(category in ('level','food','equipment','milk','meat','baking','cooking','passover','produce','scope','other')),
 aliases text[] not null default '{}',description text not null default '',
 active boolean not null default true,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.weig_kashrut_registry_sources (
 id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[a-z0-9_]{2,80}$'),
 name_he text not null check(length(name_he) between 2 and 160),
 agency_id uuid not null references public.weig_kashrut_agencies(id),
 publisher text not null default '',url text not null check(url ~ '^https://[^[:space:]]+$'),
 format text not null check(format in ('api','html','pdf','dataset','certificate','alerts')),
 status text not null default 'candidate' check(status in ('candidate','verified','needs_review','inactive')),
 connection_state text not null default 'planned' check(connection_state in ('planned','manual_import','testing','active','blocked','paused')),
 coverage text not null default '',completeness text not null default 'unknown' check(completeness in ('full','partial','unknown')),
 verified_at timestamptz,notes text not null default '',version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(status<>'verified' or verified_at is not null)
);
create index weig_kashrut_registry_sources_agency_idx on public.weig_kashrut_registry_sources(agency_id);
create table public.weig_kashrut_review_tasks (
 id uuid primary key default gen_random_uuid(),
 subject_type text not null check(subject_type in ('agency','source','classification')),
 agency_id uuid references public.weig_kashrut_agencies(id),
 source_id uuid references public.weig_kashrut_registry_sources(id),
 classification_id uuid references public.weig_kashrut_classifications(id),
 title text not null check(length(title) between 2 and 200),reason text not null default '',
 status text not null default 'open' check(status in ('open','in_review','resolved','rejected')),
 decision text not null default '',reviewed_by uuid references auth.users(id),reviewed_at timestamptz,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((subject_type='agency' and agency_id is not null and source_id is null and classification_id is null)
 or (subject_type='source' and source_id is not null and agency_id is null and classification_id is null)
 or (subject_type='classification' and classification_id is not null and agency_id is null and source_id is null)),
 check(status not in ('resolved','rejected') or (length(trim(decision))>=3 and reviewed_at is not null and reviewed_by is not null))
);
create index weig_kashrut_review_agency_idx on public.weig_kashrut_review_tasks(agency_id);
create index weig_kashrut_review_source_idx on public.weig_kashrut_review_tasks(source_id);
create index weig_kashrut_review_classification_idx on public.weig_kashrut_review_tasks(classification_id);
create index weig_kashrut_review_reviewer_idx on public.weig_kashrut_review_tasks(reviewed_by);
create table public.weig_kashrut_registry_audit (
 id bigint generated always as identity primary key,table_name text not null,record_id uuid not null,
 actor_id uuid,operation text not null,previous jsonb,current jsonb,created_at timestamptz not null default now()
);
create index weig_kashrut_registry_audit_record_idx on public.weig_kashrut_registry_audit(table_name,record_id,created_at desc);

-- The management registry is private. Both HTTP authorization and database RLS
-- consult a membership that API users cannot grant to themselves.
do $policies$ declare tab text; begin
 foreach tab in array array['weig_kashrut_agencies','weig_kashrut_classifications','weig_kashrut_registry_sources','weig_kashrut_review_tasks','weig_kashrut_registry_audit'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from anon,authenticated',tab);
 execute format('grant select on public.%I to authenticated',tab);
 execute format('grant all on public.%I to service_role',tab);
 execute format('create policy manager_read on public.%I for select to authenticated using(exists(select 1 from public.weig_kashrut_managers m where m.user_id=(select auth.uid())))',tab);
 if tab<>'weig_kashrut_registry_audit' then
 execute format('grant insert,update on public.%I to authenticated',tab);
 execute format('create policy manager_insert on public.%I for insert to authenticated with check(exists(select 1 from public.weig_kashrut_managers m where m.user_id=(select auth.uid())))',tab);
 execute format('create policy manager_update on public.%I for update to authenticated using(exists(select 1 from public.weig_kashrut_managers m where m.user_id=(select auth.uid()))) with check(exists(select 1 from public.weig_kashrut_managers m where m.user_id=(select auth.uid())))',tab);
 end if;
 end loop;
end $policies$;

create function private.kashrut_registry_prepare() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then NEW.version=OLD.version+1;NEW.created_at=OLD.created_at;end if;
 NEW.updated_at=now();
 if TG_TABLE_NAME in ('weig_kashrut_agencies','weig_kashrut_registry_sources') then
  if NEW.status='verified' then
   if TG_OP='INSERT' then NEW.verified_at=now();
   elsif OLD.status is distinct from NEW.status or (to_jsonb(OLD)->>'official_url') is distinct from (to_jsonb(NEW)->>'official_url') or (to_jsonb(OLD)->>'url') is distinct from (to_jsonb(NEW)->>'url') then NEW.verified_at=now();end if;
  else NEW.verified_at=null;end if;
 end if;
 if TG_TABLE_NAME='weig_kashrut_review_tasks' then
  if NEW.status in ('resolved','rejected') then NEW.reviewed_by=auth.uid();NEW.reviewed_at=now();
  else NEW.reviewed_by=null;NEW.reviewed_at=null;end if;
 end if;
 return NEW;
end $$;
revoke all on function private.kashrut_registry_prepare() from public,anon,authenticated;
create function private.kashrut_registry_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.weig_kashrut_registry_audit(table_name,record_id,actor_id,operation,previous,current)
 values(TG_TABLE_NAME,NEW.id,auth.uid(),TG_OP,case when TG_OP='UPDATE' then to_jsonb(OLD) else null end,to_jsonb(NEW));
 return NEW;
end $$;
revoke all on function private.kashrut_registry_audit() from public,anon,authenticated;
do $triggers$ declare tab text; begin
 foreach tab in array array['weig_kashrut_agencies','weig_kashrut_classifications','weig_kashrut_registry_sources','weig_kashrut_review_tasks'] loop
 execute format('create trigger prepare_record before insert or update on public.%I for each row execute function private.kashrut_registry_prepare()',tab);
 execute format('create trigger audit_record after insert or update on public.%I for each row execute function private.kashrut_registry_audit()',tab);
 end loop;
end $triggers$;
create function private.kashrut_registry_enqueue() returns trigger language plpgsql set search_path='' as $$
begin
 if NEW.status in ('candidate','needs_review') and not exists(select 1 from public.weig_kashrut_review_tasks r where r.status in ('open','in_review') and (r.agency_id=NEW.id or r.source_id=NEW.id)) then
 insert into public.weig_kashrut_review_tasks(subject_type,agency_id,source_id,title,reason)
 values(case when TG_TABLE_NAME='weig_kashrut_agencies' then 'agency' else 'source' end,
 case when TG_TABLE_NAME='weig_kashrut_agencies' then NEW.id else null end,
 case when TG_TABLE_NAME='weig_kashrut_registry_sources' then NEW.id else null end,
 'אימות: '||NEW.name_he,'נדרש לבדוק את זהות הגוף או רשמיות המקור ואת הראיות שפורסמו.');
 end if;
 return NEW;
end $$;
revoke all on function private.kashrut_registry_enqueue() from public,anon,authenticated;
create trigger enqueue_review after insert or update on public.weig_kashrut_agencies for each row execute function private.kashrut_registry_enqueue();
create trigger enqueue_review after insert or update on public.weig_kashrut_registry_sources for each row execute function private.kashrut_registry_enqueue();

-- Registry seed: identities and public sources, not new regional business collection.
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('beit_shemesh_council','רבנות בית שמש','Beit Shemesh Rabbinate','local_authority',array['IL']::text[],'https://www.rabanutbs.co.il/53/','verified','זהות נבדקה לפי אתר רשמי; תחומי פעילות וערוצי איסוף נוספים דורשים בדיקה.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('petah_tikva_council','רבנות פתח תקווה','Petah Tikva Rabbinate','local_authority',array['IL']::text[],'https://mpt.org.il/directory-kashrut/','verified','זהות נבדקה לפי אתר רשמי; תחומי פעילות וערוצי איסוף נוספים דורשים בדיקה.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('netanya_council','רבנות נתניה','Netanya Rabbinate','local_authority',array['IL']::text[],'https://mdn.org.il/directory-kashrut/','verified','זהות נבדקה לפי אתר רשמי; תחומי פעילות וערוצי איסוף נוספים דורשים בדיקה.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('yokneam_council','רבנות יקנעם עילית','Yokneam Illit Rabbinate','local_authority',array['IL']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('chief_rabbinate','הרבנות הראשית לישראל','Chief Rabbinate of Israel','national_authority',array['IL']::text[],'https://www.gov.il/he/pages/kashrutey1','verified','זהות נבדקה לפי אתר רשמי; תחומי פעילות וערוצי איסוף נוספים דורשים בדיקה.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('ou','OU','OU Kosher','international',array['US','IL']::text[],'https://oukosher.org/','verified','זהות נבדקה לפי אתר רשמי; תחומי פעילות וערוצי איסוף נוספים דורשים בדיקה.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('ok','OK','OK Kosher','international',array['US']::text[],'https://www.ok.org/','verified','זהות נבדקה לפי אתר רשמי; תחומי פעילות וערוצי איסוף נוספים דורשים בדיקה.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('star_k','STAR-K','STAR-K','international',array['US']::text[],'https://www.star-k.org/','verified','זהות נבדקה לפי אתר רשמי; תחומי פעילות וערוצי איסוף נוספים דורשים בדיקה.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('kof_k','KOF-K','KOF-K','international',array['US']::text[],'https://kof-k.org/','verified','זהות נבדקה לפי אתר רשמי; תחומי פעילות וערוצי איסוף נוספים דורשים בדיקה.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('crc','cRc','Chicago Rabbinical Council','recommender',array['US']::text[],'https://consumer.crckosher.org/','verified','זהות נבדקה לפי אתר רשמי; תחומי פעילות וערוצי איסוף נוספים דורשים בדיקה.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('klbd','KLBD — בית הדין לונדון','London Beth Din','community',array['GB']::text[],'https://kosher.org.uk/','verified','זהות נבדקה לפי אתר רשמי; תחומי פעילות וערוצי איסוף נוספים דורשים בדיקה.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('edah','בד״ץ העדה החרדית','Edah HaCharedith','independent',array['IL']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('landau','כשרות הרב לנדא','Rabbi Landau','independent',array['IL']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('sheerit','שארית ישראל','Sheeris Yisroel','independent',array['IL']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('rubin','בד״ץ מהדרין הרב רובין','Badatz Mehadrin Rabbi Rubin','independent',array['IL']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('beit_yosef','בד״ץ בית יוסף','Badatz Beit Yosef','independent',array['IL']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('yoreh_deah','יורה דעה — הרב מחפוד','Yoreh Deah','independent',array['IL']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('kehilot','קהילות','Kehilot','independent',array['IL']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('mahzikei_hadat','מחזיקי הדת','Machzikei Hadas','independent',array['IL']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('cor','COR','Kashruth Council of Canada','community',array['CA']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('mk','MK','Montreal Kosher','community',array['CA']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_agencies(code,name_he,name_en,kind,countries,official_url,status,notes) values('kosher_australia','Kosher Australia','Kosher Australia','community',array['AU']::text[],null,'candidate','מועמד לאימות פרטני. אין בכך אישור גורף או קביעה הלכתית.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('regular','רגילה','Regular','level','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('mehadrin','מהדרין','Mehadrin','level','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('meat','בשרי','Meat','food','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('dairy','חלבי','Dairy','food','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('pareve','פרווה','Pareve','food','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('dairy_equipment','ציוד חלבי','Dairy equipment','equipment','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('meat_equipment','ציוד בשרי','Meat equipment','equipment','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('chalav_yisrael','חלב ישראל','Chalav Yisrael','milk','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('chalav_stam','חלב סתם','Chalav Stam','milk','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('milk_powder','אבקת חלב נוכרי','Non-Chalav Yisrael milk powder','milk','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('glatt','גלאט','Glatt','meat','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('chalak_beit_yosef','חלק בית יוסף','Chalak Beit Yosef','meat','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('pas_yisrael','פת ישראל','Pas Yisrael','baking','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('yoshon','ישן','Yoshon','baking','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('bishul_yisrael','בישול ישראל','Bishul Yisrael','cooking','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('passover','כשר לפסח','Kosher for Passover','passover','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('kitniyot','קטניות','Kitniyot','passover','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('gebrochts','שרויה','Gebrochts','passover','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('tithes','תרומות ומעשרות','Tithes','produce','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('orlah','ערלה','Orlah','produce','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('shemitah','שמיטה','Shemitah','produce','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('whole_branch','סניף שלם','Whole branch','scope','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('kitchen','מטבח מסוים','Specific kitchen','scope','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('department','מחלקה בלבד','Department only','scope','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('counter','דוכן','Counter','scope','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('product','מוצר','Product','scope','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('event','אירוע מוגדר','Specific event','scope','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('mevushal','יין מבושל','Mevushal wine','other','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('insect_checking','בדיקת חרקים','Insect checking','other','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_classifications(code,name_he,name_en,category,description) values('continuous_supervision','השגחה רציפה','Continuous supervision','other','מאפיין כפי שפורסם במקור; לא ידוע אינו שווה לא. יש לשמור את התחום שעליו הוא חל.');
insert into public.weig_kashrut_registry_sources(code,name_he,agency_id,publisher,url,format,status,connection_state,coverage,notes) select 'beit_shemesh_council','רשימת רבנות בית שמש',id,'המועצה הדתית בית שמש','https://www.rabanutbs.co.il/53/','html','verified','manual_import','בית שמש','מקור ששימש ליבוא ידני קיים; לא הוגדר סורק מתוזמן.' from public.weig_kashrut_agencies where code='beit_shemesh_council';
insert into public.weig_kashrut_registry_sources(code,name_he,agency_id,publisher,url,format,status,connection_state,coverage,notes) select 'petah_tikva_council','רשימת רבנות פתח תקווה',id,'המועצה הדתית פתח תקווה','https://mpt.org.il/directory-kashrut/','html','verified','manual_import','פתח תקווה','מקור ששימש ליבוא ידני קיים; לא הוגדר סורק מתוזמן.' from public.weig_kashrut_agencies where code='petah_tikva_council';
insert into public.weig_kashrut_registry_sources(code,name_he,agency_id,publisher,url,format,status,connection_state,coverage,notes) select 'netanya_council','רשימת רבנות נתניה',id,'המועצה הדתית נתניה','https://mdn.org.il/directory-kashrut/','html','verified','manual_import','נתניה','מקור ששימש ליבוא ידני קיים; לא הוגדר סורק מתוזמן.' from public.weig_kashrut_agencies where code='netanya_council';
insert into public.weig_kashrut_registry_sources(code,name_he,agency_id,publisher,url,format,status,connection_state,coverage,notes) select 'yokneam_government','נתוני רבנות יקנעם במאגר הממשלתי',id,'המשרד לשירותי דת / data.gov.il','https://data.gov.il/he/datasets/religion-office/kosherbusiness/c54032cb-5306-4be9-a20d-a0be0ba49cc1','dataset','verified','manual_import','יקנעם עילית','מקור ששימש ליבוא ידני קיים; לא הוגדר סורק מתוזמן.' from public.weig_kashrut_agencies where code='yokneam_council';
insert into public.weig_kashrut_registry_sources(code,name_he,agency_id,publisher,url,format,status,connection_state,coverage,notes) select 'ou_kosher','מסעדות OU',id,'OU','https://oukosher.org/restaurants/','api','verified','manual_import','מספר מדינות; לפי הרשימה הרשמית','מקור ששימש ליבוא ידני קיים; לא הוגדר סורק מתוזמן.' from public.weig_kashrut_agencies where code='ou';
