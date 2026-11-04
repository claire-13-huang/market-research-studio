-- Market Research Studio: personal projects, owner edits, invited colleagues view.
-- Run once in Supabase SQL Editor. No service-role key is used in the browser.
create extension if not exists pgcrypto;

create table if not exists public.mrs_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  local_project_id text not null,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, local_project_id)
);

create table if not exists public.mrs_project_invites (
  project_id uuid not null references public.mrs_projects(id) on delete cascade,
  email text not null,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, email),
  constraint valid_invitee_email check (char_length(email) between 5 and 320 and email = lower(email))
);

alter table public.mrs_projects enable row level security;
alter table public.mrs_project_invites enable row level security;
revoke all on public.mrs_projects, public.mrs_project_invites from anon;
grant select,insert,update,delete on public.mrs_projects, public.mrs_project_invites to authenticated;

drop policy if exists mrs_projects_read on public.mrs_projects;
create policy mrs_projects_read on public.mrs_projects for select to authenticated
using (
 owner_id = (select auth.uid())
 or exists (
  select 1 from public.mrs_project_invites inv
  where inv.project_id = id and inv.email = lower((select auth.jwt()) ->> 'email')
 )
);

drop policy if exists mrs_projects_create on public.mrs_projects;
create policy mrs_projects_create on public.mrs_projects for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists mrs_projects_owner_edit on public.mrs_projects;
create policy mrs_projects_owner_edit on public.mrs_projects for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists mrs_projects_owner_delete on public.mrs_projects;
create policy mrs_projects_owner_delete on public.mrs_projects for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists mrs_invites_read on public.mrs_project_invites;
create policy mrs_invites_read on public.mrs_project_invites for select to authenticated
using (
 added_by = (select auth.uid())
 or email = lower((select auth.jwt()) ->> 'email')
);

drop policy if exists mrs_invites_owner_create on public.mrs_project_invites;
create policy mrs_invites_owner_create on public.mrs_project_invites for insert to authenticated
with check (
 added_by = (select auth.uid()) and
 exists (
  select 1 from public.mrs_projects p
  where p.id = project_id and p.owner_id = (select auth.uid())
 )
);

drop policy if exists mrs_invites_owner_edit on public.mrs_project_invites;
create policy mrs_invites_owner_edit on public.mrs_project_invites for update to authenticated
using (
 exists (select 1 from public.mrs_projects p
 where p.id = project_id and p.owner_id = (select auth.uid()))
)
with check (
 added_by = (select auth.uid()) and
 exists (select 1 from public.mrs_projects p
 where p.id = project_id and p.owner_id = (select auth.uid()))
);

drop policy if exists mrs_invites_owner_delete on public.mrs_project_invites;
create policy mrs_invites_owner_delete on public.mrs_project_invites for delete to authenticated
using (
 exists (select 1 from public.mrs_projects p
 where p.id = project_id and p.owner_id = (select auth.uid()))
);

create index if not exists mrs_projects_owner_idx on public.mrs_projects(owner_id, updated_at desc);
create index if not exists mrs_invites_email_idx on public.mrs_project_invites(email);
