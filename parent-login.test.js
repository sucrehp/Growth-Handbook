'use strict';

const assert = require('assert');
const fs = require('fs');

const parentHtml = fs.readFileSync('parent.html', 'utf8');
const parentHandler = fs.readFileSync('server/handlers/parent-portal.js', 'utf8');
const lib = fs.readFileSync('api/_lib.js', 'utf8');
const eduHtml = fs.readFileSync('edu.html', 'utf8');
const eduJs = fs.readFileSync('edu.js', 'utf8');
const sql = fs.readFileSync('supabase-parent-access-pilot.sql', 'utf8');
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

assert.match(parentHtml, /家长登录/);
assert.match(parentHtml, /我的孩子/);
assert.match(parentHtml, /grant_type=password/);
assert.match(parentHtml, /grant_type=refresh_token/);
assert.match(parentHtml, /hash\.get\('type'\)==='invite'/);
assert.match(parentHtml, /auth\/v1\/user.*method:'PUT'/s);
assert.match(parentHtml, /minlength="8"/);
assert.doesNotMatch(parentHtml, /signUp\(/);
assert.doesNotMatch(parentHtml, /service_role|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);

assert.match(lib, /async function requireParent\(req\)/);
assert.match(lib, /parent_accounts\?select=.*user_id=eq/);
assert.match(parentHandler, /const \{ user, bindings \} = await requireParent\(req\)/);
assert.match(parentHandler, /childIds = \[\.\.\.new Set/);
assert.match(parentHandler, /portfolioUrl: `\/child\?t=/);
assert.doesNotMatch(parentHandler, /parent_phone|parent_wechat|family_address|emergency_contact|notes/);
assert.match(parentHandler, /editBasic: false/);

assert.match(eduHtml, /员工 \/ 家长邮箱/);
assert.match(eduJs, /if\(state\.me\.accountType==="parent"\)\{location\.href="\/parent"/);
assert.match(sql, /using \(user_id = auth\.uid\(\)\)/);
assert.match(sql, /revoke insert, update, delete on table public\.staff_profiles, public\.parent_accounts from authenticated/i);

const rewrites = new Map(vercel.rewrites.map(item => [item.source, item.destination]));
assert.equal(rewrites.get('/parent'), '/parent.html');
assert.equal(rewrites.get('/api/parent-portal'), '/api/operations?__operation=parent-portal');

console.log('GP-L6.2 PARENT LOGIN AND MY CHILDREN STATIC VERIFICATION PASS');
