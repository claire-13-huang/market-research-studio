-- Market Research Studio V0.7: verified member directory and multi-recipient sharing.
-- Additive upgrade. Requires V0.5 schema and V0.6 team-access-v06.sql first.
-- No existing project, SKU, Excel summary, or version history is deleted.

create table if not exists public.mrs_member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '' check (char_length(btrim(display_name)) <= 50),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mrs_member_profiles enable row level security;
revoke all on public.mrs_member_profiles from anon, authenticated;
grant select on public.mrs_member_profiles to authenticated;
grant update (display_name) on public.mrs_member_profiles to authenticated;

drop policy if exists mrs_profiles_read on public.mrs_member_profiles;
create policy mrs_profiles_read on public.mrs_member_profiles
for select to authenticated using (
 user_id = (select auth.uid())
 or exists (select 1 from public.mrs_team_admins a where a.user_id = (select auth.uid()))
 or (status='active' and exists (
   select 1 from public.mrs_team_members me
   where me.user_id = (select auth.uid()) and me.status='active'
 ))
);
drop policy if exists mrs_profiles_own_name on public.mrs_member_profiles;
create policy mrs_profiles_own_name on public.mrs_member_profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Server-owned email and membership status, mirrored from the team's member registry.
-- Users may edit only their display_name; browser updates to email/status have no GRANT.
create or replace function private.mrs_update_profile_from_member()
returns trigger
language plpgsql security definer set search_path = ''
as $function$
begin
  insert into public.mrs_member_profiles (user_id,email,status)
  values (new.user_id,lower(new.email),new.status)
  on conflict (user_id) do update
     set email = excluded.email, status = excluded.status, updated_at = now();
  return new;
end;
$function$;
revoke all on function private.mrs_update_profile_from_member() from public,anon,authenticated;
drop trigger if exists mrs_sync_member_profile_trigger on public.mrs_team_members;
create trigger mrs_sync_member_profile_trigger
after insert or update of email,status on public.mrs_team_members
for each row execute function private.mrs_update_profile_from_member();

insert into public.mrs_member_profiles (user_id,email,status)
select user_id,lower(email),status from public.mrs_team_members
on conflict (user_id) do update
 set email = excluded.email, status = excluded.status, updated_at = now();

-- Authenticated team sharing by immutable recipient user_id, not arbitrary email strings.
create table if not exists public.mrs_project_shares (
  project_id uuid not null references public.mrs_projects(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (project_id,recipient_id)
);
create index if not exists mrs_project_shares_recipient_idx
on public.mrs_project_shares(recipient_id);
alter table public.mrs_project_shares enable row level security;
revoke all on public.mrs_project_shares from anon,authenticated;
grant select,insert,delete on public.mrs_project_shares to authenticated;

drop policy if exists mrs_shares_read on public.mrs_project_shares;
create policy mrs_shares_read on public.mrs_project_shares for select to authenticated
using (
  recipient_id=(select auth.uid()) or granted_by=(select auth.uid())
  or exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
);

drop policy if exists mrs_shares_create on public.mrs_project_shares;
create policy mrs_shares_create on public.mrs_project_shares for insert to authenticated
with check (
  granted_by=(select auth.uid())
  and recipient_id<>(select auth.uid())
  and exists (
    select 1 from public.mrs_member_profiles recipient
    where recipient.user_id=recipient_id and recipient.status='active'
  )
  and (
    exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
    or (
      exists (select 1 from public.mrs_projects p
              where p.id=project_id and p.owner_id=(select auth.uid()))
      and exists (select 1 from public.mrs_team_members owner_member
        where owner_member.user_id=(select auth.uid())
          and owner_member.status='active' and owner_member.can_share)
    )
  )
);
drop policy if exists mrs_shares_delete on public.mrs_project_shares;
create policy mrs_shares_delete on public.mrs_project_shares for delete to authenticated
using (
  granted_by=(select auth.uid())
  or exists (select 1 from public.mrs_team_admins a where a.user_id=(select auth.uid()))
);

-- Private project access: admin, active owner, or explicitly shared active account.
-- Retains existing invitations to registered, approved emails for backwards compatibility.
drop policy if exists mrs_projects_read on public.mrs_projects;
create policy mrs_projects_read on public.mrs_projects for select to authenticated
using (
  exists (select 1 from public.mrs_team_admins a
          where a.user_id=(select auth.uid()))
  or (
    exists (select 1 from public.mrs_team_members member
            where member.user_id=(select auth.uid()) and member.status='active')
    and (
      owner_id=(select auth.uid())
      or exists (select 1 from public.mrs_project_shares share
                 where share.project_id=id and share.recipient_id=(select auth.uid()))
      or exists (select 1 from public.mrs_project_invites legacy
                 where legacy.project_id=id
                   and legacy.email=lower((select auth.jwt())->>'email'))
    )
  )
);
-- No anonymous access to business or directory data.
revoke all on public.mrs_member_profiles,public.mrs_project_shares from anon;
