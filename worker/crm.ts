// Supporter status for Podograph, for people who consented to marketing. Podograph's public lead intake
// records the event on the person's contact; Podograph decides what, if anything, to send.
import type { CrmSignal } from './entitlements.ts';

const LEADS_URL = 'https://api.podograph.com/leads/capture';

export async function sendSupporterSignal(
  env: Pick<Cloudflare.Env, 'PODOGRAPH_BRAND_ID' | 'SITE_ORIGIN'>,
  email: string,
  signal: CrmSignal,
): Promise<void> {
  // A server-to-server call carries no Origin header, which Podograph's allowlist accepts.
  const res = await fetch(LEADS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      brand_id: env.PODOGRAPH_BRAND_ID,
      source_url: env.SITE_ORIGIN,
      event_type: signal.event_type,
      payload: { app: 'glorieta', supporter: signal.state === 'supporter' },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok || body.success === false) {
    throw new Error(`Podograph refused the supporter event (HTTP ${res.status}${body.error ? `: ${body.error}` : ''})`);
  }
}
