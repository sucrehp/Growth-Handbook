-- Growth Portfolio Lite V1 / GP-L5.1
-- Legacy child-data privacy hardening for the single-organization V1 boundary.
-- Production application must be performed manually in Supabase SQL Editor.

begin;

-- Anonymous visitors must never read child business tables directly. The
-- authenticated role remains the controlled institution-operator boundary.
alter table public.children enable row level security;
alter table public.growth_timeline enable row level security;
alter table public.course_records enable row level security;
alter table public.teacher_comments enable row level security;
alter table public.activity_records enable row level security;
alter table public.achievements enable row level security;
alter table public.photo_records enable row level security;
alter table public.parent_messages enable row level security;
alter table public.parent_uploads enable row level security;
alter table public.parent_replies enable row level security;
alter table public.parent_bindings enable row level security;

revoke all privileges on table
  public.children,
  public.growth_timeline,
  public.course_records,
  public.teacher_comments,
  public.activity_records,
  public.achievements,
  public.photo_records,
  public.parent_messages,
  public.parent_uploads,
  public.parent_replies,
  public.parent_bindings
from anon;

revoke all privileges on table
  public.children,
  public.growth_timeline,
  public.course_records,
  public.teacher_comments,
  public.activity_records,
  public.achievements,
  public.photo_records,
  public.parent_messages,
  public.parent_uploads,
  public.parent_replies,
  public.parent_bindings
from public;

grant select, insert, update, delete on table
  public.children,
  public.growth_timeline,
  public.course_records,
  public.teacher_comments,
  public.activity_records,
  public.achievements,
  public.photo_records,
  public.parent_messages,
  public.parent_uploads,
  public.parent_replies,
  public.parent_bindings
to authenticated;

-- Remove the legacy public-read policies. Table privileges above also provide
-- a fail-closed boundary if an unknown permissive SELECT policy remains.
drop policy if exists "公开读取children" on public.children;
drop policy if exists "公开读取timeline" on public.growth_timeline;
drop policy if exists "公开读取course" on public.course_records;
drop policy if exists "公开读取comment" on public.teacher_comments;
drop policy if exists "公开读取activity" on public.activity_records;
drop policy if exists "公开读取achievement" on public.achievements;
drop policy if exists "公开读取photo" on public.photo_records;
drop policy if exists "公开读取message" on public.parent_messages;

-- Keep existing authenticated admin.html CRUD behavior. Public signup must
-- remain disabled; this is not a parent, SaaS, or multi-tenant authorization model.
drop policy if exists "管理员完全访问children" on public.children;
drop policy if exists "authenticated institution operator children" on public.children;
create policy "authenticated institution operator children"
  on public.children for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "管理员完全访问timeline" on public.growth_timeline;
drop policy if exists "authenticated institution operator timeline" on public.growth_timeline;
create policy "authenticated institution operator timeline"
  on public.growth_timeline for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "管理员完全访问course" on public.course_records;
drop policy if exists "authenticated institution operator course" on public.course_records;
create policy "authenticated institution operator course"
  on public.course_records for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "管理员完全访问comment" on public.teacher_comments;
drop policy if exists "authenticated institution operator comment" on public.teacher_comments;
create policy "authenticated institution operator comment"
  on public.teacher_comments for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "管理员完全访问activity" on public.activity_records;
drop policy if exists "authenticated institution operator activity" on public.activity_records;
create policy "authenticated institution operator activity"
  on public.activity_records for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "管理员完全访问achievement" on public.achievements;
drop policy if exists "authenticated institution operator achievement" on public.achievements;
create policy "authenticated institution operator achievement"
  on public.achievements for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "管理员完全访问photo" on public.photo_records;
drop policy if exists "authenticated institution operator photo" on public.photo_records;
create policy "authenticated institution operator photo"
  on public.photo_records for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "管理员完全访问message" on public.parent_messages;
drop policy if exists "authenticated institution operator message" on public.parent_messages;
create policy "authenticated institution operator message"
  on public.parent_messages for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- One token-scoped read returns only the public Portfolio projection for the
-- child resolved by that token. Parent contact data, notes, and the token itself
-- are intentionally absent.
create or replace function public.get_growth_portfolio_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $func$
declare
  v_child_id uuid;
begin
  select c.id into v_child_id
  from public.children c
  where c.share_token = nullif(trim(coalesce(p_token, '')), '')
  limit 1;

  if v_child_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'child', (
      select jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'gender', c.gender,
        'birthday', c.birthday,
        'class_name', c.class_name,
        'enrollment_date', c.enrollment_date,
        'avatar_url', c.avatar_url,
        'style_preference', c.style_preference,
        'created_at', c.created_at,
        'updated_at', c.updated_at
      )
      from public.children c
      where c.id = v_child_id
    ),
    'timeline', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order, t.event_date desc), '[]'::jsonb)
      from (
        select id, child_id, event_date, title, description, photo_url, sort_order, created_at
        from public.growth_timeline where child_id = v_child_id
      ) t
    ),
    'courses', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.date desc), '[]'::jsonb)
      from (
        select id, child_id, course_name, date, performance, teacher_name, photo_url, sort_order, created_at
        from public.course_records where child_id = v_child_id
      ) r
    ),
    'comments', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.date desc), '[]'::jsonb)
      from (
        select id, child_id, semester, teacher_name, comment, date, audio_url, comment_type, sort_order, created_at, updated_at
        from public.teacher_comments
        where child_id = v_child_id
          and coalesce(nullif(to_jsonb(teacher_comments)->>'visible_to_parent', '')::boolean, true)
      ) r
    ),
    'activities', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.date desc), '[]'::jsonb)
      from (
        select id, child_id, activity_name, date, role, description, photo_url, sort_order, created_at
        from public.activity_records where child_id = v_child_id
      ) r
    ),
    'achievements', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.date desc), '[]'::jsonb)
      from (
        select id, child_id, title, description, date, photo_url, sort_order, created_at
        from public.achievements where child_id = v_child_id
      ) r
    ),
    'photos', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.taken_date desc), '[]'::jsonb)
      from (
        select id, child_id, photo_url, caption, category, taken_date, sort_order, created_at
        from public.photo_records where child_id = v_child_id
      ) r
    ),
    'messages', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.date desc), '[]'::jsonb)
      from (
        select id, child_id, sender_name, relationship, message, date, sort_order, created_at
        from public.parent_messages where child_id = v_child_id
      ) r
    ),
    'metadata', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at, r.id), '[]'::jsonb)
      from (
        select id, child_id, source_table, source_record_id, record_type,
               source, status, tags, featured, evidence, created_at, updated_at
        from public.growth_record_metadata
        where child_id = v_child_id and status = 'PUBLISHED'
      ) r
    )
  );
end;
$func$;

revoke all on function public.get_growth_portfolio_by_token(text) from public;
grant execute on function public.get_growth_portfolio_by_token(text) to anon, authenticated;

-- Retire legacy RPC entry points that either accepted an arbitrary child UUID
-- or exposed the unfiltered child row. Keep the definitions for rollback safety.
revoke all on function public.get_child_full_profile(uuid) from public, anon, authenticated;
revoke all on function public.get_child_by_token(text) from public, anon, authenticated;

commit;
