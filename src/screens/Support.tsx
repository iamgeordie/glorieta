import { useEffect, useState } from 'preact/hooks';
import { mode, T, type Bi } from '../i18n';
import { b } from '../billingStrings';
import { authStatus } from '../lib/auth';
import { billing, checkoutReturn, getPlans, isSupporter, openPortal, readBilling, startCheckout, type Interval, type Plan } from '../lib/billing';
import { Message } from './form-parts';

/** Stripe amounts are in cents. Formatted in the reader's language, in the plan's own currency. */
function price(plan: Plan): string {
  const lang = mode.value === 'en' ? 'en-GB' : 'es-ES';
  return new Intl.NumberFormat(lang, { style: 'currency', currency: plan.currency.toUpperCase() }).format(plan.amount / 100);
}

/** Checkout cannot show two languages at once; with both on, it opens in English, the reader's own. */
const checkoutLocale = (): 'es' | 'en' => (mode.value === 'es' ? 'es' : 'en');

export function Support() {
  const signedIn = authStatus.value === 'in';
  const row = billing.value;
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<Bi | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPlans().then((r) => (r.ok ? setPlans(r.plans) : setError(r.error)));
  }, []);
  // The mirror is re-read every time this page opens, so a badge that just landed shows at once.
  useEffect(() => {
    if (signedIn) void readBilling().then((err) => err && setError(err));
  }, [signedIn]);

  const choose = async (interval: Interval) => {
    setBusy(true);
    setError(null);
    const err = await startCheckout(interval, checkoutLocale());
    if (err) {
      setError(err);
      setBusy(false);
    }
  };
  const manage = async () => {
    setBusy(true);
    setError(null);
    const err = await openPortal();
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  const returned = checkoutReturn.value;
  return (
    <section class="support">
      <h1><T t={b.title} /></h1>
      {returned && (
        <p class="note notice" role="status">
          <T t={returned === 'success' ? b.thanks : b.cancelled} />
          <button type="button" class="link" onClick={() => (checkoutReturn.value = null)} aria-label="OK">OK</button>
        </p>
      )}
      <div class="card">
        <p><T t={b.free} /></p>
        <p><T t={b.paysFor} /></p>
        <p class="muted small"><T t={b.perks} /></p>
      </div>

      {signedIn && isSupporter(row) ? (
        <div class="card">
          <p class="bold"><span class="badge supporter"><T t={b.badge} /></span> <T t={b.active} /></p>
          <div class="actions">
            <button type="button" class="primary" onClick={() => void manage()} disabled={busy}><T t={busy ? b.redirecting : b.manage} /></button>
          </div>
          <p class="muted small"><T t={b.manageHint} /></p>
        </div>
      ) : (
        <div class="card">
          {plans === null && !error && <p class="muted small"><T t={b.loadingPlans} /></p>}
          {plans && (
            <ul class="plans">
              {plans.map((p) => (
                <li key={p.interval} class="plan">
                  <span class="plan-name"><T t={p.interval === 'month' ? b.monthly : b.annual} /></span>
                  <span class="plan-price">
                    {price(p)} <span class="muted small"><T t={p.interval === 'month' ? b.perMonth : b.perYear} /></span>
                  </span>
                  {signedIn && (
                    <button type="button" class="primary" disabled={busy || row === undefined} onClick={() => void choose(p.interval)}>
                      <T t={busy ? b.redirecting : b.choose} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!signedIn && plans && (
            <>
              <p><T t={b.signInFirst} /></p>
              <div class="actions">
                <a class="primary" href="#/account"><T t={b.signInButton} /></a>
              </div>
            </>
          )}
          <p class="muted small"><T t={b.stripeNote} /></p>
        </div>
      )}
      <Message error={error} />
    </section>
  );
}
