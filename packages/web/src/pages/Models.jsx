import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ProviderBadge from '../components/ProviderBadge';
import HBar from '../components/HBar';
import { formatCost, fmtLatency } from '../utils/fmt';
import { useApi } from '../hooks/useApi';

const RANGES = ['24h', '7d', '30d', '90d'];

const PROVIDER_COLORS = { anthropic: '#D97706', openai: '#059669', gemini: '#4285F4' };

function parseModel(m) {
  return {
    ...m,
    total_cost:   parseFloat(m.total_cost)   || 0,
    requests:     parseInt(m.requests, 10)   || 0,
    total_tokens: parseInt(m.total_tokens, 10) || 0,
    avg_latency:  parseFloat(m.avg_latency)  || 0,
  };
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

export default function Models() {
  const [range, setRange] = useState(() => localStorage.getItem('obs-range') || '7d');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const { apiFetch } = useApi();
  const { t } = useTranslation();

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/metrics/summary?range=${range}`)
      .then(r => r.json())
      .then(d => { setSummary(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  const handleRangeChange = (r) => {
    setRange(r);
    localStorage.setItem('obs-range', r);
  };

  const allModels = (summary?.by_model || []).map(parseModel);
  const maxCost = Math.max(...allModels.map(m => m.total_cost), 0.001);
  const sorted  = [...allModels].sort((a, b) => b.total_cost - a.total_cost);

  return (
    <main className="obs-main obs-fade-in">
      <div className="obs-header">
        <div className="obs-page-title">{t('activity.modelsTab')}</div>
      </div>

      <div className="obs-content" style={{ paddingTop: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <div className="obs-range-picker">
            {RANGES.map(r => (
              <button key={r} className={`obs-range-btn${range === r ? ' active' : ''}`} onClick={() => handleRangeChange(r)}>{r}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="obs-skeleton" style={{ height: 28, borderRadius: 3 }} />
            ))}
          </div>
        ) : (
          <>
            {sorted.length > 0 && (
              <>
                <div className="obs-section-label" style={{ marginBottom: 12 }}>{t('activity.costByModel')} · {range}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 32 }}>
                  {sorted.map((m, i) => (
                    <HBar
                      key={i}
                      label={m.model}
                      value={m.total_cost}
                      max={maxCost}
                      color={PROVIDER_COLORS[m.provider] ?? 'var(--text)'}
                      valueLabel={formatCost(m.total_cost, { small: true })}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="obs-section-label" style={{ marginBottom: 8 }}>{t('activity.allModels')}</div>
            <table className="obs-table">
              <thead>
                <tr>
                  <th>{t('activity.modelColumn')}</th>
                  <th>{t('activity.providerColumn')}</th>
                  <th className="col-num">{t('activity.requestsCol')}</th>
                  <th className="col-num">{t('activity.tokensCol')}</th>
                  <th className="col-num">{t('activity.totalCostCol')}</th>
                  <th className="col-num">{t('activity.avgLatencyCol')}</th>
                </tr>
              </thead>
              <tbody>
                {allModels.length === 0 ? (
                  <tr><td colSpan={6}><div className="obs-empty"><div className="obs-empty-title">{t('common.noData')}</div></div></td></tr>
                ) : [...allModels].sort((a, b) => b.requests - a.requests).map(m => (
                  <tr key={`${m.provider}-${m.model}`} style={{ cursor: 'default' }}>
                    <td className="col-mono">{m.model}</td>
                    <td><ProviderBadge provider={m.provider} /></td>
                    <td className="col-num">{m.requests.toLocaleString()}</td>
                    <td className="col-num">{fmt(m.total_tokens)}</td>
                    <td className="col-num">{formatCost(m.total_cost, { small: true })}</td>
                    <td className="col-num col-muted">{fmtLatency(m.avg_latency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </main>
  );
}
