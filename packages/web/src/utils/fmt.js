// Shared date formatting utilities used across all pages

const DATE_OPTS = { day: '2-digit', month: 'short', year: 'numeric' };
const TIME_OPTS = { hour: '2-digit', minute: '2-digit', hour12: false };

/** "23 May 2026, 14:30" — for timestamped events (requests, alerts, syncs) */
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', DATE_OPTS) + ', ' +
         d.toLocaleTimeString('en-GB', TIME_OPTS);
}

/** "23 May 2026" — for date-only fields (joined, expires, created) */
export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', DATE_OPTS);
}

/**
 * "$0.92" for totals/KPIs, "$0.0043" for small per-request amounts that would
 * otherwise round to $0.00. Pass `small: true` for per-row/per-request costs.
 */
export function formatCost(usd, { small = false } = {}) {
  const n = parseFloat(usd) || 0;
  return `$${n.toFixed(small ? 4 : 2)}`;
}
