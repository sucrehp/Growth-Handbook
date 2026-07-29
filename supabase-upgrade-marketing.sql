-- Growth Handbook 内容营销智能体升级
-- 安全原则：儿童素材默认不可发布，必须确认家长授权并经过人工审核。

create extension if not exists "uuid-ossp";

create table if not exists public.media_consents (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references public.children(id) on delete cascade,
  guardian_name text,
  consent_scope text[] not null default '{}',
  valid_from date,
  valid_until date,
  status text not null default 'pending'
    check (status in ('pending', 'granted', 'revoked', 'expired')),
  evidence_url text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_materials (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references public.children(id) on delete set null,
  material_type text not null check (material_type in ('photo', 'video', 'text')),
  file_url text,
  thumbnail_url text,
  original_text text,
  activity_name text,
  course_category text,
  campus text,
  captured_at timestamptz,
  uploaded_by uuid references auth.users(id),
  consent_status text not null default 'unverified'
    check (consent_status in ('unverified', 'granted', 'blocked')),
  privacy_status text not null default 'pending'
    check (privacy_status in ('pending', 'passed', 'needs_blur', 'blocked')),
  ai_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.content_drafts (
  id uuid primary key default uuid_generate_v4(),
  material_id uuid not null references public.marketing_materials(id) on delete cascade,
  platform text not null check (platform in ('moments', 'xiaohongshu', 'douyin')),
  title text,
  body text not null,
  hashtags text[] not null default '{}',
  cover_brief text,
  video_script text,
  asset_urls text[] not null default '{}',
  generation_mode text not null default 'template',
  review_status text not null default 'draft'
    check (review_status in ('draft', 'pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id, platform)
);

create table if not exists public.publish_schedules (
  id uuid primary key default uuid_generate_v4(),
  draft_id uuid not null references public.content_drafts(id) on delete cascade,
  scheduled_at timestamptz not null,
  reminder_at timestamptz not null,
  assignee_name text not null,
  assignee_phone text,
  reminder_channel text not null default 'in_app'
    check (reminder_channel in ('in_app', 'wecom', 'sms')),
  reminder_status text not null default 'pending'
    check (reminder_status in ('pending', 'sent', 'failed', 'cancelled')),
  publish_status text not null default 'scheduled'
    check (publish_status in ('scheduled', 'published', 'missed', 'cancelled')),
  reminder_sent_at timestamptz,
  published_at timestamptz,
  published_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_marketing_materials_created
  on public.marketing_materials(created_at desc);
create index if not exists idx_content_drafts_status
  on public.content_drafts(review_status, platform);
create index if not exists idx_publish_schedules_due
  on public.publish_schedules(reminder_status, reminder_at);
create index if not exists idx_media_consents_child
  on public.media_consents(child_id, status);

alter table public.media_consents enable row level security;
alter table public.marketing_materials enable row level security;
alter table public.content_drafts enable row level security;
alter table public.publish_schedules enable row level security;

drop policy if exists "staff_manage_media_consents" on public.media_consents;
create policy "staff_manage_media_consents" on public.media_consents
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "staff_manage_marketing_materials" on public.marketing_materials;
create policy "staff_manage_marketing_materials" on public.marketing_materials
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "staff_manage_content_drafts" on public.content_drafts;
create policy "staff_manage_content_drafts" on public.content_drafts
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "staff_manage_publish_schedules" on public.publish_schedules;
create policy "staff_manage_publish_schedules" on public.publish_schedules
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('marketing-materials', 'marketing-materials', false)
on conflict (id) do nothing;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'media_consents',
    'marketing_materials',
    'content_drafts',
    'publish_schedules'
  )
order by table_name;
