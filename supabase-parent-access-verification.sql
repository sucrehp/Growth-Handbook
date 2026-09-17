-- GP-L6 controlled parent-access pilot / Production final verification.
-- READ ONLY: one result set, SELECT only.

with governed_tables(table_name) as (
  values
    ('children'), ('growth_timeline'), ('course_records'), ('teacher_comments'),
    ('activity_records'), ('achievements'), ('photo_records'), ('parent_messages'),
    ('parent_uploads'), ('parent_replies'), ('parent_bindings'),
    ('growth_record_metadata'), ('parent_contribution_metadata')
),
checks(check_name, status, detail) as (
  select 'staff_profiles_exists',
    case when to_regclass('public.staff_profiles') is not null then 'PASS' else 'FAIL' end,
    coalesce(to_regclass('public.staff_profiles')::text, 'missing')
  union all
  select 'parent_accounts_exists',
    case when to_regclass('public.parent_accounts') is not null then 'PASS' else 'FAIL' end,
    coalesce(to_regclass('public.parent_accounts')::text, 'missing')
  union all
  select 'authorization_tables_rls_enabled',
    case when count(*) = 2 and bool_and(c.relrowsecurity) then 'PASS' else 'FAIL' end,
    format('%s/2 tables have RLS enabled', count(*) filter (where c.relrowsecurity))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('staff_profiles','parent_accounts')
  union all
  select 'is_active_staff_function',
    case when p.oid is not null and p.prosecdef then 'PASS' else 'FAIL' end,
    case when p.oid is null then 'missing' when p.prosecdef then 'SECURITY DEFINER' else 'not SECURITY DEFINER' end
  from (select to_regprocedure('public.is_active_staff()') oid) expected
  left join pg_proc p on p.oid = expected.oid
  union all
  select 'authorization_self_read_only',
    case when
      exists (select 1 from pg_policies where schemaname='public' and tablename='staff_profiles' and policyname='authenticated read own staff profile' and cmd='SELECT')
      and exists (select 1 from pg_policies where schemaname='public' and tablename='parent_accounts' and policyname='authenticated read own parent accounts' and cmd='SELECT')
      and not exists (select 1 from pg_policies where schemaname='public' and tablename in ('staff_profiles','parent_accounts') and cmd in ('ALL','INSERT','UPDATE','DELETE') and 'authenticated'=any(roles))
      then 'PASS' else 'FAIL' end,
    'self SELECT exists; authenticated self-grant write policies absent'
  union all
  select 'parent_accounts_authenticated_write_privileges_absent',
    case when not has_table_privilege('authenticated','public.parent_accounts','INSERT,UPDATE,DELETE') then 'PASS' else 'FAIL' end,
    'INSERT/UPDATE/DELETE table privileges must be absent'
  union all
  select 'legacy_tables_staff_only_policy',
    case when count(*) = 13 then 'PASS' else 'FAIL' end,
    format('%s/13 governed tables have active-staff ALL policy', count(*))
  from governed_tables governed
  where exists (
    select 1 from pg_policies policy
    where policy.schemaname='public'
      and policy.tablename=governed.table_name
      and policy.policyname='active staff manages ' || governed.table_name
      and policy.cmd='ALL'
      and 'authenticated'=any(policy.roles)
      and coalesce(policy.qual,'') like '%is_active_staff%'
      and coalesce(policy.with_check,'') like '%is_active_staff%'
  )
  union all
  select 'broad_authenticated_child_policy_absent',
    case when count(*) = 0 then 'PASS' else 'FAIL' end,
    format('%s broad authenticated policies remain', count(*))
  from pg_policies policy
  join governed_tables governed on governed.table_name = policy.tablename
  where policy.schemaname='public'
    and 'authenticated'=any(policy.roles)
    and policy.policyname <> 'active staff manages ' || governed.table_name
    and (
      coalesce(policy.qual,'') ~* 'auth\.role\(\).*authenticated'
      or coalesce(policy.with_check,'') ~* 'auth\.role\(\).*authenticated'
      or coalesce(policy.qual,'') = 'true'
      or coalesce(policy.with_check,'') = 'true'
    )
  union all
  select 'anon_direct_child_table_privileges_absent',
    case when bool_and(not has_table_privilege('anon', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE')) then 'PASS' else 'FAIL' end,
    'anon has no direct CRUD on governed child tables'
  from governed_tables
  union all
  select 'parent_submit_authenticated_only',
    case when
      has_function_privilege('authenticated','public.submit_parent_contribution_by_token(text,text,date,text,text,text[],text)','EXECUTE')
      and not has_function_privilege('anon','public.submit_parent_contribution_by_token(text,text,date,text,text,text[],text)','EXECUTE')
      and not exists (
        select 1 from pg_proc function_definition
        cross join lateral aclexplode(coalesce(function_definition.proacl, acldefault('f', function_definition.proowner))) acl
        where function_definition.oid=to_regprocedure('public.submit_parent_contribution_by_token(text,text,date,text,text,text[],text)')
          and acl.grantee=0 and acl.privilege_type='EXECUTE'
      )
      then 'PASS' else 'FAIL' end,
    'authenticated execute present; anon/public execute absent'
  union all
  select 'parent_cancel_authenticated_only',
    case when
      has_function_privilege('authenticated','public.cancel_parent_contribution_by_token(text,uuid)','EXECUTE')
      and not has_function_privilege('anon','public.cancel_parent_contribution_by_token(text,uuid)','EXECUTE')
      and not exists (
        select 1 from pg_proc function_definition
        cross join lateral aclexplode(coalesce(function_definition.proacl, acldefault('f', function_definition.proowner))) acl
        where function_definition.oid=to_regprocedure('public.cancel_parent_contribution_by_token(text,uuid)')
          and acl.grantee=0 and acl.privilege_type='EXECUTE'
      )
      then 'PASS' else 'FAIL' end,
    'authenticated execute present; anon/public execute absent'
  union all
  select 'token_portfolio_read_preserved',
    case when
      to_regprocedure('public.get_growth_portfolio_by_token(text)') is not null
      and has_function_privilege('anon','public.get_growth_portfolio_by_token(text)','EXECUTE')
      then 'PASS' else 'FAIL' end,
    'share-token portfolio RPC remains available to anon'
  union all
  select 'photo_storage_staff_write_only',
    case when
      exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='active staff uploads photos' and cmd='INSERT' and coalesce(with_check,'') like '%is_active_staff%')
      and exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='active staff deletes photos' and cmd='DELETE' and coalesce(qual,'') like '%is_active_staff%')
      and not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname in ('认证用户上传照片','认证用户删除照片'))
      then 'PASS' else 'FAIL' end,
    'photos write policies require active staff; legacy authenticated-only policies absent'
),
result as (
  select check_name, status, detail, 0 sort_order from checks
  union all
  select 'OVERALL',
    case when bool_and(status='PASS') then 'PASS' else 'FAIL' end,
    case when bool_and(status='PASS') then 'all production-verifiable checks passed' else 'one or more checks failed' end,
    1
  from checks
)
select check_name, status, detail
from result
order by sort_order, check_name;
