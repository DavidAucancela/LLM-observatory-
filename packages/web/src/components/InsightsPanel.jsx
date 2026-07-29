import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sparkline from './Sparkline';
import { formatCost, fmtLatency } from '../utils/fmt';

const SEVERITY_COLOR = {
  critical: 'var(--error)',
  warning:  'var(--warning)',
  info:     'var(--success)',
};

function severityLabel(t, severity) {
  if (severity === 'critical') return t('dashboard.insights.severityCritical');
  if (severity === 'warning')  return t('dashboard.insights.severityWarning');
  return t('dashboard.insights.severityImprovement');
}

function titleAndDetail(t, insight) {
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

function InsightCard({ insight, range, onDismiss }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const color = SEVERITY_COLOR[insight.severity];
  const { title, detail } = titleAndDetail(t, insight);

  const goToDetail = () => {
    if (insight.type === 'improvement') { navigate('/models'); return; }
    const params = new URLSearchParams({ model: insight.model });
    if (insight.type === 'error_rate') params.set('status', 'error');
    navigate(`/activity?${params}`);
  };

  return (
    <div className="insight-card" style={{ '--insight-sev': color }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em', color,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }} />
          {severityLabel(t, insight.severity)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--faint)' }}>{t(`dashboard.rangeLabel${range}`)}</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.005em' }}>{title}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>{detail}</div>

      {insight.spark?.length > 1 && (
        <div style={{ height: 28, marginBottom: 10 }}>
          <Sparkline data={insight.spark} color={color} height={28} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button className="obs-btn obs-btn-sm" style={{ color: 'var(--accent)' }} onClick={goToDetail}>
          {insight.type === 'error_rate'    ? t('dashboard.insights.viewErrors')
            : insight.type === 'improvement' ? t('dashboard.insights.viewModels')
            : t('dashboard.insights.viewDetails')}
        </button>
        <button className="obs-btn obs-btn-sm obs-btn-ghost" onClick={() => onDismiss(insight.insight_key)}>
          {insight.type === 'improvement' ? t('dashboard.insights.dismiss') : t('dashboard.insights.dismiss24h')}
        </button>
      </div>
    </div>
  );
}

export default function InsightsPanel({ insights, loading, range, onDismiss }) {
  if (loading && !insights.length) {
    return (
      <div className="insight-row">
        {[...Array(2)].map((_, i) => <div key={i} className="obs-skeleton" style={{ height: 132, borderRadius: 10 }} />)}
      </div>
    );
  }

  if (!insights.length) return null;

  return (
    <div className="insight-row">
      {insights.map(insight => (
        <InsightCard key={insight.insight_key} insight={insight} range={range} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
