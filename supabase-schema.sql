-- ============================================
-- 阿墨逗儿童成长中心 - 成长手册系统
-- Supabase 数据库初始化脚本
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中执行此脚本
-- ============================================

-- 1. 启用扩展
create extension if not exists "uuid-ossp";

-- 2. 孩子基本信息表
create table if not exists children (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  gender text check (gender in ('male', 'female')),
  birthday date,
  class_name text,
  enrollment_date date,
  avatar_url text,
  share_token text unique,
  style_preference text default 'boy_space',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 成长时间线
create table if not exists growth_timeline (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references children(id) on delete cascade,
  event_date date,
  title text,
  description text,
  photo_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 4. 课程记录
create table if not exists course_records (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references children(id) on delete cascade,
  course_name text,
  date date,
  performance text,
  teacher_name text,
  photo_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 5. 老师评语
create table if not exists teacher_comments (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references children(id) on delete cascade,
  semester text,
  teacher_name text,
  comment text,
  date date,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 6. 活动记录
create table if not exists activity_records (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references children(id) on delete cascade,
  activity_name text,
  date date,
  role text,
  description text,
  photo_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 7. 获奖成就
create table if not exists achievements (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references children(id) on delete cascade,
  title text,
  description text,
  date date,
  photo_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 8. 照片库
create table if not exists photo_records (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references children(id) on delete cascade,
  photo_url text not null,
  caption text,
  category text default 'general',
  taken_date date,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 9. 家长留言
create table if not exists parent_messages (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid references children(id) on delete cascade,
  sender_name text,
  relationship text,
  message text,
  date date,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============================================
-- 索引优化
-- ============================================
create index if not exists idx_timeline_child on growth_timeline(child_id);
create index if not exists idx_course_child on course_records(child_id);
create index if not exists idx_comment_child on teacher_comments(child_id);
create index if not exists idx_activity_child on activity_records(child_id);
create index if not exists idx_achievement_child on achievements(child_id);
create index if not exists idx_photo_child on photo_records(child_id);
create index if not exists idx_message_child on parent_messages(child_id);

-- ============================================
-- 安全策略 (RLS)
-- ============================================
alter table children enable row level security;
alter table growth_timeline enable row level security;
alter table course_records enable row level security;
alter table teacher_comments enable row level security;
alter table activity_records enable row level security;
alter table achievements enable row level security;
alter table photo_records enable row level security;
alter table parent_messages enable row level security;

-- 管理员（认证用户）完全访问
create policy "管理员完全访问children" on children for all using (auth.role() = 'authenticated');
create policy "管理员完全访问timeline" on growth_timeline for all using (auth.role() = 'authenticated');
create policy "管理员完全访问course" on course_records for all using (auth.role() = 'authenticated');
create policy "管理员完全访问comment" on teacher_comments for all using (auth.role() = 'authenticated');
create policy "管理员完全访问activity" on activity_records for all using (auth.role() = 'authenticated');
create policy "管理员完全访问achievement" on achievements for all using (auth.role() = 'authenticated');
create policy "管理员完全访问photo" on photo_records for all using (auth.role() = 'authenticated');
create policy "管理员完全访问message" on parent_messages for all using (auth.role() = 'authenticated');

-- 公开只读访问（用于分享页面）
create policy "公开读取children" on children for select using (true);
create policy "公开读取timeline" on growth_timeline for select using (true);
create policy "公开读取course" on course_records for select using (true);
create policy "公开读取comment" on teacher_comments for select using (true);
create policy "公开读取activity" on activity_records for select using (true);
create policy "公开读取achievement" on achievements for select using (true);
create policy "公开读取photo" on photo_records for select using (true);
create policy "公开读取message" on parent_messages for select using (true);

-- ============================================
-- 自动生成分享令牌
-- ============================================
create or replace function generate_share_token()
returns trigger as $$
begin
  if new.share_token is null then
    new.share_token = substr(md5(random()::text || new.name || now()::text), 1, 10);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_generate_token
  before insert on children
  for each row execute function generate_share_token();

-- ============================================
-- 自动更新 updated_at
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_updated_at
  before update on children
  for each row execute function update_updated_at();

-- ============================================
-- 存储桶（用于照片上传）
-- ============================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- 存储桶策略：认证用户可上传
create policy "认证用户上传照片" on storage.objects
  for insert with check (auth.role() = 'authenticated' and bucket_id = 'photos');

-- 所有人可查看照片
create policy "公开查看照片" on storage.objects
  for select using (bucket_id = 'photos');

-- 认证用户可删除自己的照片
create policy "认证用户删除照片" on storage.objects
  for delete using (auth.role() = 'authenticated' and bucket_id = 'photos');

-- ============================================
-- 便捷查询函数
-- ============================================
-- 获取孩子的完整档案
create or replace function get_child_full_profile(p_child_id uuid)
returns json
language plpgsql
security definer
as $func$
declare
  v_child json;
  v_timeline json;
  v_courses json;
  v_comments json;
  v_activities json;
  v_achievements json;
  v_photos json;
  v_messages json;
begin
  select row_to_json(c.*) into v_child from children c where c.id = p_child_id;

  select coalesce(json_agg(row_to_json(t.*)), '[]'::json) into v_timeline
    from (select * from growth_timeline where child_id = p_child_id order by sort_order, event_date desc) t;

  select coalesce(json_agg(row_to_json(r.*)), '[]'::json) into v_courses
    from (select * from course_records where child_id = p_child_id order by sort_order, date desc) r;

  select coalesce(json_agg(row_to_json(r.*)), '[]'::json) into v_comments
    from (select * from teacher_comments where child_id = p_child_id order by sort_order, date desc) r;

  select coalesce(json_agg(row_to_json(r.*)), '[]'::json) into v_activities
    from (select * from activity_records where child_id = p_child_id order by sort_order, date desc) r;

  select coalesce(json_agg(row_to_json(r.*)), '[]'::json) into v_achievements
    from (select * from achievements where child_id = p_child_id order by sort_order, date desc) r;

  select coalesce(json_agg(row_to_json(r.*)), '[]'::json) into v_photos
    from (select * from photo_records where child_id = p_child_id order by sort_order, taken_date desc) r;

  select coalesce(json_agg(row_to_json(r.*)), '[]'::json) into v_messages
    from (select * from parent_messages where child_id = p_child_id order by sort_order, date desc) r;

  return json_build_object(
    'child', v_child,
    'timeline', v_timeline,
    'courses', v_courses,
    'comments', v_comments,
    'activities', v_activities,
    'achievements', v_achievements,
    'photos', v_photos,
    'messages', v_messages
  );
end;
$func$;

-- 通过分享令牌获取孩子档案
create or replace function get_child_by_token(p_token text)
returns json
language plpgsql
security definer
as $func$
declare
  v_child_id uuid;
begin
  select id into v_child_id from children where share_token = p_token;
  if v_child_id is null then
    return null;
  end if;
  return get_child_full_profile(v_child_id);
end;
$func$;
