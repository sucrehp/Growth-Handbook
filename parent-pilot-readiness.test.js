'use strict';

const assert = require('assert');
const fs = require('fs');

const migration = fs.readFileSync('supabase-parent-access-pilot.sql', 'utf8');
const verification = fs.readFileSync('supabase-parent-access-verification.sql', 'utf8');
const runbook = fs.readFileSync('PARENT-PILOT-DEPLOYMENT.md', 'utf8');
const child = fs.readFileSync('child.html', 'utf8');
const lib = fs.readFileSync('api/_lib.js', 'utf8');
const me = fs.readFileSync('api/edu-me.js', 'utf8');

assert.match(migration, /create or replace function public\.is_active_staff/);
assert.match(migration, /submit_parent_contribution_by_token[\s\S]*account\.user_id = auth\.uid\(\)[\s\S]*account\.can_upload_growth/);
assert.match(migration, /cancel_parent_contribution_by_token[\s\S]*upload\.parent_openid = auth\.uid\(\)::text/);
assert.match(migration, /from public, anon, authenticated;[\s\S]*to authenticated;/);
assert.match(migration, /active staff uploads photos/);
assert.doesNotMatch(migration, /drop\s+table|truncate/i);

const withoutComments = verification.replace(/--.*$/gm, '');
const withoutStrings = withoutComments.replace(/'(?:''|[^'])*'/g, "''");
assert.match(withoutStrings.trim(), /^with\b/i);
assert.doesNotMatch(withoutStrings, /\b(create|alter|drop|grant|revoke|truncate)\b|\binsert\s+into\b|\bdelete\s+from\b|\bupdate\s+[a-z_]/i);
for (const check of [
  'authorization_tables_rls_enabled', 'authorization_self_read_only',
  'legacy_tables_staff_only_policy', 'broad_authenticated_child_policy_absent',
  'parent_submit_authenticated_only', 'parent_cancel_authenticated_only',
  'token_portfolio_read_preserved', 'photo_storage_staff_write_only', 'OVERALL'
]) assert.ok(verification.includes(check), `missing verification check ${check}`);

assert.match(child, /家长登录后补充/);
assert.match(child, /if \(!parentContributionAllowed\)/);
assert.match(child, /db\.auth\.setSession/);
assert.match(lib, /legacyStaffBoundary: true/);
assert.match(me, /LEGACY_PRE_PARENT_PILOT/);

for (const heading of ['权限矩阵','Production 启用顺序','第一批试点建议','必测场景','失败处理','当前边界']) {
  assert.ok(runbook.includes(heading), `runbook missing ${heading}`);
}
assert.match(runbook, /OVERALL = PASS/);
assert.match(runbook, /公众 Email Signups \/ User Signups 已关闭/);
assert.match(runbook, /PARENT_APP_URL=https:\/\/growth-handbook-phi\.vercel\.app\/parent/);

console.log('GP-L6.3 PRIVACY MATRIX AND PILOT READINESS PASS');
