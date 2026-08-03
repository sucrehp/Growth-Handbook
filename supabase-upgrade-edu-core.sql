-- EDU 教培运营智能体核心底座（第一阶段）
-- 范围：组织权限、招生客户、试听、合同、收费、课时账户、任务与审计。
-- 排课、点名和自动消课按要求留到最后阶段。

create extension if not exists "uuid-ossp";

create table if not exists public.campuses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text unique,
  address text,
  phone text,
  manager_name text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  display_name text,
  phone text,
  role text not null default 'teacher'
    check (role in ('owner','campus_manager','finance','consultant','teacher','frontdesk')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_profiles
  add column if not exists module_permissions jsonb not null default '{}'::jsonb;

create table if not exists public.staff_child_access (
  id uuid primary key default uuid_generate_v4(),
  staff_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  access_level text not null default 'edit'
    check (access_level in ('view','edit','manage')),
  created_at timestamptz not null default now(),
  unique (staff_id, child_id)
);

create table if not exists public.parent_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  relation text not null default '家长',
  is_primary boolean not null default false,
  can_edit_basic boolean not null default true,
  can_reply_comments boolean not null default true,
  can_upload_growth boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  unique (user_id, child_id)
);

create table if not exists public.leads (
  id uuid primary key default uuid_generate_v4(),
  campus_id uuid references public.campuses(id) on delete set null,
  parent_name text not null,
  phone text not null,
  child_name text,
  child_age numeric(4,1),
  source text,
  interested_course text,
  intention_level text not null default 'medium'
    check (intention_level in ('high','medium','low')),
  stage text not null default 'new'
    check (stage in ('new','contacted','trial_booked','trial_done','won','lost')),
  owner_id uuid references auth.users(id) on delete set null,
  next_followup_at timestamptz,
  lost_reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_followups (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  followup_type text not null default 'wechat'
    check (followup_type in ('wechat','phone','visit','other')),
  content text not null,
  next_followup_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.trial_bookings (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  course_name text not null,
  trial_at timestamptz not null,
  teacher_name text,
  status text not null default 'booked'
    check (status in ('booked','arrived','completed','cancelled','no_show')),
  result text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.edu_contracts (
  id uuid primary key default uuid_generate_v4(),
  contract_no text not null unique,
  campus_id uuid references public.campuses(id) on delete set null,
  child_id uuid references public.children(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  guardian_name text not null,
  guardian_phone text,
  course_category text not null,
  contract_type text not null default 'new'
    check (contract_type in ('new','renewal','upgrade','transfer')),
  total_lessons numeric(10,2) not null check (total_lessons >= 0),
  gift_lessons numeric(10,2) not null default 0 check (gift_lessons >= 0),
  contract_amount numeric(12,2) not null check (contract_amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  valid_from date,
  valid_until date,
  sign_status text not null default 'draft'
    check (sign_status in ('draft','pending','signed','voided','expired')),
  signed_at timestamptz,
  signed_file_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null references public.edu_contracts(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text,
  paid_at timestamptz not null default now(),
  transaction_no text,
  status text not null default 'confirmed'
    check (status in ('pending','confirmed','refunded','voided')),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_accounts (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null unique references public.edu_contracts(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  course_category text not null,
  purchased_lessons numeric(10,2) not null default 0,
  gift_lessons numeric(10,2) not null default 0,
  consumed_lessons numeric(10,2) not null default 0,
  frozen_lessons numeric(10,2) not null default 0,
  valid_from date,
  valid_until date,
  status text not null default 'active'
    check (status in ('active','frozen','expired','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_transactions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.lesson_accounts(id) on delete cascade,
  transaction_type text not null
    check (transaction_type in ('purchase','gift','consume','return','freeze','unfreeze','adjust')),
  lessons numeric(10,2) not null,
  balance_after numeric(10,2) not null,
  reference_type text,
  reference_id uuid,
  reason text,
  idempotency_key text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.edu_tasks (
  id uuid primary key default uuid_generate_v4(),
  campus_id uuid references public.campuses(id) on delete set null,
  task_type text not null default 'general',
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('urgent','high','normal','low')),
  status text not null default 'todo'
    check (status in ('todo','doing','waiting','done','cancelled')),
  assignee_id uuid references auth.users(id) on delete set null,
  related_type text,
  related_id uuid,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.edu_audit_logs (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- Signed contracts automatically create or refresh their lesson account.
create or replace function public.sync_lesson_account_from_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sign_status = 'signed' then
    insert into public.lesson_accounts (
      child_id,
      contract_id,
      course_category,
      purchased_lessons,
      gifted_lessons,
      consumed_lessons,
      frozen_lessons,
      valid_from,
      valid_until,
      status
    )
    values (
      new.child_id,
      new.id,
      new.course_category,
      new.total_lessons,
      new.gift_lessons,
      0,
      0,
      coalesce(new.signed_at::date, current_date),
      new.valid_until,
      'active'
    )
    on conflict (contract_id) do update
    set child_id = excluded.child_id,
        course_category = excluded.course_category,
        purchased_lessons = excluded.purchased_lessons,
        gifted_lessons = excluded.gifted_lessons,
        valid_from = excluded.valid_from,
        valid_until = excluded.valid_until,
        status = excluded.status,
        updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_lesson_account_from_contract on public.edu_contracts;
create trigger trg_sync_lesson_account_from_contract
after insert or update of sign_status, total_lessons, gift_lessons, valid_until, course_category
on public.edu_contracts
for each row
execute function public.sync_lesson_account_from_contract();

create index if not exists idx_leads_stage_followup on public.leads(stage,next_followup_at);
create index if not exists idx_staff_child_access_staff on public.staff_child_access(staff_id,child_id);
create index if not exists idx_parent_accounts_user on public.parent_accounts(user_id,child_id);
create index if not exists idx_leads_phone on public.leads(phone);
create index if not exists idx_followups_lead on public.lead_followups(lead_id,created_at desc);
create index if not exists idx_trials_time on public.trial_bookings(trial_at,status);
create index if not exists idx_contracts_child on public.edu_contracts(child_id,created_at desc);
create index if not exists idx_contracts_status on public.edu_contracts(sign_status,valid_until);
create index if not exists idx_payments_contract on public.payments(contract_id,paid_at desc);
create index if not exists idx_lesson_accounts_child on public.lesson_accounts(child_id,status);
create index if not exists idx_lesson_transactions_account on public.lesson_transactions(account_id,created_at desc);
create index if not exists idx_edu_tasks_due on public.edu_tasks(status,due_at);

alter table public.campuses enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_child_access enable row level security;
alter table public.parent_accounts enable row level security;
alter table public.leads enable row level security;
alter table public.lead_followups enable row level security;
alter table public.trial_bookings enable row level security;
alter table public.edu_contracts enable row level security;
alter table public.payments enable row level security;
alter table public.lesson_accounts enable row level security;
alter table public.lesson_transactions enable row level security;
alter table public.edu_tasks enable row level security;
alter table public.edu_audit_logs enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'campuses','staff_profiles','leads','lead_followups','trial_bookings',
    'edu_contracts','payments','lesson_accounts','lesson_transactions',
    'edu_tasks','edu_audit_logs','staff_child_access','parent_accounts'
  ]
  loop
    execute format('drop policy if exists "authenticated_manage_%s" on public.%I', table_name, table_name);
    execute format(
      'create policy "authenticated_manage_%s" on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      table_name, table_name
    );
  end loop;
end $$;

insert into public.campuses (name,code,status)
select '阿墨逗儿童成长中心','MAIN','active'
where not exists (select 1 from public.campuses where code='MAIN');

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'campuses','staff_profiles','leads','lead_followups','trial_bookings',
    'edu_contracts','payments','lesson_accounts','lesson_transactions',
    'edu_tasks','edu_audit_logs','staff_child_access','parent_accounts'
  )
order by table_name;
