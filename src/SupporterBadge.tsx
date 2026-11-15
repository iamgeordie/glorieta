import { T } from './i18n';
import { b } from './billingStrings';
import { badgeOf, billing } from './lib/billing';
import { isTv } from './lib/tv';

/** Mecenas while a plan is active, otherwise Café once any coffee is paid; nothing in TV mode. */
export function SupporterBadge({ mini = false }: { mini?: boolean }) {
  const kind = badgeOf(billing.value);
  if (!kind || isTv()) return null;
  return (
    <span class={`badge ${kind === 'supporter' ? 'supporter' : 'coffee'}${mini ? ' mini' : ''}`}>
      <T t={kind === 'supporter' ? b.badge : b.coffeeBadge} />
    </span>
  );
}
