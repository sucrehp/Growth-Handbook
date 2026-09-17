-- Growth Portfolio Lite / GP-L6 controlled parent-access pilot.
-- Production application is HUMAN MANUAL APPLY only.
-- This migration adds the minimum staff/guardian boundary required before a
-- parent can receive an authenticated session. It does not rewrite business rows.

begin;

create extension if not exists "uuid-ossp";

create table if not exists public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  campus_id uuid,
  display_name text,
  role text not null default 'teacher'
    check (role in ('owner','campus_manager','finance','consultant','teacher','frontdesk')),
  status text not null default 'active' check (status in ('active','inactive')),
  module_permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_profiles
  add column if not exists campus_id uuid,
  add column if not exists display_name text,
  add column if not exists role text not null default 'teacher',
  add column if not exists status text not null default 'active',
  add column if not exists module_permissions jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.parent_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  relation text not null default '家长',
  is_primary boolean not null default false,
  can_edit_basic boolean not null default false,
  can_reply_comments boolean not null default true,
  can_upload_growth boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, child_id)
);

alter table public.parent_accounts
  add column if not exists relation text not null default '家长',
  add column if not exists is_primary boolean not null default false,
  add column if not exists can_edit_basic boolean not null default false,
  add column if not exists can_reply_comments boolean not null default true,
  add column if not exists can_upload_growth boolean not null default true,
  add column if not exists status text not null default 'active',
  add column if not exists granted_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.parent_accounts alter column can_edit_basic set default false;

create index if not exists idx_parent_accounts_user_status
  on public.parent_accounts(user_id, status);
create index if not exists idx_parent_accounts_child_status
  on public.parent_accounts(child_id, status);

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $func$
  select exists (
    select 1
    from public.staff_profiles staff
    where staff.id = auth.uid()
      and staff.status = 'active'
  );
$func$;

revoke all on function public.is_active_staff() from public, anon;
grant execute on function public.is_active_staff() to authenticated;

alter table public.staff_profiles enable row level security;
alter table public.parent_accounts enable row level security;

revoke all privileges on table public.staff_profiles, public.parent_accounts from public, anon;
revoke insert, update, delete on table public.staff_profiles, public.parent_accounts from authenticated;
grant select on table public.staff_profiles, public.parent_accounts to authenticated;

drop policy if exists "authenticated_manage_staff_profiles" on public.staff_profiles;
drop policy if exists "authenticated read own staff profile" on public.staff_profiles;
create policy "authenticated read own staff profile"
  on public.staff_profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "authenticated_manage_parent_accounts" on public.parent_accounts;
drop policy if exists "authenticated read own parent accounts" on public.parent_accounts;
create policy "authenticated read own parent accounts"
  on public.parent_accounts for select to authenticated
  using (user_id = auth.uid());

-- Remove every known legacy policy that treated any authenticated user as an
-- institution operator. Active parent sessions must fail closed on these tables.
drop policy if exists "管理员完全访问children" on public.children;
drop policy if exists "authenticated institution operator children" on public.children;
drop policy if exists "管理员完全访问timeline" on public.growth_timeline;
drop policy if exists "authenticated institution operator timeline" on public.growth_timeline;
drop policy if exists "管理员完全访问course" on public.course_records;
drop policy if exists "authenticated institution operator course" on public.course_records;
drop policy if exists "管理员完全访问comment" on public.teacher_comments;
drop policy if exists "authenticated institution operator comment" on public.teacher_comments;
drop policy if exists "管理员完全访问activity" on public.activity_records;
drop policy if exists "authenticated institution operator activity" on public.activity_records;
drop policy if exists "管理员完全访问achievement" on public.achievements;
drop policy if exists "authenticated institution operator achievement" on public.achievements;
drop policy if exists "管理员完全访问photo" on public.photo_records;
drop policy if exists "authenticated institution operator photo" on public.photo_records;
drop policy if exists "管理员完全访问message" on public.parent_messages;
drop policy if exists "authenticated institution operator message" on public.parent_messages;
drop policy if exists "认证用户管理家长绑定" on public.parent_bindings;
drop policy if exists "认证用户管理家长上传" on public.parent_uploads;
drop policy if exists "认证用户管理家长回复" on public.parent_replies;

drop policy if exists "authenticated read growth record metadata" on public.growth_record_metadata;
drop policy if exists "authenticated insert growth record metadata" on public.growth_record_metadata;
drop policy if exists "authenticated update growth record metadata" on public.growth_record_metadata;
drop policy if exists "authenticated delete growth record metadata" on public.growth_record_metadata;
drop policy if exists "authenticated manage parent contribution metadata" on public.parent_contribution_metadata;

do $policies$
declare
  table_name text;
begin
  foreach table_name in array array[
    'children', 'growth_timeline', 'course_records', 'teacher_comments',
    'activity_records', 'achievements', 'photo_records', 'parent_messages',
    'parent_uploads', 'parent_replies', 'parent_bindings',
    'growth_record_metadata', 'parent_contribution_metadata'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', 'active staff manages ' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff())',
      'active staff manages ' || table_name,
      table_name
    );
  end loop;
end;
$policies$;

-- Keep public photo viewing unchanged, but authenticated upload/delete is staff-only.
drop policy if exists "认证用户上传照片" on storage.objects;
drop policy if exists "认证用户删除照片" on storage.objects;
drop policy if exists "active staff uploads photos" on storage.objects;
drop policy if exists "active staff deletes photos" on storage.objects;
create policy "active staff uploads photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_active_staff());
create policy "active staff deletes photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_active_staff());

commit;
