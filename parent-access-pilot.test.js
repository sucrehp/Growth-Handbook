'use strict';

const assert = require('assert');
const fs = require('fs');

const lib = fs.readFileSync('api/_lib.js', 'utf8');
const me = fs.readFileSync('api/edu-me.js', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');
const guardian = fs.readFileSync('server/handlers/guardian-access.js', 'utf8');
const sql = fs.readFileSync('supabase-parent-access-pilot.sql', 'utf8');
const operations = fs.readFileSync('api/operations.js', 'utf8');
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const normalized = sql.replace(/\s+/g, ' ').toLowerCase();

assert.match(lib, /async function requireStaff\(req\)/);
assert.match(lib, /staff_profiles\?select=.*status=eq\.active/);
assert.match(lib, /isMissingTableError\(error, "staff_profiles"\)/);
assert.match(lib, /legacyStaffBoundary: true/);
assert.match(lib, /async function inviteAuthUser\(email, redirectTo\)/);
assert.match(lib, /Authorization: `Bearer \$\{SECRET_KEY\}`/);

const parentLookup = me.indexOf('parents = await db(`parent_accounts');
const bootstrap = me.indexOf('if (!rows.length && !parents.length)');
assert.ok(parentLookup >= 0 && parentLookup < bootstrap, 'parent bindings must be checked before first-owner bootstrap');
assert.match(me, /accountType: "parent"/);
assert.match(me, /accountType: "staff"/);
assert.match(me, /authorizationMode: "LEGACY_PRE_PARENT_PILOT"/);

for (const file of [
  'server/handlers/children.js', 'server/handlers/photos.js',
  'server/handlers/parent-contribution-review.js', 'server/handlers/parent-contribution-media.js',
  'api/archive-photo.js', 'api/edu-core.js', 'api/edu-overview.js',
  'api/marketing-drafts.js', 'api/marketing-materials.js',
  'api/marketing-review.js', 'api/marketing-schedules.js', 'api/parse.js'
]) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /requireStaff/, `${file} must require an active staff profile`);
}

assert.match(guardian, /const staff = await requireStaff\(req\)/);
assert.match(guardian, /can_edit_basic: false/);
assert.match(guardian, /assertNotStaff/);
assert.match(guardian, /inviteAuthUser\(email, parentRedirectUrl\(\)\)/);
assert.doesNotMatch(guardian, /console\.log/);
assert.doesNotMatch(admin, /auth\.signUp\(/);
assert.match(admin, /监护人权限/);
assert.match(admin, /邀请并绑定家长/);
assert.match(admin, /await ensureStaffSession\(\)/);

assert.match(operations, /"guardian-access": require/);
const rewrite = vercel.rewrites.find(item => item.source === '/api/guardian-access');
assert.equal(rewrite.destination, '/api/operations?__operation=guardian-access');

assert.match(normalized, /begin;/);
assert.match(normalized, /commit;/);
assert.match(normalized, /create table if not exists public\.staff_profiles/);
assert.match(normalized, /create table if not exists public\.parent_accounts/);
assert.match(normalized, /can_edit_basic boolean not null default false/);
assert.match(normalized, /create or replace function public\.is_active_staff\(\)/);
assert.match(normalized, /where staff\.id = auth\.uid\(\) and staff\.status = 'active'/);
assert.match(normalized, /revoke insert, update, delete on table public\.staff_profiles, public\.parent_accounts from authenticated/);
assert.match(normalized, /using \(user_id = auth\.uid\(\)\)/);
assert.match(normalized, /active staff manages/);
assert.match(normalized, /public\.is_active_staff\(\)/);
assert.match(normalized, /active staff uploads photos/);
assert.match(normalized, /active staff deletes photos/);

for (const table of [
  'children', 'growth_timeline', 'course_records', 'teacher_comments',
  'activity_records', 'achievements', 'photo_records', 'parent_messages',
  'parent_uploads', 'parent_replies', 'parent_bindings',
  'growth_record_metadata', 'parent_contribution_metadata'
]) {
  assert.ok(normalized.includes(`'${table}'`), `${table} must be in the staff-only policy set`);
}

assert.doesNotMatch(sql, /drop\s+table/i);
assert.doesNotMatch(sql, /truncate/i);
assert.doesNotMatch(sql, /delete\s+from\s+public\.(children|growth_timeline|course_records|teacher_comments|activity_records|achievements|photo_records|parent_messages)/i);
assert.doesNotMatch(sql, /update\s+public\.(children|growth_timeline|course_records|teacher_comments|activity_records|achievements|photo_records|parent_messages)/i);
assert.doesNotMatch(sql, /get_growth_portfolio_by_token/);

console.log('GP-L6.1 PARENT ACCESS PILOT STATIC VERIFICATION PASS');
