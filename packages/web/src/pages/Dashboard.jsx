import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ProviderBadge from '../components/ProviderBadge';
import Sparkline from '../components/Sparkline';
import MultiLineChart from '../components/MultiLineChart';
import HBar from '../components/HBar';
import { useSocket } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';
import { formatCost, fmtLatency } from '../utils/fmt';

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

function KpiCard({ label, value, delta, inverse, sparkData, accentColor = 'var(--border)', highlight }) {
  return (
    <div
      className="kpi-card"
      style={{
        '--kpi-accent': accentColor,
        ...(highlight ? { borderColor: accentColor, background: 'color-mix(in srgb, var(--error) 8%, transparent)' } : {}),
      }}
    >
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
    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '16px 0' }}>—</div>
  );

  const totalCost = byProvider.reduce((s, p) => s + parseFloat(p.total_cost || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {byProvider.map(p => {
        const cost = parseFloat(p.total_cost || 0);
        const reqs = parseInt(p.requests || 0);
        const pct  = totalCost > 0 ? (cost / totalCost) * 100 : 0;
        const color = PROVIDER_COLORS[p.provider] || 'var(--accent)';
        return (
          <div key={p.provider}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <ProviderBadge provider={p.provider} />
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--text)', fontWeight: 500, width: 46, textAlign: 'right', display: 'inline-block' }}>{formatCost(cost)}</span>
                <span style={{ width: 32, textAlign: 'right', display: 'inline-block' }}>{pct.toFixed(0)}%</span>
                <span style={{ width: 58, textAlign: 'right', display: 'inline-block' }}>{reqs.toLocaleString()} req</span>
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
              {formatCost(cost)}
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

// ── Error type breakdown ──────────────────────────────────────────────────────

function ErrorBreakdown({ breakdown, loading }) {
  const { t } = useTranslation();

  const ERROR_TYPE_LABELS = {
    auth_error:      t('dashboard.authError'),
    rate_limit:      t('dashboard.rateLimit'),
    invalid_request: t('dashboard.invalidRequest'),
    server_error:    t('dashboard.serverError'),
    network_error:   t('dashboard.networkError'),
    timeout:         t('dashboard.timeout'),
    unknown_error:   t('dashboard.unknownError'),
  };

  if (loading) return <div className="obs-skeleton" style={{ height: 60, borderRadius: 6 }} />;
  if (!breakdown?.length) return (
    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>{t('dashboard.noErrors')}</div>
  );
  const max = Math.max(...breakdown.map(e => parseInt(e.count || 0)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {breakdown.map(e => (
        <HBar
          key={e.error_type}
          label={ERROR_TYPE_LABELS[e.error_type] || e.error_type}
          value={parseInt(e.count || 0)}
          max={max}
          color="var(--error)"
          valueLabel={e.count.toString()}
        />
      ))}
    </div>
  );
}

// ── Tag breakdown ─────────────────────────────────────────────────────────────

function TagBreakdown({ range }) {
  const [tagKeys, setTagKeys]   = useState([]);
  const [tagKey, setTagKey]     = useState('');
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const { apiFetch } = useApi();
  const { t } = useTranslation();

  useEffect(() => {
    apiFetch(`/api/metrics/tag-keys?range=${range}`)
      .then(r => r.json())
      .then(d => {
        const keys = d.keys || [];
        setTagKeys(keys);
        if (keys.length && !tagKey) setTagKey(keys[0]);
      })
      .catch(() => {});
  }, [range]);

  useEffect(() => {
    if (!tagKey) return;
    setLoading(true);
    apiFetch(`/api/metrics/tag-breakdown?key=${encodeURIComponent(tagKey)}&range=${range}`)
      .then(r => r.json())
      .then(d => { setData(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tagKey, range]);

  if (!tagKeys.length) return null;

  const maxCost = Math.max(...data.map(d => parseFloat(d.total_cost || 0)), 0.0001);

  return (
    <div className="obs-card dash-sub-card" style={{ padding: '16px 20px' }}>
      <div className="dash-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="obs-section-label">{t('dashboard.tagBreakdown')}</div>
        <select
          className="obs-btn"
          style={{ height: 26, paddingTop: 0, paddingBottom: 0, fontSize: 11 }}
          value={tagKey}
          onChange={e => setTagKey(e.target.value)}
        >
          {tagKeys.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="obs-skeleton" style={{ height: 22, borderRadius: 3 }} />)}
        </div>
      ) : data.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('common.noData')}</div>
      ) : (
        <div className="dash-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.map(row => (
            <HBar
              key={row.value}
              label={String(row.value ?? '(empty)')}
              value={parseFloat(row.total_cost || 0)}
              max={maxCost}
              color="var(--accent)"
              valueLabel={formatCost(row.total_cost, { small: true })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Monthly projection with progress bar ──────────────────────────────────────

function MonthlyProjection({ projection, configuredProviders }) {
  const { t } = useTranslation();
  const items = (projection?.projection || []).filter(p => configuredProviders.includes(p.provider));
  if (!items.length) return null;

  const daysInMonth = projection?.days_in_month || 30;

  return (
    <div className="obs-card dash-sub-card" style={{ padding: '16px 20px' }}>
      <div className="dash-card-head" style={{ marginBottom: 14 }}>
        <div className="obs-section-label">{t('dashboard.monthlyProjection')}</div>
        <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{t('dashboard.thisMonth')}</div>
      </div>
      <div className="dash-scroll" style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        gap: 0,
      }}>
        {items.map((p, i) => {
          const daysPassed = daysInMonth - (p.days_remaining || 0);
          const monthPct   = Math.min(100, (daysPassed / daysInMonth) * 100);
          const spentSoFar = parseFloat(p.spent_this_month || 0);
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
                  {formatCost(projected)}
                </span>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>
                  {t('dashboard.spent')}{' '}
                  <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatCost(spentSoFar)}</span>
                </span>
                <span>{p.days_remaining > 0 ? `${p.days_remaining}d left` : 'Month end'}</span>
              </div>

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
                {t('dashboard.dailyAvg')}{' '}
                <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatCost(p.avg_daily)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Model picker (multi-select popover) ───────────────────────────────────────

function ModelPicker({ allModels, disabledModels, onToggle, onSetAll, onSetNone }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!allModels.length) return null;

  const total    = allModels.length;
  const selected = allModels.filter(m => !disabledModels.has(m.model)).length;
  const allOn    = selected === total;

  return (
    <div className="obs-modelpicker" ref={ref}>
      <button
        className={`obs-btn${allOn ? '' : ' obs-btn-active'}`}
        onClick={() => setOpen(o => !o)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {t('dashboard.models')}
        <span className="obs-modelpicker-count">
          {allOn ? t('dashboard.allModels') : t('dashboard.modelsSelected', { count: selected, total })}
        </span>
      </button>
      {open && (
        <div className="obs-modelpicker-panel">
          <div className="obs-modelpicker-actions">
            <button className="obs-btn obs-btn-sm" onClick={onSetAll}>{t('dashboard.allModels')}</button>
            <button className="obs-btn obs-btn-sm" onClick={onSetNone}>{t('dashboard.noneModels')}</button>
          </div>
          <div className="obs-modelpicker-list">
            {allModels.map(m => {
              const on = !disabledModels.has(m.model);
              const color = m.provider === 'anthropic' ? 'var(--anthropic)' : m.provider === 'openai' ? 'var(--openai)' : 'var(--accent)';
              return (
                <label key={m.model} className="obs-modelpicker-item">
                  <input type="checkbox" checked={on} onChange={() => onToggle(m.model)} />
                  <span className="dot" style={{ background: color, width: 7, height: 7, borderRadius: 2, flexShrink: 0 }} />
                  <span className="obs-modelpicker-name">{m.model}</span>
                  <span className="obs-modelpicker-reqs">{parseInt(m.requests || 0).toLocaleString()}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const RANGES = ['24h', '7d', '30d', '90d'];

export default function Dashboard() {
  const [range, setRange]         = useState(() => localStorage.getItem('obs-range') || '7d');
  const [summary, setSummary]     = useState(null);
  const [projection, setProjection] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [hasCredentials, setHasCredentials] = useState(true);
  const [configuredProviders, setConfiguredProviders] = useState([]);
  const [disabledModels, setDisabledModels] = useState(() => new Set());
  const [allModels, setAllModels] = useState([]);
  const { connected, on, off } = useSocket();
  const { apiFetch }  = useApi();
  const { t, i18n } = useTranslation();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Send the models the user has toggled off so the whole dashboard reflects
      // the selection. Derived only from `disabledModels` (not `allModels`) to
      // avoid a refetch loop, since the response also refreshes `allModels`.
      const excluded = [...disabledModels];
      const excludeParam = excluded.length
        ? `&exclude_models=${encodeURIComponent(excluded.join(','))}`
        : '';
      const [sumRes, projRes, credRes] = await Promise.all([
        apiFetch(`/api/metrics/summary?range=${range}${excludeParam}`),
        apiFetch(`/api/metrics/projection`),
        apiFetch(`/api/credentials`),
      ]);
      const sum = await sumRes.json();
      setSummary(sum);
      setAllModels(sum.all_models || []);
      setProjection(await projRes.json());
      const creds = (await credRes.json());
      const credList = creds.credentials || creds.data || [];
      setHasCredentials(credList.length > 0);
      setConfiguredProviders([...new Set(credList.map(c => c.provider))]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [range, disabledModels]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    on('new-metric', fetchAll);
    return () => off('new-metric', fetchAll);
  }, [on, off, fetchAll]);

  const s    = summary?.summary;
  const prev = summary?.prev_summary;

  const timeSeriesRaw = summary?.time_series || [];
  const hourMap = {};
  for (const row of timeSeriesRaw) {
    if (!hourMap[row.hour]) hourMap[row.hour] = { hour: row.hour, anthropic: 0, openai: 0, requests: 0, cost: 0 };
    if (row.provider === 'anthropic') hourMap[row.hour].anthropic += parseInt(row.total_tokens || 0);
    else                              hourMap[row.hour].openai    += parseInt(row.total_tokens || 0);
    hourMap[row.hour].requests += parseInt(row.requests || 0);
    hourMap[row.hour].cost     += parseFloat(row.cost_usd || 0);
  }
  const timeSeries = Object.values(hourMap).sort((a, b) => new Date(a.hour) - new Date(b.hour));

  // 24h uses hourly buckets → show hours; all other ranges use daily buckets → show dates.
  const useDate = range !== '24h';
  const axisLocale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const xLabels = timeSeries.map(r => {
    const d = new Date(r.hour);
    if (useDate) return d.toLocaleDateString(axisLocale, { month: 'short', day: 'numeric' });
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  });

  const anthData  = timeSeries.map(r => r.anthropic);
  const oaiData   = timeSeries.map(r => r.openai);
  const tokenSpark = timeSeries.map(r => r.anthropic + r.openai);
  const reqSpark   = timeSeries.map(r => r.requests);
  const costSpark  = timeSeries.map(r => r.cost);

  const byProvider     = summary?.by_provider     || [];
  const byModel        = summary?.by_model        || [];
  const errorBreakdown = summary?.error_breakdown || [];

  const errorCount = parseInt(s?.error_count || 0);
  const totalReqs  = parseInt(s?.total_requests || 0);
  const errorPct   = totalReqs > 0 ? (errorCount / totalReqs) * 100 : 0;
  const errorRate  = `${errorPct.toFixed(1)}% (${errorCount})`;

  const prevErrorCount = parseInt(prev?.error_count || 0);
  const prevTotalReqs  = parseInt(prev?.total_requests || 0);
  const prevErrorPct   = prevTotalReqs > 0 ? (prevErrorCount / prevTotalReqs) * 100 : 0;
  const errorDelta      = calcDelta(errorPct, prevErrorPct);

  if (!loading && !hasCredentials) {
    return (
      <main className="obs-main">
        <div className="obs-header">
          <div className="obs-page-title">{t('dashboard.title')}</div>
        </div>
        <div className="obs-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="obs-empty">
            <div className="obs-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="obs-empty-title">{t('dashboard.noKeysTitle')}</div>
            <div className="obs-empty-sub">{t('dashboard.noKeysSub')}</div>
            <a href="/settings" className="obs-btn obs-btn-primary" style={{ marginTop: 16, textDecoration: 'none' }}>
              {t('dashboard.addKeyButton')}
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="obs-main obs-fade-in">
      <div className="obs-header">
        <div className="obs-page-title">{t('dashboard.title')}</div>
        <div className="obs-divider-v" />
        <div className="obs-range-picker">
          {RANGES.map(r => (
            <button
              key={r}
              className={`obs-range-btn${range === r ? ' active' : ''}`}
              onClick={() => { setRange(r); localStorage.setItem('obs-range', r); }}
            >{r}</button>
          ))}
        </div>
        <ModelPicker
          allModels={allModels}
          disabledModels={disabledModels}
          onToggle={(model) => setDisabledModels(prev => {
            const next = new Set(prev);
            next.has(model) ? next.delete(model) : next.add(model);
            return next;
          })}
          onSetAll={() => setDisabledModels(new Set())}
          onSetNone={() => setDisabledModels(new Set(allModels.map(m => m.model)))}
        />
        <div className="obs-header-right">
          <div className="obs-live">
            <span className="dot dot-pulse" style={{ background: connected ? 'var(--success)' : 'var(--faint)' }} />
            <span>{connected ? t('dashboard.live') : t('dashboard.offline')}</span>
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
            {t('dashboard.refresh')}
          </button>
        </div>
      </div>

      <div className="obs-content dash-content">
        {/* KPI Cards */}
        <div className="kpi-strip dash-kpi" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <KpiCard
            label={t('activity.requestsCol')}
            value={loading ? '—' : fmt(s?.total_requests ?? 0)}
            delta={calcDelta(s?.total_requests, prev?.total_requests)}
            sparkData={reqSpark}
            accentColor="var(--text)"
          />
          <KpiCard
            label={t('activity.tokensCol')}
            value={loading ? '—' : fmt(s?.total_tokens ?? 0)}
            delta={calcDelta(s?.total_tokens, prev?.total_tokens)}
            sparkData={tokenSpark}
            accentColor="var(--tokens-color)"
          />
          <KpiCard
            label={t('dashboard.cost')}
            value={loading ? '—' : formatCost(s?.total_cost_usd)}
            delta={calcDelta(s?.total_cost_usd, prev?.total_cost_usd)}
            inverse
            sparkData={costSpark}
            accentColor="var(--cost-color)"
          />
          <KpiCard
            label={t('activity.avgLatencyCol')}
            value={loading ? '—' : fmtLatency(s?.avg_latency_ms)}
            delta={calcDelta(s?.avg_latency_ms, prev?.avg_latency_ms)}
            inverse
            accentColor="var(--latency-color)"
          />
          <KpiCard
            label="Error Rate"
            value={loading ? '—' : errorRate}
            delta={errorDelta}
            inverse
            accentColor="var(--error)"
            highlight={!loading && errorCount > 0}
          />
        </div>

        {/* Main grid: chart + sub-breakdowns (left) | side panel (right) — fits one viewport, no page scroll */}
        <div className="dash-main-grid">
          <div className="dash-col-left">
            {/* Tokens over time */}
            <div className="obs-card dash-chart-card" style={{ padding: '16px 20px' }}>
              <div className="dash-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="obs-section-label">{t('dashboard.tokensOverTime')}</div>
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
              <div className="dash-chart-body">
                {loading ? (
                  <div className="obs-skeleton" style={{ height: '100%', borderRadius: 4 }} />
                ) : timeSeries.length > 1 ? (
                  <MultiLineChart
                    series={(() => {
                      const anthTotal = anthData.reduce((a, b) => a + b, 0);
                      const oaiTotal  = oaiData.reduce((a, b) => a + b, 0);
                      const lowVolume = anthTotal > 0 && oaiTotal > 0
                        ? (anthTotal < oaiTotal ? 'anthropic' : 'openai')
                        : null;
                      return [
                        ...(configuredProviders.includes('anthropic') ? [{ name: 'Anthropic', color: 'var(--anthropic)', data: anthData, xLabels, strokeWidth: lowVolume === 'anthropic' ? 2.5 : 1.5 }] : []),
                        ...(configuredProviders.includes('openai')    ? [{ name: 'OpenAI',    color: 'var(--openai)',    data: oaiData,  xLabels, strokeWidth: lowVolume === 'openai' ? 2.5 : 1.5 }] : []),
                      ];
                    })()}
                    height={160}
                  />
                ) : (
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dashboard.notEnoughData')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Top models + Error breakdown, side by side */}
            <div className="dash-split-row">
              <div className="obs-card dash-sub-card" style={{ padding: '16px 20px' }}>
                <div className="dash-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div className="obs-section-label">{t('dashboard.topModels')}</div>
                    <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>sorted by cost</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 16 }}>
                    <span style={{ width: 52, textAlign: 'right' }}>{t('dashboard.cost')}</span>
                    <span style={{ width: 42, textAlign: 'right' }}>{t('dashboard.reqs')}</span>
                  </div>
                </div>
                <div className="dash-scroll">
                  <TopModels byModel={byModel} loading={loading} />
                </div>
              </div>

              <div className="obs-card dash-sub-card" style={{ padding: '16px 20px' }}>
                <div className="obs-section-label dash-card-head" style={{ marginBottom: 14 }}>{t('dashboard.errorsByType')}</div>
                <div className="dash-scroll">
                  <ErrorBreakdown breakdown={errorBreakdown} loading={loading} />
                </div>
              </div>
            </div>
          </div>

          {/* Side panel: provider breakdown, monthly projection, tag breakdown */}
          <div className="dash-col-right">
            <div className="obs-card dash-sub-card" style={{ padding: '16px 20px' }}>
              <div className="obs-section-label dash-card-head" style={{ marginBottom: 14 }}>{t('dashboard.byProvider')}</div>
              <div className="dash-scroll">
                <ProviderBreakdown byProvider={byProvider} loading={loading} />
              </div>
            </div>

            <MonthlyProjection projection={projection} configuredProviders={configuredProviders} />

            <TagBreakdown range={range} />
          </div>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );
}
