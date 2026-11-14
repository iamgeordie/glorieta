import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crmSignal, glorietaKeys, isSupporter } from './entitlements.ts';
import { parseInterval, parseLocale, PRICE_LOOKUP_KEYS } from './catalog.ts';

test('glorietaKeys keeps only glorieta_ keys, once each, sorted', () => {
  assert.deepEqual(glorietaKeys(['linguamama_pro', 'glorieta_supporter', null, 'glorieta_a', 'glorieta_supporter', undefined, 'GLORIETA_x', 'glorieta']), ['glorieta_a', 'glorieta_supporter']);
  assert.deepEqual(glorietaKeys([]), []);
});

test('isSupporter', () => {
  assert.equal(isSupporter(['glorieta_supporter']), true);
  assert.equal(isSupporter(['glorieta_other']), false);
  assert.equal(isSupporter([]), false);
});

const base = { supporter: true, marketing_opt_in: true, crm_synced: true, crm_reported: null } as const;

test('crmSignal: nothing without consent', () => {
  assert.equal(crmSignal({ ...base, marketing_opt_in: false }), null);
  assert.equal(crmSignal({ ...base, marketing_opt_in: false, crm_reported: 'supporter', supporter: false }), null);
});

test('crmSignal: nothing before Podograph knows the person', () => {
  assert.equal(crmSignal({ ...base, crm_synced: false }), null);
});

test('crmSignal: started when a new supporter was never reported', () => {
  assert.deepEqual(crmSignal(base), { state: 'supporter', event_type: 'glorieta_supporter_started' });
  assert.deepEqual(crmSignal({ ...base, crm_reported: 'none' }), { state: 'supporter', event_type: 'glorieta_supporter_started' });
});

test('crmSignal: ended when a reported supporter stops', () => {
  assert.deepEqual(crmSignal({ ...base, supporter: false, crm_reported: 'supporter' }), { state: 'none', event_type: 'glorieta_supporter_ended' });
});

test('crmSignal: nothing when Podograph already has the current state', () => {
  assert.equal(crmSignal({ ...base, crm_reported: 'supporter' }), null);
  assert.equal(crmSignal({ ...base, supporter: false, crm_reported: 'none' }), null);
  assert.equal(crmSignal({ ...base, supporter: false, crm_reported: null }), null);
});

test('catalog parsing accepts only the known values', () => {
  assert.equal(parseInterval('month'), 'month');
  assert.equal(parseInterval('year'), 'year');
  assert.equal(parseInterval('price_123'), null);
  assert.equal(parseLocale('es'), 'es');
  assert.equal(parseLocale('fr'), null);
  assert.deepEqual(Object.values(PRICE_LOOKUP_KEYS), ['glorieta_supporter_monthly', 'glorieta_supporter_annual']);
});
