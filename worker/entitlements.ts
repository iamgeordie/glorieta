// Pure decisions for the billing mirror. No IO, so every branch is unit-tested.
import { SUPPORTER_FEATURE } from './catalog.ts';

/** Glorieta's own entitlement keys, de-duplicated and sorted. Anything else on the account is dropped. */
export function glorietaKeys(keys: readonly (string | null | undefined)[]): string[] {
  return [...new Set(keys.filter((k): k is string => typeof k === 'string' && k.startsWith('glorieta_')))].sort();
}

export function isSupporter(keys: readonly string[]): boolean {
  return keys.includes(SUPPORTER_FEATURE);
}

export type CrmState = 'supporter' | 'none';

export interface CrmFacts {
  supporter: boolean;
  marketing_opt_in: boolean;
  /** Podograph already holds this person as a lead (glorieta.profiles.crm_synced_at is set). */
  crm_synced: boolean;
  /** The state Podograph last accepted, or null if none was ever sent. */
  crm_reported: CrmState | null;
}

export interface CrmSignal {
  state: CrmState;
  event_type: 'glorieta_supporter_started' | 'glorieta_supporter_ended';
}

/**
 * Whether Podograph needs to hear about this person, and what. Only with consent, only once Podograph
 * knows the person, and only when the state differs from the one Podograph last accepted. A person
 * who was never reported and is not a supporter needs no "ended" event.
 */
export function crmSignal(f: CrmFacts): CrmSignal | null {
  if (!f.marketing_opt_in || !f.crm_synced) return null;
  const state: CrmState = f.supporter ? 'supporter' : 'none';
  if (state === (f.crm_reported ?? 'none')) return null;
  return { state, event_type: state === 'supporter' ? 'glorieta_supporter_started' : 'glorieta_supporter_ended' };
}
