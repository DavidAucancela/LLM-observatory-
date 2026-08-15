import { formatCost, fmtLatency } from './fmt';

export const SEVERITY_COLOR = {
  critical: 'var(--error)',
  warning:  'var(--warning)',
  info:     'var(--success)',
};

export function severityLabel(t, severity) {
  if (severity === 'critical') return t('dashboard.insights.severityCritical');
  if (severity === 'warning')  return t('dashboard.insights.severityWarning');
  return t('dashboard.insights.severityImprovement');
}

export function titleAndDetail(t, insight) {
  const { type, model, metrics } = insight;
  switch (type) {
    case 'cost_spike':
      return {
        title: t('dashboard.insights.costSpikeTitle', { model, pct: metrics.pctChange.toFixed(0) }),
        detail: t('dashboard.insights.costSpikeDetail', {
          from: formatCost(metrics.prevCost), to: formatCost(metrics.currCost),
        }),
      };
    case 'error_rate':
      return {
        title: t('dashboard.insights.errorRateTitle', { model, pct: metrics.errorPct.toFixed(1) }),
        detail: t('dashboard.insights.errorRateDetail', {
          errors: metrics.currErrors, requests: metrics.currRequests,
        }),
      };
    case 'latency_regression':
      return {
        title: t('dashboard.insights.latencyTitle', { model, pct: metrics.pctChange.toFixed(0) }),
        detail: t('dashboard.insights.latencyDetail', {
          from: fmtLatency(metrics.prevLatency), to: fmtLatency(metrics.currLatency),
        }),
      };
    case 'improvement':
    default:
      return {
        title: t('dashboard.insights.improvementTitle', { pct: metrics.pctChange.toFixed(0) }),
        detail: t('dashboard.insights.improvementDetail', {
          from: formatCost(metrics.prevAvgCost, { small: true }), to: formatCost(metrics.currAvgCost, { small: true }),
        }),
      };
  }
}
