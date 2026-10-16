// Applies docs/backend/glorieta-schema.sql to an embedded Postgres (PGlite) with Supabase's roles and
// auth.uid() set up, then checks row level security, privileges and constraints.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const SQL = readFileSync(new URL('../docs/backend/glorieta-schema.sql', import.meta.url), 'utf8');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  insert into auth.users values ('${A}','a@example.test'), ('${B}','b@example.test');
`);
await db.exec(SQL); // must apply cleanly, exactly as written

const as = async (role, sub) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ''}', false); set role ${role};`);
};
const fails = async (label, sql, pattern) => {
  try { await db.exec(sql); } catch (e) {
    assert.match(String(e.message), pattern, `${label}: wrong error: ${e.message}`);
    console.log('  ok  ', label); return;
  }
  assert.fail(`${label}: expected an error but it succeeded`);
};
const rows = async (sql) => (await db.query(sql)).rows;
let n = 0; const ok = (label) => { n++; console.log('  ok  ', label); };

const card = `'{"due":"2026-10-20T00:00:00.000Z","reps":1}'::jsonb`;

console.log('as user A');
await as('authenticated', A);
await db.exec(`insert into glorieta.profiles (user_id, display_name) values ('${A}', 'Ana')`); ok('A creates own profile');
await db.exec(`insert into glorieta.progress values ('${A}','q1',${card},2,1,now()), ('${A}','q2',${card},1,1,now())`); ok('A inserts own progress');
await db.exec(`insert into glorieta.exam_results (user_id,taken_at,total,errors,unanswered,passed) values ('${A}','2026-10-01T10:00:00Z',30,2,0,true)`); ok('A inserts own exam result');
assert.equal((await rows(`select count(*)::int c from glorieta.progress`))[0].c, 2); ok('A sees exactly their own 2 progress rows');
await fails('A cannot insert a row for B', `insert into glorieta.progress values ('${B}','q9',${card},1,1,now())`, /row-level security/);
await fails('A cannot move own row to B (WITH CHECK)', `update glorieta.progress set user_id='${B}' where item_id='q1'`, /row-level security/);
await db.exec(`insert into glorieta.progress values ('${A}','q1',${card},5,4,now()) on conflict (user_id,item_id) do update set seen=excluded.seen, right_count=excluded.right_count, card=excluded.card, updated_at=excluded.updated_at`);
assert.equal((await rows(`select seen from glorieta.progress where item_id='q1'`))[0].seen, 5); ok('upsert on (user_id,item_id) updates A\'s own row');
await db.exec(`insert into glorieta.exam_results (user_id,taken_at,total,errors,unanswered,passed) values ('${A}','2026-10-01T10:00:00Z',30,9,0,false) on conflict (user_id,taken_at) do nothing`);
assert.equal((await rows(`select count(*)::int c from glorieta.exam_results`))[0].c, 1); ok('re-sending the same exam is ignored (ignoreDuplicates)');
await db.exec(`update glorieta.profiles set marketing_opt_in = true, marketing_opt_in_at = now() where user_id = '${A}'`); ok('A can record their own consent');
assert.ok((await rows(`select updated_at > created_at as t from glorieta.profiles`))[0].t); ok('updated_at trigger fires');

console.log('as user B');
await as('authenticated', B);
assert.equal((await rows(`select count(*)::int c from glorieta.progress`))[0].c, 0);
assert.equal((await rows(`select count(*)::int c from glorieta.profiles`))[0].c, 0);
assert.equal((await rows(`select count(*)::int c from glorieta.exam_results`))[0].c, 0); ok('B sees none of A\'s rows in any table');
const upd = await db.query(`update glorieta.progress set seen = 99 where item_id = 'q1' returning 1`);
assert.equal(upd.rows.length, 0); ok('B\'s update of A\'s row touches nothing');
const del = await db.query(`delete from glorieta.progress returning 1`);
assert.equal(del.rows.length, 0); ok('B\'s delete removes nothing of A\'s');

console.log('as anon (not signed in)');
await as('anon', '');
await fails('anon cannot read progress', `select * from glorieta.progress`, /permission denied for schema glorieta/);
await fails('anon cannot read profiles', `select * from glorieta.profiles`, /permission denied for schema glorieta/);
await fails('anon cannot insert', `insert into glorieta.progress values ('${A}','x',${card},1,1,now())`, /permission denied/);
await fails('anon cannot call delete_my_data', `select glorieta.delete_my_data()`, /permission denied/);

console.log('as authenticated with no subject claim');
await as('authenticated', '');
assert.equal((await rows(`select count(*)::int c from glorieta.progress`))[0].c, 0); ok('a token with no sub sees nothing');

console.log('constraints (as A)');
await as('authenticated', A);
await fails('right_count cannot exceed seen', `insert into glorieta.progress values ('${A}','c1',${card},1,2,now())`, /check constraint/);
await fails('seen cannot be negative', `insert into glorieta.progress values ('${A}','c2',${card},-1,0,now())`, /check constraint/);
await fails('card must be a JSON object', `insert into glorieta.progress values ('${A}','c3','[1]'::jsonb,1,1,now())`, /check constraint/);
await fails('item_id cannot be empty', `insert into glorieta.progress values ('${A}','',${card},1,1,now())`, /check constraint/);
await fails('opt-in timestamp without opt-in is rejected', `update glorieta.profiles set marketing_opt_in=false, marketing_opt_in_at=now() where user_id='${A}'`, /check constraint/);
await fails('display name over 80 characters', `update glorieta.profiles set display_name='${'x'.repeat(81)}' where user_id='${A}'`, /check constraint/);
await fails('exam errors cannot exceed total', `insert into glorieta.exam_results (user_id,taken_at,total,errors,unanswered,passed) values ('${A}',now(),30,31,0,false)`, /check constraint/);

console.log('delete_my_data');
await as('authenticated', B);
await db.exec(`insert into glorieta.progress values ('${B}','b1',${card},1,1,now())`);
await as('authenticated', A);
await db.exec(`select glorieta.delete_my_data()`);
for (const t of ['progress', 'profiles', 'exam_results']) assert.equal((await rows(`select count(*)::int c from glorieta.${t}`))[0].c, 0);
ok('A\'s call removes all of A\'s rows');
await as('authenticated', B);
assert.equal((await rows(`select count(*)::int c from glorieta.progress`))[0].c, 1); ok('and none of B\'s');

console.log('privileges and cascade (as owner)');
await db.exec(`reset role`);
const anonGrants = await rows(`select count(*)::int c from information_schema.role_table_grants where table_schema='glorieta' and grantee in ('anon','PUBLIC')`);
assert.equal(anonGrants[0].c, 0); ok('anon and PUBLIC hold no table privileges in glorieta');
const rls = await rows(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='glorieta' and relkind='r' order by 1`);
assert.ok(rls.every((r) => r.relrowsecurity)); ok(`row level security is on for all ${rls.length} tables`);
await db.exec(`delete from auth.users where id='${B}'`);
assert.equal((await rows(`select count(*)::int c from glorieta.progress`))[0].c, 0); ok('deleting the auth user cascades to their rows');

console.log(`\nALL ${n} CHECKS PASSED (plus the error-expectation checks above)`);
await db.close();
