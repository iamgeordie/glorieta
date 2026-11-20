// Applies docs/backend/glorieta-schema.sql, then 002 (course progress), 003 (billing) and 004 (coffees), in that order, as the
// live database experienced them, to an embedded Postgres (PGlite) with Supabase's roles, auth.uid() and the
// `extensions` schema (pgcrypto) set up, then checks row level security, privileges and constraints. 002 and 003
// are each applied a second time: they must be idempotent.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const SQL = readFileSync(new URL('../docs/backend/glorieta-schema.sql', import.meta.url), 'utf8');
const SQL2 = readFileSync(new URL('../docs/backend/glorieta-schema-002-course-progress.sql', import.meta.url), 'utf8');
const SQL3 = readFileSync(new URL('../docs/backend/glorieta-schema-003-billing.sql', import.meta.url), 'utf8');
const SQL4 = readFileSync(new URL('../docs/backend/glorieta-schema-004-coffee.sql', import.meta.url), 'utf8');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create schema extensions; create extension pgcrypto schema extensions;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  insert into auth.users values ('${A}','a@example.test'), ('${B}','b@example.test');
`);
await db.exec(SQL); // must apply cleanly, exactly as written
await db.exec(SQL2); // and so must the course-progress addition on top of it
await db.exec(SQL2); // twice: it is idempotent
await db.exec(SQL3); // the billing mirror
await db.exec(SQL3); // twice: it is idempotent
await db.exec(SQL4); // coffees
await db.exec(SQL4); // twice: it is idempotent

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
await db.exec(`insert into glorieta.attempts (user_id,item_id,correct,mode,answered_at) values
  ('${A}','speed-01',true,'practice','2026-10-01T10:00:00Z'),('${A}','speed-02',false,'practice','2026-10-01T10:01:00Z'),
  ('${A}','sign:r-1',true,'practice','2026-10-01T10:02:00Z'),('${A}','v:ceda-el-paso',true,'vocab','2026-10-01T10:03:00Z'),
  ('${A}','speed-01',false,'exam','2026-10-02T09:00:00Z')`); ok('A logs answers');
await db.exec(`insert into glorieta.attempts (user_id,item_id,correct,mode,answered_at) values ('${A}','speed-01',false,'practice','2026-10-01T10:00:00Z') on conflict (user_id,item_id,answered_at) do nothing`);
assert.equal((await rows(`select count(*)::int c from glorieta.attempts`))[0].c, 5); ok('the same answer sent twice is stored once');
const stats = await rows(`select * from glorieta.my_stats()`);
const speed = stats.find((r) => r.grp === 'speed');
assert.equal(Number(speed.attempts), 3); assert.equal(Number(speed.correct), 1); assert.equal(String(speed.accuracy), '33.3');
assert.ok(stats.find((r) => r.grp === 'signs') && stats.find((r) => r.grp === 'vocab')); ok('my_stats groups A\'s answers by topic, computed in SQL');
await fails('A cannot log an answer for B', `insert into glorieta.attempts (user_id,item_id,correct,mode,answered_at) values ('${B}','speed-01',true,'practice',now())`, /row-level security/);
await fails('attempts cannot be edited (append-only)', `update glorieta.attempts set correct = true where item_id = 'speed-02'`, /permission denied/);

console.log('as user B');
await as('authenticated', B);
assert.equal((await rows(`select count(*)::int c from glorieta.progress`))[0].c, 0);
assert.equal((await rows(`select count(*)::int c from glorieta.profiles`))[0].c, 0);
assert.equal((await rows(`select count(*)::int c from glorieta.exam_results`))[0].c, 0); ok('B sees none of A\'s rows in any table');
const upd = await db.query(`update glorieta.progress set seen = 99 where item_id = 'q1' returning 1`);
assert.equal(upd.rows.length, 0); ok('B\'s update of A\'s row touches nothing');
const del = await db.query(`delete from glorieta.progress returning 1`);
assert.equal(del.rows.length, 0); ok('B\'s delete removes nothing of A\'s');
assert.equal((await rows(`select count(*)::int c from glorieta.attempts`))[0].c, 0);
assert.equal((await rows(`select count(*)::int c from glorieta.my_stats()`))[0].c, 0); ok('B sees none of A\'s answers and gets empty stats');
await db.exec(`insert into glorieta.attempts (user_id,item_id,correct,mode,answered_at) values ('${B}','speed-01',true,'practice','2026-10-03T08:00:00Z')`); ok('B logs their own answer');
await fails('a signed-in user cannot read the per-question aggregate', `select * from glorieta.item_difficulty`, /permission denied/);
await as('service_role', '');
const diff = (await rows(`select * from glorieta.item_difficulty where item_id = 'speed-01'`))[0];
assert.equal(Number(diff.attempts), 3); assert.equal(Number(diff.learners), 2); assert.equal(Number(diff.correct), 2); assert.equal(String(diff.accuracy), '66.7');
assert.deepEqual(Object.keys(diff).sort(), ['accuracy', 'attempts', 'correct', 'item_id', 'learners']); ok('the owner view aggregates across users and exposes no user ids');
await as('authenticated', B);

console.log('as anon (not signed in)');
await as('anon', '');
await fails('anon cannot read progress', `select * from glorieta.progress`, /permission denied for table/);
await fails('anon cannot read profiles', `select * from glorieta.profiles`, /permission denied for table/);
await fails('anon cannot insert', `insert into glorieta.progress values ('${A}','x',${card},1,1,now())`, /permission denied/);
await fails('anon cannot call delete_my_data', `select glorieta.delete_my_data()`, /permission denied/);
await fails('anon cannot read attempts', `select * from glorieta.attempts`, /permission denied for table/);
await fails('anon cannot call my_stats', `select * from glorieta.my_stats()`, /permission denied/);
await fails('anon cannot read the aggregate view', `select * from glorieta.item_difficulty`, /permission denied/);

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
await fails('an attempt needs a valid mode', `insert into glorieta.attempts (user_id,item_id,correct,mode,answered_at) values ('${A}','x',true,'cheating',now())`, /check constraint/);
await fails('an attempt needs an item id', `insert into glorieta.attempts (user_id,item_id,correct,mode,answered_at) values ('${A}','',true,'practice',now())`, /check constraint/);

console.log('course progress (lesson_progress, quiz_progress)');
const answered = `'{"roundabouts-c1a":{"sel":0,"ok":true}}'::jsonb`;
await as('authenticated', A);
await db.exec(`insert into glorieta.lesson_progress values ('${A}','roundabouts/direction-and-priority',true,5,${answered},now())`); ok('A saves a finished lesson');
await db.exec(`insert into glorieta.quiz_progress values ('${A}','roundabouts',80,80,1,now())`); ok('A saves a quiz result');
await db.exec(`insert into glorieta.lesson_progress values ('${A}','roundabouts/direction-and-priority',true,6,${answered},now()) on conflict (user_id,lesson_key) do update set done=excluded.done, step=excluded.step, answered=excluded.answered, updated_at=excluded.updated_at`);
assert.equal((await rows(`select step from glorieta.lesson_progress`))[0].step, 6); ok('upsert on (user_id,lesson_key) updates A\'s own lesson row');
await db.exec(`insert into glorieta.quiz_progress values ('${A}','roundabouts',100,90,2,now()) on conflict (user_id,module_id) do update set best=excluded.best, last=excluded.last, attempts=excluded.attempts, updated_at=excluded.updated_at`);
assert.equal((await rows(`select best, attempts from glorieta.quiz_progress`))[0].best, 100); ok('upsert on (user_id,module_id) updates A\'s own quiz row');
await fails('A cannot save a lesson for B', `insert into glorieta.lesson_progress values ('${B}','x/y',false,0,'{}'::jsonb,now())`, /row-level security/);
await fails('A cannot save a quiz result for B', `insert into glorieta.quiz_progress values ('${B}','x',50,50,1,now())`, /row-level security/);
await fails('A cannot move a lesson row to B (WITH CHECK)', `update glorieta.lesson_progress set user_id='${B}'`, /row-level security/);
await fails('step cannot be negative', `insert into glorieta.lesson_progress values ('${A}','a/b',false,-1,'{}'::jsonb,now())`, /check constraint/);
await fails('step cannot exceed 30', `insert into glorieta.lesson_progress values ('${A}','a/c',false,31,'{}'::jsonb,now())`, /check constraint/);
await fails('answered must be a JSON object', `insert into glorieta.lesson_progress values ('${A}','a/d',false,0,'[1]'::jsonb,now())`, /check constraint/);
await fails('answered is size-limited', `insert into glorieta.lesson_progress values ('${A}','a/e',false,0,jsonb_build_object('k', repeat('x', 20000)),now())`, /check constraint/);
await fails('lesson_key cannot be empty', `insert into glorieta.lesson_progress values ('${A}','',false,0,'{}'::jsonb,now())`, /check constraint/);
await fails('quiz percent over 100', `insert into glorieta.quiz_progress values ('${A}','m1',101,101,1,now())`, /check constraint/);
await fails('latest quiz result cannot beat the best', `insert into glorieta.quiz_progress values ('${A}','m2',50,60,1,now())`, /check constraint/);
await fails('quiz attempts start at 1', `insert into glorieta.quiz_progress values ('${A}','m3',50,50,0,now())`, /check constraint/);
await as('authenticated', B);
assert.equal((await rows(`select count(*)::int c from glorieta.lesson_progress`))[0].c, 0);
assert.equal((await rows(`select count(*)::int c from glorieta.quiz_progress`))[0].c, 0); ok('B sees none of A\'s course progress');
assert.equal((await db.query(`update glorieta.lesson_progress set step = 0 returning 1`)).rows.length, 0);
assert.equal((await db.query(`delete from glorieta.quiz_progress returning 1`)).rows.length, 0); ok('B cannot change or delete A\'s course rows');
await db.exec(`insert into glorieta.lesson_progress values ('${B}','speed/towns',false,2,'{}'::jsonb,now())`); ok('B saves their own lesson');
await as('anon', '');
await fails('anon cannot read lesson_progress', `select * from glorieta.lesson_progress`, /permission denied/);
await fails('anon cannot write quiz_progress', `insert into glorieta.quiz_progress values ('${A}','m',1,1,1,now())`, /permission denied/);

console.log('billing mirror (003)');
const KEY = 'k'.repeat(64);
const C_A = 'cus_TestA1';
const C_B = 'cus_TestB1';
await db.exec(`reset role; insert into glorieta.billing_key (secret) values ('${KEY}')`);
let issuedAt = () => new Date().toISOString();
const body = (o) => JSON.stringify({ issued_at: issuedAt(), ...o });
const sign = (b, key = KEY) => createHmac('sha256', key).update(b).digest('hex');
const apply = async (o, key) => {
  const b = body(o);
  return (await db.query(`select glorieta.billing_apply($1, $2) as r`, [b, sign(b, key)])).rows[0].r;
};
const applyFails = async (label, run, pattern) => {
  try { await run(); } catch (e) {
    assert.match(String(e.message), pattern, `${label}: wrong error: ${e.message}`);
    console.log('  ok  ', label); return;
  }
  assert.fail(`${label}: expected an error but it succeeded`);
};
const billingRow = async (u) => (await db.query(`select * from glorieta.billing where user_id = $1`, [u])).rows[0];

await as('anon', '');
await applyFails('an unsigned call is refused', () => db.query(`select glorieta.billing_apply($1, $2)`, [body({ op: 'clear' }), '']), /bad_signature/);
await applyFails('a call signed with another key is refused', () => apply({ op: 'clear' }, 'x'.repeat(64)), /bad_signature/);
await applyFails('a body changed after signing is refused', () => {
  const b = body({ op: 'clear', user_id: A, customer_id: C_A });
  return db.query(`select glorieta.billing_apply($1, $2)`, [b.replace(C_A, C_B), sign(b)]);
}, /bad_signature/);
issuedAt = () => new Date(Date.now() - 301_000).toISOString();
await applyFails('a call older than 300 seconds is refused', () => apply({ op: 'clear', user_id: A, customer_id: C_A }), /stale_call/);
issuedAt = () => new Date().toISOString();
await applyFails('an unknown op is refused', () => apply({ op: 'grant_everything' }), /unknown_op/);

assert.deepEqual(await apply({ op: 'link_customer', user_id: B, customer_id: C_B }), { status: 'no_profile' }); ok('link_customer without a profile creates nothing');
await as('authenticated', B);
await db.exec(`insert into glorieta.profiles (user_id) values ('${B}')`);
await as('anon', '');
assert.deepEqual(await apply({ op: 'link_customer', user_id: A, customer_id: C_A }), { status: 'linked', customer_id: C_A }); ok('link_customer links A');
assert.deepEqual(await apply({ op: 'link_customer', user_id: A, customer_id: 'cus_Raced2' }), { status: 'linked', customer_id: C_A }); ok('a second link_customer keeps the first customer');
await apply({ op: 'link_customer', user_id: B, customer_id: C_B });

assert.deepEqual(await apply({ op: 'entitlements', event_id: 'evt_Unknown', customer_id: 'cus_LinguaMama9', entitlements: ['glorieta_supporter'] }), { status: 'no_row' });
await as('service_role', '');
assert.equal((await rows(`select count(*)::int c from glorieta.billing`))[0].c, 2); ok('an unknown customer returns no_row and creates nothing');
await as('anon', '');

const r1 = await apply({ op: 'entitlements', event_id: 'evt_One', customer_id: C_A, entitlements: ['glorieta_supporter', 'linguamama_pro', 'glorieta_supporter'] });
assert.equal(r1.status, 'applied'); assert.equal(r1.supporter, true); assert.equal(r1.user_id, A);
assert.equal(r1.marketing_opt_in, true); assert.equal(r1.crm_synced, false); assert.equal(r1.crm_reported, null);
await db.exec('reset role');
let rowA = await billingRow(A);
assert.deepEqual(rowA.entitlements, ['glorieta_supporter']); ok('only glorieta_ keys are stored, once each, with consent state returned');
const stamp = rowA.updated_at.getTime();
await as('anon', '');
const r2 = await apply({ op: 'entitlements', event_id: 'evt_One', customer_id: C_A, entitlements: [] });
assert.equal(r2.status, 'noop'); assert.equal(r2.supporter, true);
await db.exec('reset role');
rowA = await billingRow(A);
assert.deepEqual(rowA.entitlements, ['glorieta_supporter']); assert.equal(rowA.updated_at.getTime(), stamp); assert.equal(rowA.history.length, 1);
ok('a replayed event id changes nothing');
await fails('the table itself refuses a foreign key', `update glorieta.billing set entitlements = '{linguamama_pro}' where user_id = '${A}'`, /check constraint/);

await as('anon', '');
for (let i = 0; i < 55; i++) await apply({ op: 'entitlements', event_id: `evt_Loop${i}`, customer_id: C_B, entitlements: i % 2 ? [] : ['glorieta_supporter'] });
await db.exec('reset role');
const rowB = await billingRow(B);
assert.equal(rowB.history.length, 50); assert.equal(rowB.history[49].event_id, 'evt_Loop54'); assert.equal(rowB.history[0].event_id, 'evt_Loop5');
ok('history keeps the newest 50 transitions');

await as('anon', '');
assert.deepEqual(await apply({ op: 'crm_reported', user_id: A, state: 'supporter' }), { status: 'ok' });
assert.equal((await apply({ op: 'entitlements', event_id: 'evt_Two', customer_id: C_A, entitlements: ['glorieta_supporter'] })).crm_reported, 'supporter');
ok('crm_reported is stored and returned');
await applyFails('crm_reported accepts only supporter or none', () => apply({ op: 'crm_reported', user_id: A, state: 'vip' }), /check constraint/);

console.log('coffees (004)');
await as('anon', '');
assert.deepEqual(await apply({ op: 'coffee', customer_id: 'cus_Nobody9', session_id: 'cs_test_Nobody', amount: 500, currency: 'eur' }), { status: 'no_row' });
ok('a coffee for an unknown customer is not stored');
assert.deepEqual(await apply({ op: 'coffee', customer_id: C_A, session_id: 'cs_test_A1', amount: 500, currency: 'eur' }), { status: 'applied', user_id: A });
assert.deepEqual(await apply({ op: 'coffee', customer_id: C_A, session_id: 'cs_test_A1', amount: 500, currency: 'eur' }), { status: 'noop', user_id: A });
await db.exec('reset role');
assert.equal((await rows(`select count(*)::int c from glorieta.coffees where user_id = '${A}'`))[0].c, 1); ok('a coffee is stored once, a replay adds nothing');
await as('anon', '');
await applyFails('a coffee outside 2 to 200 euros is refused', () => apply({ op: 'coffee', customer_id: C_A, session_id: 'cs_test_A2', amount: 100, currency: 'eur' }), /check constraint/);
await fails('anon cannot read coffees', `select * from glorieta.coffees`, /permission denied for table/);
await as('authenticated', B);
assert.equal((await rows(`select count(*)::int c from glorieta.coffees`))[0].c, 0); ok('B cannot see A\'s coffees');
await fails('B cannot insert a coffee', `insert into glorieta.coffees (session_id, user_id, amount, currency) values ('cs_test_Forged', '${B}', 500, 'eur')`, /permission denied/);
await as('authenticated', A);
assert.equal((await rows(`select count(*)::int c from glorieta.coffees`))[0].c, 1); ok('A reads their own coffee');
await as('anon', '');

console.log('billing privileges');
await fails('anon cannot read billing', `select * from glorieta.billing`, /permission denied for table/);
await fails('anon cannot read billing_key', `select * from glorieta.billing_key`, /permission denied for table/);
await as('authenticated', A);
assert.equal((await rows(`select count(*)::int c from glorieta.billing`))[0].c, 1);
assert.equal((await rows(`select user_id from glorieta.billing`))[0].user_id, A); ok('A reads exactly their own billing row');
await fails('A cannot insert a billing row', `insert into glorieta.billing (user_id, stripe_customer_id) values ('${A}', 'cus_Forged1')`, /permission denied/);
await fails('A cannot update their billing row', `update glorieta.billing set entitlements = '{glorieta_supporter}'`, /permission denied/);
await fails('A cannot delete their billing row', `delete from glorieta.billing`, /permission denied/);
await fails('A cannot read billing_key', `select * from glorieta.billing_key`, /permission denied/);
await fails('A cannot call billing_apply', `select glorieta.billing_apply('{}', '')`, /permission denied/);
await as('authenticated', B);
assert.equal((await rows(`select user_id from glorieta.billing`))[0].user_id, B); ok('B reads only B\'s billing row');
await as('service_role', '');
await fails('the service role cannot write billing', `update glorieta.billing set entitlements = '{}'`, /permission denied/);
await fails('the service role cannot read billing_key', `select * from glorieta.billing_key`, /permission denied/);
await db.exec('reset role');
const anonRoutines = await rows(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'glorieta' and has_function_privilege('anon', p.oid, 'execute') order by 1`);
assert.deepEqual(anonRoutines.map((r) => r.proname), ['billing_apply']); ok('anon can execute exactly one function in glorieta');

console.log('erasure guard');
await as('authenticated', A);
await fails('delete_my_data refuses a supporter', `select glorieta.delete_my_data()`, /active_support_plan/);
await as('anon', '');
assert.deepEqual(await apply({ op: 'clear', user_id: A, customer_id: 'cus_Other7' }), { status: 'no_row' }); ok('clear needs the matching customer');
assert.deepEqual(await apply({ op: 'clear', user_id: A, customer_id: C_A }), { status: 'cleared' }); ok('clear empties A\'s entitlements');

console.log('reset progress (the Account screen\'s "Start over")');
await as('authenticated', A);
await db.exec(`insert into glorieta.attempts (user_id,item_id,correct,mode,answered_at) values ('${A}','q1',true,'practice','2026-10-02T10:00:00Z')`);
await db.exec(`insert into glorieta.lesson_progress (user_id,lesson_key,done,step,updated_at) values ('${A}','road/types',true,4,now())`);
await db.exec(`insert into glorieta.quiz_progress (user_id,module_id,best,last,updated_at) values ('${A}','road',90,80,now())`);
const HISTORY = ['attempts', 'exam_results', 'progress', 'lesson_progress', 'quiz_progress']; // src/lib/sync.ts PROGRESS_TABLES
for (const t of HISTORY) assert.ok((await rows(`select count(*)::int c from glorieta.${t}`))[0].c > 0, `A has ${t} rows before the reset`);
for (const t of HISTORY) await db.exec(`delete from glorieta.${t} where user_id = '${A}'`);
for (const t of HISTORY) assert.equal((await rows(`select count(*)::int c from glorieta.${t}`))[0].c, 0, `A's ${t} is empty after the reset`);
ok('A can delete all of their own study history');
assert.equal((await rows(`select count(*)::int c from glorieta.profiles`))[0].c, 1);
assert.equal((await rows(`select count(*)::int c from glorieta.billing`))[0].c, 1); ok('and their profile and billing row stay');
await as('authenticated', B);
assert.equal((await rows(`select count(*)::int c from glorieta.attempts`))[0].c, 1);
assert.equal((await rows(`select count(*)::int c from glorieta.lesson_progress`))[0].c, 1); ok('and B\'s history is untouched');

console.log('delete_my_data');
await as('authenticated', B);
await db.exec(`insert into glorieta.progress values ('${B}','b1',${card},1,1,now())`);
await as('authenticated', A);
await db.exec(`select glorieta.delete_my_data()`);
for (const t of ['progress', 'profiles', 'exam_results', 'attempts', 'lesson_progress', 'quiz_progress', 'billing', 'coffees']) assert.equal((await rows(`select count(*)::int c from glorieta.${t}`))[0].c, 0);
ok('A\'s call removes all of A\'s rows');
await as('authenticated', B);
assert.equal((await rows(`select count(*)::int c from glorieta.progress`))[0].c, 1);
assert.equal((await rows(`select count(*)::int c from glorieta.attempts`))[0].c, 1);
assert.equal((await rows(`select count(*)::int c from glorieta.lesson_progress`))[0].c, 1);
assert.equal((await rows(`select count(*)::int c from glorieta.billing`))[0].c, 1); ok('and none of B\'s, including B\'s course progress and billing row');
await as('anon', '');
assert.deepEqual(await apply({ op: 'entitlements', event_id: 'evt_AfterErase', customer_id: C_A, entitlements: [] }), { status: 'no_row' });
await db.exec('reset role');
assert.equal((await billingRow(A)), undefined); ok('a webhook after erasure creates no row');

console.log('privileges and cascade (as owner)');
await db.exec(`reset role`);
const anonGrants = await rows(`select count(*)::int c from information_schema.role_table_grants where table_schema='glorieta' and grantee in ('anon','PUBLIC')`);
assert.equal(anonGrants[0].c, 0); ok('anon and PUBLIC hold no table privileges in glorieta');
const rls = await rows(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='glorieta' and relkind='r' order by 1`);
assert.equal(rls.length, 9);
assert.ok(rls.every((r) => r.relrowsecurity)); ok(`row level security is on for all ${rls.length} tables`);
await db.exec(`delete from auth.users where id='${B}'`);
assert.equal((await rows(`select count(*)::int c from glorieta.progress`))[0].c, 0);
assert.equal((await rows(`select count(*)::int c from glorieta.lesson_progress`))[0].c, 0); ok('deleting the auth user cascades to their rows, course progress included');

console.log(`\nALL ${n} CHECKS PASSED (plus the error-expectation checks above)`);
await db.close();
