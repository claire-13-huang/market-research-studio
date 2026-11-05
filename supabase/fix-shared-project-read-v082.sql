-- Market Research Studio V0.8.2
-- Repair shared-project visibility for approved recipients.
-- Non-destructive: changes only the SELECT authorization rule; no business rows are modified.
-- Run after team-access-v06.sql and member-directory-v07.sql.

begin;

create schema if not exists private;

-- Evaluate project access with the authenticated request identity, outside nested
-- table RLS evaluation. This avoids policies recursively filtering the share row
-- while mrs_projects is itself being selected.
create or replace function private.mrs_can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.mrs_team_admins a
        where a.user_id = (select auth.uid())
      )
      or (
        exists (
          select 1
          from public.mrs_team_members m
          where m.user_id = (select auth.uid())
            and m.status = 'active'
        )
        and (
          exists (
            select 1
            from public.mrs_projects p
            where p.id = p_project_id
              and p.owner_id = (select auth.uid())
          )
          or exists (
            select 1
            from public.mrs_project_shares s
            where s.project_id = p_project_id
              and s.recipient_id = (select auth.uid())
          )
          or exists (
            select 1
            from public.mrs_project_invites i
            where i.project_id = p_project_id
              and i.email = lower((select auth.jwt())->>'email')
          )
        )
      )
    );
$$;

revoke all on function private.mrs_can_view_project(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.mrs_can_view_project(uuid) to authenticated;

drop policy if exists mrs_projects_read on public.mrs_projects;
create policy mrs_projects_read
on public.mrs_projects
for select
to authenticated
using ((select private.mrs_can_view_project(id)));

commit;

-- Verification: should show the mrs_projects_read policy using the private helper.
select policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'mrs_projects'
  and policyname = 'mrs_projects_read';
