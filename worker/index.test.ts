import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, routes } from './index.ts';

const env = {} as Cloudflare.Env;
const ctx = {} as ExecutionContext;
const call = (method: string, path: string) => handle(new Request(`https://glorieta.anaidic.com${path}`, { method }), env, ctx);

test('an /api path outside billing is a JSON 404', async () => {
  const res = await call('GET', '/api/other');
  assert.equal(res.status, 404);
  assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'not_found');
});

test('an unknown billing path is a JSON 404', async () => {
  const res = await call('GET', '/api/billing/nothing-here');
  assert.equal(res.status, 404);
});

test('a known path with the wrong method is a 405, and a handler error becomes JSON', async () => {
  routes.set('POST /api/billing/probe', async () => {
    throw new Error('boom');
  });
  try {
    assert.equal((await call('GET', '/api/billing/probe')).status, 405);
    const res = await call('POST', '/api/billing/probe');
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: { code: 'internal', message: 'boom' } });
  } finally {
    routes.delete('POST /api/billing/probe');
  }
});
