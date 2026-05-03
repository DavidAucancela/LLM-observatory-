import React, { useState, useEffect, useCallback } from 'react';
import ProviderBadge from '../components/ProviderBadge';
import Sparkline from '../components/Sparkline';
import MultiLineChart from '../components/MultiLineChart';
import { useSocket } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';

function calcDelta(current, previous) {
  const c = parseFloat(current);
  const p = parseFloat(previous);
  if (!p || p === 0) return null;
  return ((c - p) / p) * 100;
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function Delta({ value, inverse }) {
  if (value === null || value === undefined || isNaN(value)) return null;
  const abs = Math.abs(value).toFixed(1);
  const up = value > 0;
  const good = inverse ? !up : up;
  return (
    <span className={`delta ${good ? 'delta-up' : 'delta-down'}`}>
      {up ? '↑' : '↓'} {abs}%
    </span>
  );
}

function KpiBlock({ label, value, delta, inverse, sparkData }) {
  return (
    <div className="kpi-block">
      <div className="kpi-label">{label}</div>
      <div className="kpi-row">
        <div className="kpi-value">{value ?? '—'}</div>
        <Delta value={delta} inverse={inverse} />
      </div>
      {sparkData?.length > 1 && (
        <div className="kpi-spark">
          <Sparkline data={sparkData} color="var(--text)" width={140} height={30} fill />
        </div>
      )}
    </div>
  );
}

const RANGES = ['24h', '7d', '30d', '90d'];

export default function Dashboard() {
  const [range, setRange] = useState(() => localStorage.getItem('dash-range') || '7d');
  const [summary, setSummary] = useState(null);
  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(true);
  const [configuredProviders, setConfiguredProviders] = useState([]);
  const { connected } = useSocket();
  const { apiFetch } = useApi();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, projRes, credRes] = await Promise.all([
        apiFetch(`/api/metrics/summary?range=${range}`),
        apiFetch(`/api/metrics/projection`),
        apiFetch(`/api/credentials`),
      ]);
      setSummary(await sumRes.json());
      setProjection(await projRes.json());
      const credData = await credRes.json();
      const creds = credData.credentials || credData.data || [];
      setHasCredentials(creds.length > 0);
      setConfiguredProviders([...new Set(creds.map(c => c.provider))]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { on } = useSocket();
  useEffect(() => { on('new-metric', fetchAll); }, [on, fetchAll]);

  const s = summary?.summary;
  const prev = summary?.prev_summary;

  const timeSeriesRaw = summary?.time_series || [];
  const hourMap = {};
  for (const row of timeSeriesRaw) {
    const key = row.hour;
    if (!hourMap[key]) hourMap[key] = { hour: key, anthropic: 0, openai: 0 };
    if (row.provider === 'anthropic') hourMap[key].anthropic += parseInt(row.total_tokens || 0);
    else hourMap[key].openai += parseInt(row.total_tokens || 0);
  }
  const timeSeries = Object.values(hourMap).sort((a, b) => new Date(a.hour) - new Date(b.hour));

  const anthData = timeSeries.map(r => r.anthropic);
  const oaiData  = timeSeries.map(r => r.openai);
  const xLabels  = timeSeries.map(r => {
    const d = new Date(r.hour);
    return `${String(d.getHours()).padStart(2,'0')}:00`;
  });

  const byProvider = summary?.by_provider || [];

  const reqSpark  = timeSeries.map(r => r.anthropic + r.openai);

  if (!loading && !hasCredentials) {
    return (
      <main className="obs-main">
        <div className="obs-header">
          <div className="obs-page-title">Overview</div>
        </div>
        <div className="obs-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="obs-empty">
            <div className="obs-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="obs-empty-title">No API keys configured</div>
            <div className="obs-empty-sub">Go to Settings → Keys to get started</div>
            <a href="/settings" className="obs-btn obs-btn-primary" style={{ marginTop: 16, textDecoration: 'none' }}>
              Add API key
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="obs-main obs-fade-in">
      {/* Header */}
      <div className="obs-header">
        <div className="obs-page-title">Overview</div>
        <div className="obs-divider-v" />
        <div className="obs-range-picker">
          {RANGES.map(r => (
            <button
              key={r}
              className={`obs-range-btn${range === r ? ' active' : ''}`}
              onClick={() => { setRange(r); localStorage.setItem('dash-range', r); }}
            >{r}</button>
          ))}
        </div>
        <div className="obs-header-right">
          <div className="obs-live">
            <span className="dot dot-pulse" style={{ background: connected ? 'var(--success)' : 'var(--faint)' }} />
            <span>{connected ? 'Live' : 'Offline'}</span>
          </div>
          <button
            className="obs-btn"
            onClick={async () => { setSyncing(true); await fetchAll(); setSyncing(false); }}
            disabled={syncing}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="obs-content">
        {/* KPI Strip */}
        <div className="kpi-strip">
          <KpiBlock
            label="Requests"
            value={loading ? '—' : fmt(s?.total_requests ?? 0)}
            delta={calcDelta(s?.total_requests, prev?.total_requests)}
            sparkData={reqSpark}
          />
          <KpiBlock
            label="Tokens"
            value={loading ? '—' : fmt(s?.total_tokens ?? 0)}
            delta={calcDelta(s?.total_tokens, prev?.total_tokens)}
            sparkData={reqSpark}
          />
          <KpiBlock
            label="Cost"
            value={loading ? '—' : `$${parseFloat(s?.total_cost_usd ?? 0).toFixed(2)}`}
            delta={calcDelta(s?.total_cost_usd, prev?.total_cost_usd)}
            inverse
            sparkData={reqSpark}
          />
          <KpiBlock
            label="Avg Latency"
            value={loading ? '—' : `${Math.round(s?.avg_latency_ms ?? 0)}ms`}
            delta={calcDelta(s?.avg_latency_ms, prev?.avg_latency_ms)}
            inverse
            sparkData={reqSpark}
          />
        </div>

        {/* Main section */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 28, marginTop: 22 }}>
          {/* Chart */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="obs-section-label">Tokens over time</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--muted)' }}>
                {configuredProviders.includes('anthropic') && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 2, background: 'var(--anthropic)', display: 'inline-block', borderRadius: 1 }} />
                    Anthropic
                  </span>
                )}
                {configuredProviders.includes('openai') && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 2, background: 'var(--openai)', display: 'inline-block', borderRadius: 1 }} />
                    OpenAI
                  </span>
                )}
              </div>
            </div>
            {loading ? (
              <div className="obs-skeleton" style={{ height: 180, borderRadius: 4 }} />
            ) : timeSeries.length > 1 ? (
              <MultiLineChart
                series={[
                  ...(configuredProviders.includes('anthropic') ? [{ name: 'Anthropic', color: 'var(--anthropic)', data: anthData, xLabels }] : []),
                  ...(configuredProviders.includes('openai')    ? [{ name: 'OpenAI',    color: 'var(--openai)',    data: oaiData,  xLabels }] : []),
                ]}
                height={180}
              />
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Not enough data for this range</span>
              </div>
            )}
          </div>

          {/* Provider breakdown */}
          <div>
            <div className="obs-section-label" style={{ marginBottom: 10 }}>Provider breakdown</div>
            {loading ? (
              <div className="obs-skeleton" style={{ height: 80, borderRadius: 4 }} />
            ) : (
              <table className="obs-table" style={{ marginTop: 4 }}>
                <thead>
                  <tr>
                    <th></th>
                    <th className="col-num">Reqs</th>
                    <th className="col-num">Tokens</th>
                    <th className="col-num">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {byProvider.length === 0 ? (
                    <tr><td colSpan={4} style={{ color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>No data</td></tr>
                  ) : byProvider.map(p => (
                    <tr key={p.provider} style={{ cursor: 'default' }}>
                      <td><ProviderBadge provider={p.provider} /></td>
                      <td className="col-num">{parseInt(p.total_requests || 0).toLocaleString()}</td>
                      <td className="col-num">{fmt(parseInt(p.total_tokens || 0))}</td>
                      <td className="col-num">${parseFloat(p.total_cost_usd || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Monthly projection */}
        {projection?.projection?.length > 0 && (
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <div className="obs-section-label" style={{ marginBottom: 14 }}>Monthly projection</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${projection.projection.filter(p => configuredProviders.includes(p.provider)).length}, 1fr)`,
              gap: 0,
            }}>
              {projection.projection.filter(p => configuredProviders.includes(p.provider)).map((p, i, arr) => (
                <div key={p.provider} style={{
                  paddingRight: i < arr.length - 1 ? 28 : 0,
                  paddingLeft:  i > 0 ? 28 : 0,
                  borderRight: i < arr.length - 1 ? '1px solid var(--border-soft)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                    <ProviderBadge provider={p.provider} size="lg" />
                    <span style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', marginLeft: 'auto', color: 'var(--text)' }}>
                      ${parseFloat(p.projected_month_total || 0).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 16 }}>
                    <span>Daily avg <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${parseFloat(p.daily_avg || 0).toFixed(2)}</span></span>
                    {p.days_remaining > 0 && <span>{p.days_remaining} days remaining</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );
}
