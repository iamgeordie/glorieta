import { useEffect, useState } from 'preact/hooks';
import { mode, T, type Bi } from '../i18n';
import { b } from '../billingStrings';
import { authStatus } from '../lib/auth';
import {
  billing,
  cardSaved,
  changeCard,
  checkoutReturn,
  getPlan,
  getPlans,
  isSupporter,
  readBilling,
  setCancel,
  startCheckout,
  switchTo,
  type Interval,
  type Invoice,
  type Plan,
  type PlanState,
} from '../lib/billing';
import { Message } from './form-parts';

/** Stripe amounts are in cents. Formatted in the reader's language, in the plan's own currency. */
const lang = () => (mode.value === 'en' ? 'en-GB' : 'es-ES');
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat(lang(), { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const price = (plan: Plan): string => money(plan.amount, plan.currency);
const date = (seconds: number) => new Date(seconds * 1000).toLocaleDateString(lang(), { day: 'numeric', month: 'long', year: 'numeric' });

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
        <ManagePlan plans={plans} />
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

type Confirming = null | 'switch' | 'cancel';

/** The supporter's own plan: renewal, card, switch, cancel or keep, and invoices. All of it stays in Glorieta. */
function ManagePlan({ plans }: { plans: Plan[] | null }) {
  const [state, setState] = useState<{ plan: PlanState | null; invoices: Invoice[] } | null>(null);
  const [error, setError] = useState<Bi | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  /** What the last change did, shown until the next one. */
  const [done, setDone] = useState<{ text: Bi; amount?: { label: Bi; value: string } | undefined } | null>(null);

  const load = () => void getPlan().then((r) => (r.ok ? setState(r.value) : setError(r.error)));
  useEffect(load, []);
  // After the change-card page the webhook sets the new card within seconds: read the plan again then.
  useEffect(() => {
    if (!cardSaved.value) return;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, []);

  const finish = (error: Bi | null) => {
    setBusy(false);
    setConfirming(null);
    if (error) setError(error);
  };
  const cancelOrKeep = async (cancel: boolean) => {
    setBusy(true);
    setError(null);
    setDone(null);
    const r = await setCancel(cancel);
    if (r.ok) {
      setState((s) => (s ? { ...s, plan: r.value } : s));
      setDone({ text: cancel ? b.cancelledOk : b.resumedOk });
    }
    finish(r.ok ? null : r.error);
  };
  const doSwitch = async (to: Interval) => {
    setBusy(true);
    setError(null);
    setDone(null);
    const r = await switchTo(to);
    if (r.ok) {
      const inv = r.value.invoice;
      const amount = !inv || inv.total === 0
        ? undefined
        : inv.total < 0
          ? { label: b.credited, value: money(-inv.total, inv.currency) }
          : { label: inv.status === 'paid' ? b.charged : b.chargePending, value: money(inv.total, inv.currency) };
      setDone({ text: to === 'year' ? b.switchedAnnual : b.switchedMonthly, amount });
      // Read the plan and invoices again, so the new invoice is listed.
      const fresh = await getPlan();
      if (fresh.ok) setState(fresh.value);
      else setState((s) => (s ? { ...s, plan: r.value.plan } : s));
    }
    finish(r.ok ? null : r.error);
  };
  const card = async () => {
    setBusy(true);
    setError(null);
    const err = await changeCard(checkoutLocale());
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  const plan = state?.plan;
  const other: Interval | null = plan?.interval === 'month' ? 'year' : plan?.interval === 'year' ? 'month' : null;
  const otherPlan = plans?.find((p) => p.interval === other);
  return (
    <div class="card manage">
      <p class="bold"><span class="badge supporter"><T t={b.badge} /></span> <T t={b.active} /></p>
      {cardSaved.value && (
        <p class="note notice" role="status">
          <T t={b.cardSaved} />
          <button type="button" class="link" onClick={() => (cardSaved.value = false)} aria-label="OK">OK</button>
        </p>
      )}
      {done && (
        <p class="note notice" role="status">
          <T t={done.text} />
          {done.amount && <> <T t={done.amount.label} /> <b>{done.amount.value}</b></>}
          <button type="button" class="link" onClick={() => setDone(null)} aria-label="OK">OK</button>
        </p>
      )}
      {state === null && !error && <p class="muted small"><T t={b.loadingPlan} /></p>}
      {state && !plan && <p><T t={b.planEnded} /></p>}
      {plan && (
        <>
          <h2><T t={b.yourPlan} /></h2>
          <dl class="facts">
            <div>
              <dt><T t={plan.interval === 'year' ? b.annual : b.monthly} /></dt>
              <dd>
                {plan.amount !== null && money(plan.amount, plan.currency)}{' '}
                <span class="muted small"><T t={plan.interval === 'year' ? b.perYear : b.perMonth} /></span>
              </dd>
            </div>
            {plan.period_end !== null && (
              <div>
                <dt><T t={plan.cancel_at_period_end ? b.endsOn : b.renewsOn} /></dt>
                <dd>{date(plan.period_end)}</dd>
              </div>
            )}
            <div>
              <dt><T t={b.card} /></dt>
              <dd>
                {plan.card ? (
                  <>
                    <span class="caps">{plan.card.brand}</span> •••• {plan.card.last4}{' '}
                    <span class="muted small"><T t={b.expires} /> {String(plan.card.exp_month).padStart(2, '0')}/{plan.card.exp_year}</span>
                  </>
                ) : (
                  <T t={b.noCard} />
                )}
              </dd>
            </div>
          </dl>
          {plan.cancel_at_period_end && <p class="muted small"><T t={b.endsNote} /></p>}
          {(plan.status === 'past_due' || plan.status === 'unpaid') && <p class="form-error" role="alert"><T t={b.pastDue} /></p>}

          {confirming === null && (
            <div class="actions">
              <button type="button" class="secondary" disabled={busy} onClick={() => void card()}><T t={busy ? b.redirecting : b.changeCard} /></button>
              {other && otherPlan && (
                <button type="button" class="secondary" disabled={busy} onClick={() => setConfirming('switch')}>
                  <T t={other === 'year' ? b.switchToAnnual : b.switchToMonthly} /> ({price(otherPlan)})
                </button>
              )}
              {plan.cancel_at_period_end ? (
                <button type="button" class="primary" disabled={busy} onClick={() => void cancelOrKeep(false)}>
                  <T t={busy ? b.working : b.resumePlan} />
                </button>
              ) : (
                <button type="button" class="secondary" disabled={busy} onClick={() => setConfirming('cancel')}><T t={b.cancelPlan} /></button>
              )}
            </div>
          )}
          {confirming !== null && (
            <div class="confirm">
              <p><T t={confirming === 'switch' ? b.switchNote : b.cancelNote} /></p>
              <div class="actions">
                <button
                  type="button"
                  class="primary"
                  disabled={busy}
                  onClick={() => void (confirming === 'switch' && other ? doSwitch(other) : cancelOrKeep(true))}
                >
                  <T t={busy ? b.working : b.confirm} />
                </button>
                <button type="button" class="secondary" disabled={busy} onClick={() => setConfirming(null)}><T t={b.back} /></button>
              </div>
            </div>
          )}
        </>
      )}
      {state && (
        <>
          <h2><T t={b.invoices} /></h2>
          {state.invoices.length === 0 ? (
            <p class="muted small"><T t={b.noInvoices} /></p>
          ) : (
            <ul class="invoices">
              {state.invoices.map((inv) => (
                <li key={inv.id}>
                  <span>{date(inv.created)}</span>
                  <span>{money(inv.total, inv.currency)}</span>
                  <span class="muted small">{inv.status === 'paid' ? <T t={b.paid} /> : inv.status === 'open' ? <T t={b.open} /> : inv.status}</span>
                  {inv.url && <a href={inv.url} target="_blank" rel="noopener noreferrer"><T t={b.view} /></a>}
                  {inv.pdf && <a href={inv.pdf} target="_blank" rel="noopener noreferrer">PDF</a>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Message error={error} />
    </div>
  );
}
