// Graduated error-rate severity so the dashboard's KPI card only tints red
// for genuinely alarming rates, instead of any nonzero error count.
export const ERROR_RATE_THRESHOLDS = { warning: 2, danger: 5 }; // percent

export function errorRateSeverity(pct) {
  if (pct > ERROR_RATE_THRESHOLDS.danger) return 'danger';
  if (pct > ERROR_RATE_THRESHOLDS.warning) return 'warning';
  return 'ok';
}

export function severityColor(level) {
  return { ok: 'var(--success)', warning: 'var(--warning)', danger: 'var(--error)' }[level];
}
