import { T } from './i18n';
import { b } from './billingStrings';
import { badgeOf, billing } from './lib/billing';

/** Mecenas while a plan is active, otherwise Café once any coffee is paid; TV mode too. */
export function SupporterBadge({ mini = false }: { mini?: boolean }) {
  const kind = badgeOf(billing.value);
  if (!kind) return null;
  return (
    <span class={`badge ${kind === 'supporter' ? 'supporter' : 'coffee'}${mini ? ' mini' : ''}`}>
      <T t={kind === 'supporter' ? b.badge : b.coffeeBadge} />
    </span>
  );
}
