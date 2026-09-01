-- Growth Portfolio Lite V1 / GP-L2.2
-- METADATA_SIDECAR_ONLY: legacy business tables remain authoritative.

begin;

create table if not exists public.growth_record_metadata (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid not null references public.children(id) on delete cascade,
  source_table text not null check (source_table in (
    'growth_timeline', 'course_records', 'teacher_comments',
    'activity_records', 'achievements', 'photo_records'
  )),
  source_record_id uuid not null,
  record_type text not null check (record_type in (
    'LEARNING', 'PROJECT', 'WORK', 'ACTIVITY', 'SKILL', 'INTEREST',
    'ACHIEVEMENT', 'TEACHER_OBSERVATION', 'MILESTONE', 'OTHER'
  )),
  source text not null default 'INSTITUTION_RECORD'
    check (source in ('INSTITUTION_RECORD', 'PARENT_PROVIDED')),
  status text not null default 'PUBLISHED'
    check (status in ('PUBLISHED', 'PENDING_REVIEW')),
  tags text[] not null default '{}',
  featured boolean not null default false,
  evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_table, source_record_id)
);

comment on table public.growth_record_metadata is
  'Metadata-only interpretation of legacy Growth Portfolio records; never stores business content or media binaries.';

create index if not exists idx_growth_record_metadata_child
  on public.growth_record_metadata(child_id);

alter table public.growth_record_metadata enable row level security;
revoke all on table public.growth_record_metadata from anon;
grant select, insert, update, delete on table public.growth_record_metadata to authenticated;

-- TEMPORARY V1 AUTH BOUNDARY: public sign-up, anonymous sign-in, and manual
-- linking are disabled in the single-organization Production project, so an
-- authenticated session currently represents a controlled institution operator.
-- LEGACY_AUTH_HARDENING_REQUIRED: MUST_BE_HARDENED_BEFORE PARENT_AUTH OR
-- EXTERNAL_ORGANIZATION_ROLLOUT, including SaaS or multi-tenant operation.
-- GP-L5 P0 SECURITY DEBT: legacy Growth Handbook tables still have anonymous
-- read policies; that separate issue is intentionally outside this migration.

drop policy if exists "authenticated read growth record metadata" on public.growth_record_metadata;
create policy "authenticated read growth record metadata"
  on public.growth_record_metadata for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists "authenticated insert growth record metadata" on public.growth_record_metadata;
create policy "authenticated insert growth record metadata"
  on public.growth_record_metadata for insert to authenticated
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated update growth record metadata" on public.growth_record_metadata;
create policy "authenticated update growth record metadata"
  on public.growth_record_metadata for update to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated delete growth record metadata" on public.growth_record_metadata;
create policy "authenticated delete growth record metadata"
  on public.growth_record_metadata for delete to authenticated
  using (auth.role() = 'authenticated');

drop trigger if exists trigger_growth_record_metadata_updated_at on public.growth_record_metadata;
create trigger trigger_growth_record_metadata_updated_at
  before update on public.growth_record_metadata
  for each row execute function public.update_updated_at();

-- Token-scoped read: metadata remains private except through a valid child share token.
create or replace function public.get_growth_record_metadata_by_token(p_token text)
returns setof public.growth_record_metadata
language sql
stable
security definer
set search_path = public
as $func$
  select m.*
  from public.growth_record_metadata m
  join public.children c on c.id = m.child_id
  where c.share_token = p_token
    and m.child_id = c.id
  order by m.created_at, m.id;
$func$;

revoke all on function public.get_growth_record_metadata_by_token(text) from public;
grant execute on function public.get_growth_record_metadata_by_token(text) to anon, authenticated;

-- One transaction writes authoritative legacy content and its metadata sidecar.
create or replace function public.create_institution_growth_record(
  p_child_id uuid,
  p_record_type text,
  p_event_date date,
  p_title text,
  p_detail text default null,
  p_tags text[] default '{}',
  p_featured boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $func$
declare
  v_type text := upper(trim(coalesce(p_record_type, '')));
  v_title text := trim(coalesce(p_title, ''));
  v_detail text := nullif(trim(coalesce(p_detail, '')), '');
  v_source_table text;
  v_source_record_id uuid;
  v_sort_order integer;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    raise exception 'authentication required';
  end if;
  if not exists (select 1 from public.children where id = p_child_id) then
    raise exception 'child not found';
  end if;
  if p_event_date is null then
    raise exception 'event date is required';
  end if;
  if v_title = '' then
    raise exception 'title is required';
  end if;
  if v_type not in (
    'LEARNING', 'PROJECT', 'WORK', 'ACTIVITY', 'SKILL', 'INTEREST',
    'ACHIEVEMENT', 'TEACHER_OBSERVATION', 'MILESTONE', 'OTHER'
  ) then
    raise exception 'unsupported record type';
  end if;

  if v_type in ('MILESTONE', 'OTHER') then
    v_source_table := 'growth_timeline';
    select count(*) into v_sort_order from public.growth_timeline where child_id = p_child_id;
    insert into public.growth_timeline (child_id, event_date, title, description, sort_order)
      values (p_child_id, p_event_date, v_title, v_detail, v_sort_order)
      returning id into v_source_record_id;
  elsif v_type in ('LEARNING', 'SKILL', 'INTEREST') then
    v_source_table := 'course_records';
    select count(*) into v_sort_order from public.course_records where child_id = p_child_id;
    insert into public.course_records (child_id, course_name, date, performance, sort_order)
      values (p_child_id, v_title, p_event_date, v_detail, v_sort_order)
      returning id into v_source_record_id;
  elsif v_type in ('PROJECT', 'WORK', 'ACTIVITY') then
    v_source_table := 'activity_records';
    select count(*) into v_sort_order from public.activity_records where child_id = p_child_id;
    insert into public.activity_records (child_id, activity_name, date, description, sort_order)
      values (p_child_id, v_title, p_event_date, v_detail, v_sort_order)
      returning id into v_source_record_id;
  elsif v_type = 'ACHIEVEMENT' then
    v_source_table := 'achievements';
    select count(*) into v_sort_order from public.achievements where child_id = p_child_id;
    insert into public.achievements (child_id, title, description, date, sort_order)
      values (p_child_id, v_title, v_detail, p_event_date, v_sort_order)
      returning id into v_source_record_id;
  else
    v_source_table := 'teacher_comments';
    select count(*) into v_sort_order from public.teacher_comments where child_id = p_child_id;
    insert into public.teacher_comments (child_id, comment, date, sort_order)
      values (
        p_child_id,
        case when v_detail is null then v_title else v_title || E'\n\n' || v_detail end,
        p_event_date,
        v_sort_order
      )
      returning id into v_source_record_id;
  end if;

  insert into public.growth_record_metadata (
    child_id, source_table, source_record_id, record_type,
    source, status, tags, featured
  ) values (
    p_child_id, v_source_table, v_source_record_id, v_type,
    'INSTITUTION_RECORD', 'PUBLISHED', coalesce(p_tags, '{}'), coalesce(p_featured, false)
  );

  return jsonb_build_object(
    'source_table', v_source_table,
    'source_record_id', v_source_record_id,
    'record_type', v_type
  );
end;
$func$;

revoke all on function public.create_institution_growth_record(uuid, text, date, text, text, text[], boolean) from public, anon;
grant execute on function public.create_institution_growth_record(uuid, text, date, text, text, text[], boolean) to authenticated;

-- Polymorphic lineage cannot use a direct foreign key; cleanup triggers prevent orphans.
create or replace function public.delete_growth_record_metadata_sidecar()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  delete from public.growth_record_metadata
  where source_table = TG_TABLE_NAME and source_record_id = OLD.id;
  return OLD;
end;
$func$;

revoke all on function public.delete_growth_record_metadata_sidecar() from public, anon, authenticated;

drop trigger if exists cleanup_growth_timeline_metadata on public.growth_timeline;
create trigger cleanup_growth_timeline_metadata after delete on public.growth_timeline
  for each row execute function public.delete_growth_record_metadata_sidecar();
drop trigger if exists cleanup_course_records_metadata on public.course_records;
create trigger cleanup_course_records_metadata after delete on public.course_records
  for each row execute function public.delete_growth_record_metadata_sidecar();
drop trigger if exists cleanup_teacher_comments_metadata on public.teacher_comments;
create trigger cleanup_teacher_comments_metadata after delete on public.teacher_comments
  for each row execute function public.delete_growth_record_metadata_sidecar();
drop trigger if exists cleanup_activity_records_metadata on public.activity_records;
create trigger cleanup_activity_records_metadata after delete on public.activity_records
  for each row execute function public.delete_growth_record_metadata_sidecar();
drop trigger if exists cleanup_achievements_metadata on public.achievements;
create trigger cleanup_achievements_metadata after delete on public.achievements
  for each row execute function public.delete_growth_record_metadata_sidecar();
drop trigger if exists cleanup_photo_records_metadata on public.photo_records;
create trigger cleanup_photo_records_metadata after delete on public.photo_records
  for each row execute function public.delete_growth_record_metadata_sidecar();

commit;
