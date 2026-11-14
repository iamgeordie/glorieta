// The plan's two Prices, named by Stripe lookup key. The client sends only an interval; the Worker maps
// it to a lookup key and asks Stripe for the Price, so a request can never point Checkout at a Price
// that is not Glorieta's. Amounts are never in the code: they come from Stripe.

export type Interval = 'month' | 'year';

export const PRICE_LOOKUP_KEYS: Record<Interval, string> = {
  month: 'glorieta_supporter_monthly',
  year: 'glorieta_supporter_annual',
};

export const SUPPORTER_FEATURE = 'glorieta_supporter';
export const APP_TAG = 'glorieta';

export function parseInterval(value: unknown): Interval | null {
  return value === 'month' || value === 'year' ? value : null;
}

export type Locale = 'es' | 'en';

export function parseLocale(value: unknown): Locale | null {
  return value === 'es' || value === 'en' ? value : null;
}
