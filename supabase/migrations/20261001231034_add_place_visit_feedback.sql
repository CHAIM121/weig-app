-- A navigation is only a possible visit. WEIG asks later and records a rating
-- only after the signed-in user confirms that they actually arrived.
create table public.place_visit_prompts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id text not null check (char_length(place_id) between 1 and 255),
  place_name text not null check (char_length(trim(place_name)) between 1 and 200),
  place_area text check (place_area is null or char_length(place_area) <= 300),
  maps_url text check (maps_url is null or char_length(maps_url) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'visited', 'not_visited', 'dismissed', 'rated')),
  navigated_at timestamptz not null default now(),
  prompt_after timestamptz not null default (now() + interval '2 hours'),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table public.place_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id text not null check (char_length(place_id) between 1 and 255),
  place_name text not null check (char_length(trim(place_name)) between 1 and 200),
  score smallint not null check (score between 1 and 4),
  review text check (
    review is null
    or char_length(trim(review)) between 1 and 280
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_id)
);

-- Public feedback deliberately contains no user id. It is a read-only copy
-- maintained by a trigger so public social proof never exposes account data.
create table public.place_feedback_public (
  feedback_id uuid primary key references public.place_feedback(id) on delete cascade,
  place_id text not null,
  place_name text not null,
  score smallint not null check (score between 1 and 4),
  review text,
  display_name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index place_visit_prompts_due_idx
  on public.place_visit_prompts (user_id, prompt_after)
  where status = 'pending';
create index place_feedback_public_place_idx
  on public.place_feedback_public (place_id, created_at desc);

create trigger place_visit_prompts_updated
  before update on public.place_visit_prompts
  for each row execute function public.set_updated_at();
create trigger place_feedback_updated
  before update on public.place_feedback
  for each row execute function public.set_updated_at();

create function private.sync_place_feedback_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.place_feedback_public (
    feedback_id,
    place_id,
    place_name,
    score,
    review,
    display_name,
    created_at,
    updated_at
  )
  select
    new.id,
    new.place_id,
    new.place_name,
    new.score,
    nullif(trim(new.review), ''),
    coalesce(nullif(trim(profiles.display_name), ''), 'WEIG'),
    new.created_at,
    new.updated_at
  from public.profiles as profiles
  where profiles.id = new.user_id
  on conflict (feedback_id) do update set
    place_id = excluded.place_id,
    place_name = excluded.place_name,
    score = excluded.score,
    review = excluded.review,
    display_name = excluded.display_name,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all on function private.sync_place_feedback_public() from public, anon, authenticated;

create trigger sync_place_feedback_public
  after insert or update on public.place_feedback
  for each row execute function private.sync_place_feedback_public();

alter table public.place_visit_prompts enable row level security;
alter table public.place_feedback enable row level security;
alter table public.place_feedback_public enable row level security;

create policy "users read their visit prompts"
on public.place_visit_prompts for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users add their visit prompts"
on public.place_visit_prompts for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users update their visit prompts"
on public.place_visit_prompts for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users delete their visit prompts"
on public.place_visit_prompts for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users read their feedback"
on public.place_feedback for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users add their feedback"
on public.place_feedback for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users update their feedback"
on public.place_feedback for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users delete their feedback"
on public.place_feedback for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "published feedback is readable"
on public.place_feedback_public for select to anon, authenticated
using (true);

revoke all on table public.place_visit_prompts from anon;
revoke all on table public.place_feedback from anon;
revoke all on table public.place_feedback_public from anon, authenticated;

grant select, insert, update, delete on table public.place_visit_prompts to authenticated;
grant select, insert, update, delete on table public.place_feedback to authenticated;
grant select on table public.place_feedback_public to anon, authenticated;
