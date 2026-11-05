-- Market Research Studio V0.6 -- additive team permissions, non-destructive.
-- Requires existing public.mrs_projects and public.mrs_project_invites from schema.sql.
-- Run in Supabase SQL Editor. Then bootstrap the administrator in a separate private SQL query.
create schema if not exists private;

create table if not exists public.mrs_team_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.mrs_team_admins enable row level security;
revoke all on public.mrs_team_admins from anon, authenticated;
grant select on public.mrs_team_admins to authenticated;
drop policy if exists mrs_admins_self on public.mrs_team_admins;
create policy mrs_admins_self on public.mrs_team_admins for select to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.mrs_team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  can_create boolean not null default false,
  can_share boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mrs_team_members_status_idx on public.mrs_team_members(status);
alter table public.mrs_team_members enable row level security;
revoke all on public.mrs_team_members from anon, authenticated;
grant select, update on public.mrs_team_members to authenticated;
drop policy if exists mrs_members_read on public.mrs_team_members;
create policy mrs_members_read on public.mrs_team_members for select to authenticated
using (user_id = (select auth.uid()) or exists (
  select 1 from public.mrs_team_admins a where a.user_id = (select auth.uid())
));
drop policy if exists mrs_members_admin_update on public.mrs_team_members;
create policy mrs_members_admin_update on public.mrs_team_members for update to authenticated
using (exists (select 1 from public.mrs_team_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.mrs_team_admins a where a.user_id = (select auth.uid())));

-- Populate existing Supabase Auth accounts as pending. No account gets admin privilege automatically.
insert into public.mrs_team_members (user_id, email)
select id,lower(email) from auth.users where email is not null
on conflict (user_id) do nothing;

-- New Supabase Auth signups automatically join the pending approval queue.
create or replace function private.mrs_register_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is not null then
    insert into public.mrs_team_members (user_id,email) values (new.id,lower(new.email))
    on conflict (user_id) do nothing;
  end if;
  return new;
end
$$;
revoke all on function private.mrs_register_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_mrs on auth.users;
create trigger on_auth_user_created_mrs after insert on auth.users
for each row execute function private.mrs_register_auth_user();

-- Audit feed and permission requests, readable by owner; only callers may log/request for themselves.
create table if not exists public.mrs_team_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('login','project_created','project_saved','share_requested')),
  created_at timestamptz not null default now()
);
create index if not exists mrs_team_events_recent_idx on public.mrs_team_events(created_at desc);
alter table public.mrs_team_events enable row level security;
revoke all on public.mrs_team_events from anon,authenticated;
grant select on public.mrs_team_events to authenticated;
grant insert (user_id,action) on public.mrs_team_events to authenticated;
drop policy if exists mrs_events_read on public.mrs_team_events;
create policy mrs_events_read on public.mrs_team_events for select to authenticated
using (user_id = (select auth.uid()) or exists (
  select 1 from public.mrs_team_admins a where a.user_id = (select auth.uid())
));
drop policy if exists mrs_events_insert on public.mrs_team_events;
create policy mrs_events_insert on public.mrs_team_events for insert to authenticated
with check (user_id = (select auth.uid()));

create table if not exists public.mrs_permission_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('share')),
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create unique index if not exists mrs_requests_one_pending
on public.mrs_permission_requests(user_id, request_type) where status = 'pending';
alter table public.mrs_permission_requests enable row level security;
revoke all on public.mrs_permission_requests from anon, authenticated;
grant select,update on public.mrs_permission_requests to authenticated;
grant insert (user_id,request_type,note) on public.mrs_permission_requests to authenticated;
drop policy if exists mrs_requests_read on public.mrs_permission_requests;
create policy mrs_requests_read on public.mrs_permission_requests for select to authenticated
using (user_id = (select auth.uid()) or exists (
 select 1 from public.mrs_team_admins a where a.user_id = (select auth.uid())
));
drop policy if exists mrs_requests_insert on public.mrs_permission_requests;
create policy mrs_requests_insert on public.mrs_permission_requests for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending' and exists (
 select 1 from public.mrs_team_members m where m.user_id = (select auth.uid()) and m.status = 'active'
));
drop policy if exists mrs_requests_admin_update on public.mrs_permission_requests;
create policy mrs_requests_admin_update on public.mrs_permission_requests for update to authenticated
using (exists (select 1 from public.mrs_team_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.mrs_team_admins a where a.user_id = (select auth.uid())));

-- Existing project payloads, IDs, saved revisions, and existing invitations remain unchanged.
drop policy if exists mrs_projects_read on public.mrs_projects;
create policy mrs_projects_read on public.mrs_projects for select to authenticated using (
  exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
  or (
    exists (select 1 from public.mrs_team_members m where m.user_id=(select auth.uid()) and m.status='active')
    and (
      owner_id=(select auth.uid())
      or exists (
        select 1 from public.mrs_project_invites i
        where i.project_id=id and i.email=lower((select auth.jwt())->>'email')
      )
    )
  )
);

drop policy if exists mrs_projects_create on public.mrs_projects;
create policy mrs_projects_create on public.mrs_projects for insert to authenticated
with check (owner_id=(select auth.uid()) and (
 exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
 or exists (select 1 from public.mrs_team_members m
 where m.user_id=(select auth.uid()) and m.status='active' and m.can_create)
));

drop policy if exists mrs_projects_owner_edit on public.mrs_projects;
create policy mrs_projects_owner_edit on public.mrs_projects for update to authenticated
using (
  exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
  or (owner_id=(select auth.uid()) and exists (
    select 1 from public.mrs_team_members m where m.user_id=(select auth.uid()) and m.status='active'
  ))
)
with check (
  exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
  or (owner_id=(select auth.uid()) and exists (
    select 1 from public.mrs_team_members m where m.user_id=(select auth.uid()) and m.status='active'
  ))
);

drop policy if exists mrs_projects_owner_delete on public.mrs_projects;
create policy mrs_projects_owner_delete on public.mrs_projects for delete to authenticated
using (
 exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
 or (owner_id=(select auth.uid()) and exists (
  select 1 from public.mrs_team_members m where m.user_id=(select auth.uid()) and m.status='active'
 ))
);

-- Project invitations: admins can share; members can share only after explicit approval.
drop policy if exists mrs_invites_read on public.mrs_project_invites;
create policy mrs_invites_read on public.mrs_project_invites for select to authenticated
using (
 exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
 or added_by=(select auth.uid())
 or (
    email=lower((select auth.jwt())->>'email')
    and exists (select 1 from public.mrs_team_members m where m.user_id=(select auth.uid()) and m.status='active')
 )
);
drop policy if exists mrs_invites_owner_create on public.mrs_project_invites;
create policy mrs_invites_owner_create on public.mrs_project_invites for insert to authenticated
with check (
 added_by=(select auth.uid()) and (
  exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
  or (exists (select 1 from public.mrs_projects p where p.id=project_id and p.owner_id=(select auth.uid()))
     and exists (select 1 from public.mrs_team_members m
       where m.user_id=(select auth.uid()) and m.status='active' and m.can_share))
 )
);
drop policy if exists mrs_invites_owner_edit on public.mrs_project_invites;
create policy mrs_invites_owner_edit on public.mrs_project_invites for update to authenticated
using (
 exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
 or (added_by=(select auth.uid()) and exists (
  select 1 from public.mrs_team_members m
  where m.user_id=(select auth.uid()) and m.status='active' and m.can_share))
)
with check (
 exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
 or (added_by=(select auth.uid()) and exists (
  select 1 from public.mrs_team_members m
  where m.user_id=(select auth.uid()) and m.status='active' and m.can_share))
);
drop policy if exists mrs_invites_owner_delete on public.mrs_project_invites;
create policy mrs_invites_owner_delete on public.mrs_project_invites for delete to authenticated
using (
 exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
 or (added_by=(select auth.uid()) and exists (
  select 1 from public.mrs_team_members m where m.user_id=(select auth.uid()) and m.status='active' and m.can_share))
);

-- No anon access to private business tables.
revoke all on public.mrs_projects, public.mrs_project_invites,
 public.mrs_team_members, public.mrs_team_admins, public.mrs_team_events,
 public.mrs_permission_requests from anon;
