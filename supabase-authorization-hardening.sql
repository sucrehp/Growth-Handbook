-- Growth Portfolio Lite V1 / GP-L2M-AUTH
-- AUTHORIZATION_HARDENING_ONLY: existing authorization rows remain unchanged.

begin;

-- These relationships are authorization sources. Only trusted backend code using
-- service_role may create, change, or delete them. Authenticated users retain the
-- minimum self-scoped reads needed for account and navigation diagnostics.

alter table public.staff_profiles enable row level security;
revoke all on table public.staff_profiles from anon;
revoke insert, update, delete on table public.staff_profiles from authenticated;
grant select on table public.staff_profiles to authenticated;

drop policy if exists "authenticated_manage_staff_profiles" on public.staff_profiles;
drop policy if exists "authenticated read own staff profile" on public.staff_profiles;
create policy "authenticated read own staff profile"
  on public.staff_profiles for select to authenticated
  using (id = auth.uid());

alter table public.staff_child_access enable row level security;
revoke all on table public.staff_child_access from anon;
revoke insert, update, delete on table public.staff_child_access from authenticated;
grant select on table public.staff_child_access to authenticated;

drop policy if exists "authenticated_manage_staff_child_access" on public.staff_child_access;
drop policy if exists "authenticated read own child access" on public.staff_child_access;
create policy "authenticated read own child access"
  on public.staff_child_access for select to authenticated
  using (staff_id = auth.uid());

alter table public.parent_accounts enable row level security;
revoke all on table public.parent_accounts from anon;
revoke insert, update, delete on table public.parent_accounts from authenticated;
grant select on table public.parent_accounts to authenticated;

drop policy if exists "authenticated_manage_parent_accounts" on public.parent_accounts;
drop policy if exists "authenticated read own parent accounts" on public.parent_accounts;
create policy "authenticated read own parent accounts"
  on public.parent_accounts for select to authenticated
  using (user_id = auth.uid());

commit;
