-- V0.8.1 Fix: stop recursive RLS when sharing a project.
-- Non-destructive: keeps all projects, members, project_shares and historical records.
-- Must run AFTER member-directory-v07.sql in the correct Supabase project.

begin;

create schema if not exists private;

-- The helper is inside a non-exposed schema and evaluates only the identity
-- Supabase Auth verified for the current request. It never trusts a browser
-- supplied owner_id or admin flag.
create or replace function private.mrs_can_share_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1 from public.mrs_team_admins a
        where a.user_id = (select auth.uid())
      )
      or (
        exists (
          select 1 from public.mrs_projects p
          where p.id = p_project_id and p.owner_id = (select auth.uid())
        )
        and exists (
          select 1 from public.mrs_team_members m
          where m.user_id = (select auth.uid())
            and m.status = 'active'
            and m.can_share = true
        )
      )
    );
$$;

-- Postgres permits specific authenticated callers to execute this one helper.
-- The private schema is not exposed as a REST/RPC API schema.
revoke all on function private.mrs_can_share_project(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.mrs_can_share_project(uuid) to authenticated;

-- The old INSERT rule queried mrs_projects from inside mrs_project_shares.
-- mrs_projects' SELECT rule also queries mrs_project_shares, causing recursion.
drop policy if exists mrs_shares_create on public.mrs_project_shares;
create policy mrs_shares_create
on public.mrs_project_shares
for insert to authenticated
with check (
  granted_by = (select auth.uid())
  and recipient_id <> (select auth.uid())
  and (select private.mrs_can_share_project(project_id))
  and exists (
    select 1 from public.mrs_member_profiles recipient
    where recipient.user_id = recipient_id
      and recipient.status = 'active'
  )
);

-- Keep SELECT/DELETE policies as they were; just fix INSERT recursion.
-- No rows are removed or rewritten.
commit;

-- Diagnostic: returns 1 row and policy expression after successful migration.
select policyname, cmd, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'mrs_project_shares'
  and policyname = 'mrs_shares_create';
