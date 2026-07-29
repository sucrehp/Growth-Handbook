-- ============================================================
-- Growth Handbook v2.1 兼容升级脚本
-- 适用于当前已有的 8 张表：
-- children / growth_timeline / course_records / teacher_comments
-- activity_records / achievements / photo_records / parent_messages
--
-- 安全原则：只新增字段、表、索引和存储桶，不删除现有数据。
-- ============================================================

create extension if not exists "uuid-ossp";

-- 1. 为现有数据增加智能体和家长端所需字段
alter table public.children
  add column if not exists parent_name text,
  add column if not exists parent_phone text,
  add column if not exists parent_wechat text,
  add column if not exists family_address text,
  add column if not exists emergency_contact text,
  add column if not exists emergency_phone text,
  add column if not exists status text default '在读';

alter table public.photo_records
  add column if not exists uploaded_by text,
  add column if not exists source text default 'teacher',
  add column if not exists ai_instruction text;

alter table public.teacher_comments
  add column if not exists content_raw text,
  add column if not exists source text default 'text',
  add column if not exists audio_url text,
  add column if not exists comment_type text default '综合评语',
  add column if not exists visible_to_parent boolean default true,
  add column if not exists updated_at timestamptz default now();

-- 2. 家长微信绑定
create table if not exists public.parent_bindings (
  id uuid primary key default uuid_generate_v4(),
  openid text not null,
  child_id uuid not null references public.children(id) on delete cascade,
  relation text default '家长',
  phone text,
  is_primary boolean default false,
  bound_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (openid, child_id)
);

-- 3. 家长上传：家庭照片和成长记录统一走审核
create table if not exists public.parent_uploads (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid not null references public.children(id) on delete cascade,
  parent_openid text not null,
  content_type text not null
    check (content_type in ('photo', 'milestone', 'skill', 'story', 'daily')),
  title text,
  description text,
  photo_urls text[],
  event_date date,
  audit_status text default 'pending'
    check (audit_status in ('pending', 'approved', 'rejected')),
  audit_by text,
  audit_at timestamptz,
  audit_remark text,
  visible_in_handbook boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. 家长回复老师评语
create table if not exists public.parent_replies (
  id uuid primary key default uuid_generate_v4(),
  comment_id uuid not null references public.teacher_comments(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  parent_openid text not null,
  content text not null,
  is_liked boolean default false,
  created_at timestamptz default now()
);

-- 5. 儿童背景音乐库
create table if not exists public.music_library (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  artist text,
  category text default '轻快乐曲',
  file_url text not null,
  duration integer,
  mood text,
  recommended_pages text[],
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 6. 索引
create index if not exists idx_children_parent_phone on public.children(parent_phone);
create index if not exists idx_children_parent_wechat on public.children(parent_wechat);
create index if not exists idx_photo_created on public.photo_records(created_at desc);
create index if not exists idx_parent_bindings_openid on public.parent_bindings(openid);
create index if not exists idx_parent_bindings_child on public.parent_bindings(child_id);
create index if not exists idx_parent_uploads_child on public.parent_uploads(child_id);
create index if not exists idx_parent_uploads_status on public.parent_uploads(audit_status);
create index if not exists idx_parent_replies_comment on public.parent_replies(comment_id);
create index if not exists idx_parent_replies_child on public.parent_replies(child_id);
create index if not exists idx_music_active_sort on public.music_library(is_active, sort_order);

-- 7. RLS。服务端的 service_role 可执行智能体写入；
-- 家长小程序上线时再增加基于微信会话的精细策略。
alter table public.parent_bindings enable row level security;
alter table public.parent_uploads enable row level security;
alter table public.parent_replies enable row level security;
alter table public.music_library enable row level security;

drop policy if exists "认证用户管理家长绑定" on public.parent_bindings;
create policy "认证用户管理家长绑定"
  on public.parent_bindings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "认证用户管理家长上传" on public.parent_uploads;
create policy "认证用户管理家长上传"
  on public.parent_uploads for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "认证用户管理家长回复" on public.parent_replies;
create policy "认证用户管理家长回复"
  on public.parent_replies for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "公开读取启用音乐" on public.music_library;
create policy "公开读取启用音乐"
  on public.music_library for select
  using (is_active = true);

drop policy if exists "认证用户管理音乐" on public.music_library;
create policy "认证用户管理音乐"
  on public.music_library for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 8. 新增存储桶。保留现有 photos 桶。
insert into storage.buckets (id, name, public)
values
  ('parent-uploads', 'parent-uploads', false),
  ('growth-music', 'growth-music', true)
on conflict (id) do nothing;

-- 9. 验证结果：执行完成后应返回 12 张表。
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
