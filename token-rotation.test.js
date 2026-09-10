'use strict';

const assert = require('assert');
const fs = require('fs');

const sql = fs.readFileSync('supabase-rotate-child-share-token.sql', 'utf8');
const adminHtml = fs.readFileSync('admin.html', 'utf8');
const normalizedSql = sql.replace(/\s+/g, ' ').toLowerCase();

assert.match(normalizedSql, /begin;/);
assert.match(normalizedSql, /commit;/);
assert.match(normalizedSql, /create or replace function public\.rotate_child_share_token\(p_child_id uuid\)/);
assert.match(normalizedSql, /returns text language plpgsql security invoker/);
assert.match(normalizedSql, /set search_path = public, pg_temp/);
assert.match(normalizedSql, /coalesce\(auth\.role\(\), ''\) <> 'authenticated'/);
assert.match(normalizedSql, /replace\(gen_random_uuid\(\)::text, '-', ''\)/);
assert.equal((normalizedSql.match(/gen_random_uuid\(\)/g) || []).length, 2);
assert.doesNotMatch(normalizedSql, /math\.random|random\(\)|clock_timestamp|extract\s*\(\s*epoch|child.*name|birthday/);
assert.match(normalizedSql, /update public\.children set share_token = v_new_token, updated_at = now\(\) where id = p_child_id returning share_token into v_new_token/);
assert.match(normalizedSql, /if not found then raise exception 'child not found'/);
assert.match(normalizedSql, /revoke all on function public\.rotate_child_share_token\(uuid\) from public, anon, authenticated/);
assert.match(normalizedSql, /grant execute on function public\.rotate_child_share_token\(uuid\) to authenticated/);
assert.doesNotMatch(sql, /drop\s+(table|function)|truncate|delete\s+from|alter\s+table/i);

assert.match(adminHtml, />重新生成分享链接<\/button>/);
assert.match(adminHtml, /confirm\('重新生成后，旧分享链接将立即失效，是否继续？'\)/);
assert.match(adminHtml, /db\.rpc\('rotate_child_share_token', \{\s*p_child_id: currentChild\.id/);
assert.match(adminHtml, /currentChild\.share_token = newToken/);
assert.match(adminHtml, /child\.share_token = newToken/);
assert.match(adminHtml, /input\.value = `\$\{location\.origin\}\/child\.html\?t=\$\{encodeURIComponent\(newToken\)\}`/);
assert.match(adminHtml, /copyCurrentShareLink\(\)/);

const rotationFunction = adminHtml.slice(
  adminHtml.indexOf('async function rotateShareToken()'),
  adminHtml.indexOf('function editShare(', adminHtml.indexOf('async function rotateShareToken()')),
);
assert.doesNotMatch(rotationFunction, /renderEditor\(|location\.reload|console\.(log|info|warn|error)/);
assert.match(rotationFunction, /toast\('分享链接已重新生成，旧链接已失效', 'success'\)/);
assert.match(rotationFunction, /toast\('重新生成失败: '/);

console.log('GP-L5.1E TOKEN ROTATION STATIC VERIFICATION PASS');
console.log('secure token source: 2 x gen_random_uuid');
console.log('anonymous execution: REVOKED');
console.log('authenticated execution: GRANTED');
