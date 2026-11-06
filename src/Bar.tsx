/** A thin progress meter. */
export function Bar({ value, total, label }: { value: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.round((100 * value) / total) : 0;
  return (
    <span class="stat-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}
