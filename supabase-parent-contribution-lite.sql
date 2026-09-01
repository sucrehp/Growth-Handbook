-- Growth Portfolio Lite V1 / GP-L3.1
-- Parent Contribution Lite reuses parent_uploads as the pending-review source.
-- No legacy Growth Handbook business row is created until institution approval.

begin;

create table if not exists public.parent_contribution_metadata (
  id uuid primary key default uuid_generate_v4(),
  parent_upload_id uuid not null unique
    references public.parent_uploads(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  record_type text not null check (record_type in (
    'LEARNING', 'PROJECT', 'WORK', 'ACTIVITY', 'SKILL', 'INTEREST',
    'ACHIEVEMENT', 'TEACHER_OBSERVATION', 'MILESTONE', 'OTHER'
  )),
  tags text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence) = 'array'),
  external_video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.parent_contribution_metadata is
  'Sidecar for exact Parent Contribution type, tags, and private evidence metadata.';

create index if not exists idx_parent_contribution_metadata_child
  on public.parent_contribution_metadata(child_id, created_at desc);

alter table public.parent_contribution_metadata enable row level security;
revoke all on table public.parent_contribution_metadata from anon;
grant select, insert, update, delete
  on table public.parent_contribution_metadata to authenticated;

-- TEMPORARY V1 AUTH BOUNDARY: authenticated accounts are controlled institution
-- operators while public sign-up remains disabled. Harden before Parent Auth,
-- external organization, SaaS, or multi-tenant rollout.
drop policy if exists "authenticated manage parent contribution metadata"
  on public.parent_contribution_metadata;
create policy "authenticated manage parent contribution metadata"
  on public.parent_contribution_metadata for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop trigger if exists trigger_parent_contribution_metadata_updated_at
  on public.parent_contribution_metadata;
create trigger trigger_parent_contribution_metadata_updated_at
  before update on public.parent_contribution_metadata
  for each row execute function public.update_updated_at();

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
  if nullif(trim(coalesce(p_token, '')), '') is null then
    raise exception 'invalid share token';
  end if;

  select c.id into v_child_id
  from public.children c
  where c.share_token = p_token;

  if v_child_id is null then
    raise exception 'invalid share token';
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
  from public.parent_uploads pu
  where pu.child_id = v_child_id
    and pu.created_at >= date_trunc('month', now());

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
    v_child_id, 'share-token', v_content_type, v_title, v_detail,
    '{}', p_event_date, 'pending', false
  )
  returning id into v_upload_id;

  insert into public.parent_contribution_metadata (
    parent_upload_id, child_id, record_type, tags,
    evidence, external_video_url
  ) values (
    v_upload_id, v_child_id, v_type, coalesce(p_tags, '{}'),
    '[]'::jsonb, v_video_url
  );

  return jsonb_build_object(
    'contribution_id', v_upload_id,
    'status', 'PENDING_REVIEW'
  );
end;
$func$;

revoke all on function public.submit_parent_contribution_by_token(
  text, text, date, text, text, text[], text
) from public;
grant execute on function public.submit_parent_contribution_by_token(
  text, text, date, text, text, text[], text
) to anon, authenticated;

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
  delete from public.parent_uploads pu
  using public.children c
  where pu.id = p_contribution_id
    and pu.child_id = c.id
    and c.share_token = p_token
    and pu.audit_status = 'pending'
    and pu.visible_in_handbook = false
  returning pu.id into v_deleted_id;

  return v_deleted_id is not null;
end;
$func$;

revoke all on function public.cancel_parent_contribution_by_token(text, uuid)
  from public;
grant execute on function public.cancel_parent_contribution_by_token(text, uuid)
  to anon, authenticated;

commit;
