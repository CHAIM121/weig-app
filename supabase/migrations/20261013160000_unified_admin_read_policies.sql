-- Keep the existing WEIG manager allowlist as the authorization source.
-- Administrative reads must never widen anonymous access or permit edits to official evidence.
create policy "unified_admin_read_profiles"
on public.profiles for select to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1 from public.weig_kashrut_managers m
    where m.user_id = (select auth.uid())
  )
);
create policy "unified_admin_read_kashrut_evidence"
on public.weig_kashrut_evidence for select to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1 from public.weig_kashrut_managers m
    where m.user_id = (select auth.uid())
  )
);
