import React, { useState, useEffect, useCallback } from 'react';
import ProviderBadge from '../components/ProviderBadge';
import Sparkline from '../components/Sparkline';
import MultiLineChart from '../components/MultiLineChart';
import { useSocket } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcDelta(current, previous) {
  const c = parseFloat(current);
  const p = parseFloat(previous);
  if (!p) return null;
  return ((c - p) / p) * 100;
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function fmtCost(v) {
  return `$${parseFloat(v || 0).toFixed(4)}`;
}

function Delta({ value, inverse }) {
  if (value === null || value === undefined || isNaN(value)) return null;
  const up   = value > 0;
  const good = inverse ? !up : up;
  return (
    <span className={`delta ${good ? 'delta-up' : 'delta-down'}`}>
      {up ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, delta, inverse, sparkData, accentColor = 'var(--border)' }) {
  return (
    <div className="kpi-card" style={{ '--kpi-accent': accentColor }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-row">
        <div className="kpi-value">{value ?? '—'}</div>
        <Delta value={delta} inverse={inverse} />
      </div>
      {sparkData?.length > 1 && (
        <div className="kpi-spark">
          <Sparkline data={sparkData} color={accentColor} height={32} fill />
        </div>
      )}
    </div>
  );
}

// ── Provider breakdown with bars ──────────────────────────────────────────────

const PROVIDER_COLORS = { anthropic: 'var(--anthropic)', openai: 'var(--openai)' };

function ProviderBreakdown({ byProvider, loading }) {
  if (loading) return <div className="obs-skeleton" style={{ height: 90, borderRadius: 6 }} />;
  if (!byProvider.length) return (
    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '16px 0' }}>No data</div>
  );

  const totalCost = byProvider.reduce((s, p) => s + parseFloat(p.total_cost_usd || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {byProvider.map(p => {
        const cost = parseFloat(p.total_cost_usd || 0);
        const reqs = parseInt(p.total_requests || 0);
        const pct  = totalCost > 0 ? (cost / totalCost) * 100 : 0;
        const color = PROVIDER_COLORS[p.provider] || 'var(--accent)';
        return (
          <div key={p.provider}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <ProviderBadge provider={p.provider} />
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>${cost.toFixed(2)}</span>
                <span>{pct.toFixed(0)}%</span>
                <span>{reqs.toLocaleString()} req</span>
              </div>
            </div>
            <div className="iprog-bar" style={{ height: 5, borderRadius: 3 }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${pct}%`,
                background: color,
                transition: 'width 0.6s var(--ease-out)',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Top models mini-section ───────────────────────────────────────────────────

function TopModels({ byModel, loading }) {
  if (loading) return <div className="obs-skeleton" style={{ height: 70, borderRadius: 6 }} />;
  if (!byModel?.length) return null;

  const top = byModel.slice(0, 5);
  const maxCost = Math.max(...top.map(m => parseFloat(m.total_cost || 0)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {top.map(m => {
        const cost = parseFloat(m.total_cost || 0);
        const pct  = maxCost > 0 ? (cost / maxCost) * 100 : 0;
        const color = m.provider === 'anthropic' ? 'var(--anthropic)' : m.provider === 'openai' ? 'var(--openai)' : 'var(--accent)';
        return (
          <div key={`${m.provider}-${m.model}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
              width: 180, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {m.model}
            </div>
            <div className="iprog-bar" style={{ flex: 1, height: 5, borderRadius: 3 }}>
              <div style={{
                height: '100%', borderRadius: 3, width: `${pct}%`,
                background: color, transition: 'width 0.6s var(--ease-out)',
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', width: 52, textAlign: 'right', flexShrink: 0 }}>
              ${cost.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', width: 42, textAlign: 'right', flexShrink: 0 }}>
              {parseInt(m.requests || 0).toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Monthly projection with progress bar ──────────────────────────────────────

function MonthlyProjection({ projection, configuredProviders }) {
  const items = (projection?.projection || []).filter(p => configuredProviders.includes(p.provider));
  if (!items.length) return null;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
      <div className="obs-section-label" style={{ marginBottom: 16 }}>Monthly projection</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        gap: 0,
      }}>
        {items.map((p, i) => {
          const daysPassed = daysInMonth - (p.days_remaining || 0);
          const monthPct   = Math.min(100, (daysPassed / daysInMonth) * 100);
          const spentSoFar = parseFloat(p.daily_avg || 0) * daysPassed;
          const projected  = parseFloat(p.projected_month_total || 0);
          const color      = PROVIDER_COLORS[p.provider] || 'var(--accent)';

          return (
            <div key={p.provider} style={{
              paddingRight: i < items.length - 1 ? 28 : 0,
              paddingLeft:  i > 0 ? 28 : 0,
              borderRight:  i < items.length - 1 ? '1px solid var(--border-soft)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <ProviderBadge provider={p.provider} size="lg" />
                <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  ${projected.toFixed(2)}
                </span>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>
                  Spent <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${spentSoFar.toFixed(2)}</span>
                </span>
                <span>{p.days_remaining > 0 ? `${p.days_remaining}d left` : 'Month end'}</span>
              </div>

              {/* Month progress */}
              <div className="iprog-bar" style={{ height: 4, borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2, width: `${monthPct}%`,
                  background: color, transition: 'width 0.6s var(--ease-out)',
                }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4, display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
                <span>Day 1</span>
                <span>Day {daysInMonth}</span>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                Daily avg <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${parseFloat(p.daily_avg || 0).toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const RANGES = ['24h', '7d', '30d', '90d'];

export default function Dashboard() {
  const [range, setRange]         = useState(() => localStorage.getItem('dash-range') || '7d');
  const [summary, setSummary]     = useState(null);
  const [projection, setProjection] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [hasCredentials, setHasCredentials] = useState(true);
  const [configuredProviders, setConfiguredProviders] = useState([]);
  const { connected } = useSocket();
  const { apiFetch }  = useApi();

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
      const creds = (await credRes.json());
      const credList = creds.credentials || creds.data || [];
      setHasCredentials(credList.length > 0);
      setConfiguredProviders([...new Set(credList.map(c => c.provider))]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { on } = useSocket();
  useEffect(() => { on('new-metric', fetchAll); }, [on, fetchAll]);

  const s    = summary?.summary;
  const prev = summary?.prev_summary;

  // Time series → per-provider arrays
  const timeSeriesRaw = summary?.time_series || [];
  const hourMap = {};
  for (const row of timeSeriesRaw) {
    if (!hourMap[row.hour]) hourMap[row.hour] = { hour: row.hour, anthropic: 0, openai: 0 };
    if (row.provider === 'anthropic') hourMap[row.hour].anthropic += parseInt(row.total_tokens || 0);
    else                              hourMap[row.hour].openai    += parseInt(row.total_tokens || 0);
  }
  const timeSeries = Object.values(hourMap).sort((a, b) => new Date(a.hour) - new Date(b.hour));

  // X-axis label format: HH:00 for short ranges, MMM D for longer
  const useDate = ['30d', '90d'].includes(range);
  const xLabels = timeSeries.map(r => {
    const d = new Date(r.hour);
    return useDate
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : `${String(d.getHours()).padStart(2, '0')}:00`;
  });

  const anthData = timeSeries.map(r => r.anthropic);
  const oaiData  = timeSeries.map(r => r.openai);
  const reqSpark = timeSeries.map(r => r.anthropic + r.openai);

  const byProvider = summary?.by_provider || [];
  const byModel    = summary?.by_model    || [];

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
        {/* KPI Cards */}
        <div className="kpi-strip">
          <KpiCard
            label="Requests"
            value={loading ? '—' : fmt(s?.total_requests ?? 0)}
            delta={calcDelta(s?.total_requests, prev?.total_requests)}
            sparkData={reqSpark}
            accentColor="var(--text)"
          />
          <KpiCard
            label="Tokens"
            value={loading ? '—' : fmt(s?.total_tokens ?? 0)}
            delta={calcDelta(s?.total_tokens, prev?.total_tokens)}
            sparkData={reqSpark}
            accentColor="var(--tokens-color)"
          />
          <KpiCard
            label="Cost"
            value={loading ? '—' : `$${parseFloat(s?.total_cost_usd ?? 0).toFixed(2)}`}
            delta={calcDelta(s?.total_cost_usd, prev?.total_cost_usd)}
            inverse
            sparkData={reqSpark}
            accentColor="var(--cost-color)"
          />
          <KpiCard
            label="Avg Latency"
            value={loading ? '—' : `${Math.round(s?.avg_latency_ms ?? 0)}ms`}
            delta={calcDelta(s?.avg_latency_ms, prev?.avg_latency_ms)}
            inverse
            sparkData={reqSpark}
            accentColor="var(--latency-color)"
          />
        </div>

        {/* Chart + Provider breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Tokens over time */}
          <div className="obs-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="obs-section-label">Tokens over time</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
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
          <div className="obs-card" style={{ padding: '16px 20px' }}>
            <div className="obs-section-label" style={{ marginBottom: 14 }}>By provider</div>
            <ProviderBreakdown byProvider={byProvider} loading={loading} />
          </div>
        </div>

        {/* Top models */}
        {(byModel.length > 0 || loading) && (
          <div className="obs-card" style={{ marginTop: 16, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="obs-section-label">Top models</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 16 }}>
                <span style={{ width: 52, textAlign: 'right' }}>Cost</span>
                <span style={{ width: 42, textAlign: 'right' }}>Reqs</span>
              </div>
            </div>
            <TopModels byModel={byModel} loading={loading} />
          </div>
        )}

        {/* Monthly projection */}
        <MonthlyProjection projection={projection} configuredProviders={configuredProviders} />

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );
}
