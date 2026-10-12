-- Contact information stays in the manager-only agency registry and audit trail.
-- Existing RLS, version conflict protection and verification timestamps apply.
alter table public.weig_kashrut_agencies
 add column phone text not null default '' check(length(phone)<=50),
 add column email text not null default '' check(length(email)<=200),
 add column fax text not null default '' check(length(fax)<=50),
 add column address text not null default '' check(length(address)<=200),
 add column mailing_address text not null default '' check(length(mailing_address)<=200),
 add column office_hours text not null default '' check(length(office_hours)<=200),
 add column contacts jsonb not null default '[]'::jsonb
  check(jsonb_typeof(contacts)='array' and jsonb_array_length(contacts)<=20 and octet_length(contacts::text)<=20000);
comment on column public.weig_kashrut_agencies.contacts is 'Manager-entered contact people: name, role, phone, email. Not business certification evidence.';
