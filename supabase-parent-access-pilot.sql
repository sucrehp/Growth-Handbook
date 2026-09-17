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
  can_reply_comments boolean not null default false,
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
  add column if not exists can_reply_comments boolean not null default false,
  add column if not exists can_upload_growth boolean not null default true,
  add column if not exists status text not null default 'active',
  add column if not exists granted_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.parent_accounts alter column can_edit_basic set default false;
alter table public.parent_accounts alter column can_reply_comments set default false;

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

-- Parent contribution now requires both an authenticated parent account and an
-- active child binding. The share token still scopes the target child, while
-- the account binding supplies the authorization decision.
create or replace function public.submit_parent_contribution_by_token(
  p_token text,
  p_record_type text,
  p_event_date date,
  p_title text,
  p_detail text default null,
  p_tags text[] default '{}',
  p_external_video_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_child_id uuid;
  v_upload_id uuid;
  v_type text := upper(trim(coalesce(p_record_type, '')));
  v_title text := trim(coalesce(p_title, ''));
  v_detail text := nullif(trim(coalesce(p_detail, '')), '');
  v_video_url text := nullif(trim(coalesce(p_external_video_url, '')), '');
  v_content_type text;
  v_month_count integer;
begin
  if auth.uid() is null then
    raise exception 'parent authentication required';
  end if;
  if nullif(trim(coalesce(p_token, '')), '') is null then
    raise exception 'invalid share token';
  end if;

  select c.id into v_child_id
  from public.children c
  where c.share_token = p_token
    and exists (
      select 1 from public.parent_accounts account
      where account.user_id = auth.uid()
        and account.child_id = c.id
        and account.status = 'active'
        and account.can_upload_growth
    );

  if v_child_id is null then
    raise exception 'parent child access denied';
  end if;
  if p_event_date is null then
    raise exception 'event date is required';
  end if;
  if v_title = '' or char_length(v_title) > 120 then
    raise exception 'title is required and must not exceed 120 characters';
  end if;
  if char_length(coalesce(v_detail, '')) > 1000 then
    raise exception 'detail must not exceed 1000 characters';
  end if;
  if v_type not in (
    'LEARNING', 'PROJECT', 'WORK', 'ACTIVITY', 'SKILL', 'INTEREST',
    'ACHIEVEMENT', 'TEACHER_OBSERVATION', 'MILESTONE', 'OTHER'
  ) then
    raise exception 'unsupported record type';
  end if;
  if v_video_url is not null
     and (char_length(v_video_url) > 2000 or v_video_url !~* '^https://') then
    raise exception 'external video link must use https';
  end if;
  if coalesce(array_length(p_tags, 1), 0) > 8
     or exists (
       select 1 from unnest(coalesce(p_tags, '{}')) tag
       where char_length(trim(tag)) > 30
     ) then
    raise exception 'tags must contain at most 8 items of 30 characters';
  end if;

  select count(*) into v_month_count
  from public.parent_uploads upload
  where upload.child_id = v_child_id
    and upload.created_at >= date_trunc('month', now());
  if v_month_count >= 5 then
    raise exception 'monthly parent contribution limit reached';
  end if;

  v_content_type := case
    when v_type = 'MILESTONE' then 'milestone'
    when v_type in ('LEARNING', 'SKILL', 'INTEREST') then 'skill'
    when v_type = 'ACTIVITY' then 'daily'
    else 'story'
  end;

  insert into public.parent_uploads (
    child_id, parent_openid, content_type, title, description,
    photo_urls, event_date, audit_status, visible_in_handbook
  ) values (
    v_child_id, auth.uid()::text, v_content_type, v_title, v_detail,
    '{}', p_event_date, 'pending', false
  ) returning id into v_upload_id;

  insert into public.parent_contribution_metadata (
    parent_upload_id, child_id, record_type, tags, evidence, external_video_url
  ) values (
    v_upload_id, v_child_id, v_type, coalesce(p_tags, '{}'),
    '[]'::jsonb, v_video_url
  );

  return jsonb_build_object('contribution_id', v_upload_id, 'status', 'PENDING_REVIEW');
end;
$func$;

revoke all on function public.submit_parent_contribution_by_token(
  text, text, date, text, text, text[], text
) from public, anon, authenticated;
grant execute on function public.submit_parent_contribution_by_token(
  text, text, date, text, text, text[], text
) to authenticated;

create or replace function public.cancel_parent_contribution_by_token(
  p_token text,
  p_contribution_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_deleted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'parent authentication required';
  end if;
  delete from public.parent_uploads upload
  using public.children child
  where upload.id = p_contribution_id
    and upload.child_id = child.id
    and child.share_token = p_token
    and upload.parent_openid = auth.uid()::text
    and upload.audit_status = 'pending'
    and upload.visible_in_handbook = false
    and exists (
      select 1 from public.parent_accounts account
      where account.user_id = auth.uid()
        and account.child_id = child.id
        and account.status = 'active'
        and account.can_upload_growth
    )
  returning upload.id into v_deleted_id;
  return v_deleted_id is not null;
end;
$func$;

revoke all on function public.cancel_parent_contribution_by_token(text, uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_parent_contribution_by_token(text, uuid)
  to authenticated;

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
