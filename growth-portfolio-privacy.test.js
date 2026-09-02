'use strict';

const assert = require('assert');
const fs = require('fs');

const sql = fs.readFileSync('supabase-growth-portfolio-privacy.sql', 'utf8');
const childHtml = fs.readFileSync('child.html', 'utf8');
const adminHtml = fs.readFileSync('admin.html', 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

const legacyTables = [
  'children', 'growth_timeline', 'course_records', 'teacher_comments',
  'activity_records', 'achievements', 'photo_records', 'parent_messages',
  'parent_uploads', 'parent_replies', 'parent_bindings'
];

function compact(value) {
  return value.replace(/\s+/g, ' ').toLowerCase();
}

const normalized = compact(sql);

assert.match(normalized, /begin;/);
assert.match(normalized, /commit;/);
assert.match(normalized, /create or replace function public\.get_growth_portfolio_by_token\(p_token text\)/);
assert.match(normalized, /security definer set search_path = public, pg_temp/);
assert.match(normalized, /grant execute on function public\.get_growth_portfolio_by_token\(text\) to anon, authenticated/);
assert.match(normalized, /revoke all on function public\.get_child_full_profile\(uuid\) from public, anon, authenticated/);
assert.match(normalized, /revoke all on function public\.get_child_by_token\(text\) from public, anon, authenticated/);

for (const table of legacyTables) {
  assert.match(normalized, new RegExp(`public\\.${table}`), `${table} must be governed`);
}

assert.match(normalized, /revoke all privileges on table[\s\S]*from anon/);
assert.match(normalized, /revoke all privileges on table[\s\S]*from public/);
assert.match(normalized, /grant select, insert, update, delete on table[\s\S]*to authenticated/);
assert.equal((normalized.match(/where child_id = v_child_id/g) || []).length >= 8, true);
assert.match(normalized, /where c\.share_token = nullif\(trim\(coalesce\(p_token, ''\)\), ''\)/);
assert.match(normalized, /if v_child_id is null then return null/);
assert.match(normalized, /where child_id = v_child_id and status = 'published'/);
assert.match(normalized, /visible_to_parent/);

for (const key of ['child', 'timeline', 'courses', 'comments', 'activities', 'achievements', 'photos', 'messages', 'metadata']) {
  assert.match(normalized, new RegExp(`'${key}', \\(`), `token projection must include ${key}`);
}

for (const forbiddenField of ['parent_name', 'parent_phone', 'parent_wechat', 'family_address', 'emergency_contact', 'emergency_phone', "'share_token', c.share_token", "'notes', c.notes"]) {
  assert.equal(normalized.includes(forbiddenField), false, `public projection leaked ${forbiddenField}`);
}

assert.match(childHtml, /db\.rpc\('get_growth_portfolio_by_token', \{ p_token: token \}\)/);
assert.doesNotMatch(childHtml, /db\.rpc\('get_child_by_token'/);
assert.doesNotMatch(childHtml, /db\.rpc\('get_child_full_profile'/);
assert.doesNotMatch(childHtml, /db\.rpc\('get_growth_record_metadata_by_token'/);
assert.doesNotMatch(childHtml, /db\.from\('(children|growth_timeline|course_records|teacher_comments|activity_records|achievements|photo_records|parent_messages|parent_uploads|parent_replies|parent_bindings)'/);

assert.match(adminHtml, /auth\.signInWithPassword/);
assert.match(adminHtml, /db\.from\('children'\)\.select/);
assert.match(adminHtml, /db\.from\(table\)\.insert/);
assert.match(adminHtml, /db\.from\(table\)\.update/);
assert.match(adminHtml, /db\.from\(table\)\.delete/);
assert.match(childHtml, /params\.get\('demo'\) === '1'/);
assert.match(childHtml, /GrowthRecordAdapter\.adaptLegacyProfile/);
assert.match(childHtml, /GrowthReportComposer\.buildReportModel/);

const deployedFunctionFiles = fs.readdirSync('api').filter(name => name.endsWith('.js'));
assert.equal(deployedFunctionFiles.length <= 12, true, 'Vercel Hobby deployment must stay within 12 function files');
const rewriteMap = new Map(vercelConfig.rewrites.map(rewrite => [rewrite.source, rewrite.destination]));
for (const operation of ['children', 'photos', 'parent-contribution-media', 'parent-contribution-review']) {
  assert.equal(rewriteMap.get(`/api/${operation}`), `/api/operations?__operation=${operation}`);
  assert.equal(fs.existsSync(`server/handlers/${operation}.js`), true);
}

for (const destructive of [/drop table/i, /truncate/i, /delete\s+from\s+public\.(children|growth_timeline|course_records|teacher_comments|activity_records|achievements|photo_records)/i, /update\s+public\.(children|growth_timeline|course_records|teacher_comments|activity_records|achievements|photo_records)/i]) {
  assert.doesNotMatch(sql, destructive);
}

console.log('GP-L5.1 PRIVACY STATIC VERIFICATION PASS');
console.log(`governed tables: ${legacyTables.length}`);
console.log('token projection: CHILD_SCOPED');
console.log('legacy anon direct read: REVOKED');
console.log('authenticated admin CRUD: PRESERVED');
