import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import ProviderBadge from '../components/ProviderBadge';
import Sparkline from '../components/Sparkline';
import HBar from '../components/HBar';
import ChartToolbar, { IconExpand } from '../components/ChartToolbar';
import InsightsPanel from '../components/InsightsPanel';
import { useSocket } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';
import { formatCost, fmtLatency } from '../utils/fmt';
import { buildGrid } from '../utils/metricGrid';

// three.js + @react-three/fiber/drei add ~800KB minified — lazy-load so the
// bundle for every other route stays light; only the Dashboard route pays for it.
const MetricSurface3D = lazy(() => import('../components/MetricSurface3D'));
// recharts is also lazy-loaded so a user who stays on the (default) 3D view
// never pays for it — only fetched once they switch to the 2D view.
const ModelTrendChart2D = lazy(() => import('../components/ModelTrendChart2D'));

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

function KpiCard({ label, value, delta, inverse, sparkData, accentColor = 'var(--border)', highlight, active, onClick }) {
  const emphasized = highlight || active;
  return (
    <div
      className={`kpi-card${onClick ? ' kpi-card-clickable' : ''}`}
      style={{
        '--kpi-accent': accentColor,
        ...(emphasized ? { borderColor: accentColor, background: `color-mix(in srgb, ${accentColor} 8%, transparent)` } : {}),
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
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

// Chart header label per KPI drill-down metric — kept alongside KpiCard since
// the two must stay in sync (adding a KPI card without an entry here just
// falls back to the generic tokensOverTime label).
const METRIC_HEADER_KEYS = {
  requests:  'dashboard.requestsOverTime',
  tokens:    'dashboard.tokensOverTime',
  cost:      'dashboard.costOverTime',
  latency:   'dashboard.latencyOverTime',
  errorRate: 'dashboard.errorRateOverTime',
};

// ── Provider breakdown with bars ──────────────────────────────────────────────

const PROVIDER_COLORS = { anthropic: 'var(--anthropic)', openai: 'var(--openai)', gemini: 'var(--gemini)' };
const PROVIDER_LABELS = { anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini' };

function ReconciliationBadge({ run }) {
  const { t } = useTranslation();
  if (!run) return null;
  if (run.status === 'error') return null; // job couldn't reach the provider — don't claim anything
  const deviation = parseFloat(run.deviation_pct || 0);
  const verified  = run.status !== 'alert';
  const color     = verified ? 'var(--success)' : 'var(--warning)';
  const label     = verified ? t('dashboard.reconciled') : t('dashboard.reconciliationDeviation', { pct: deviation.toFixed(1) });
  const hintKey   = run.source === 'token_estimate_fallback' ? 'dashboard.reconciliationHintFallback' : 'dashboard.reconciliationHint';
  const hint      = t(hintKey, {
    client: formatCost(parseFloat(run.client_reported_usd || 0)),
    provider: formatCost(parseFloat(run.provider_computed_usd || 0)),
  });
  return (
    <span title={hint} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600,
      letterSpacing: '.03em', textTransform: 'uppercase', color, cursor: 'help',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function ProviderBreakdown({ byProvider, loading, reconciliation }) {
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
        const run   = (reconciliation || []).find(r => r.provider === p.provider);
        return (
          <div key={p.provider}>
            {/* Provider name and the reconciliation badge stack, so the numbers
                on the right always fit — the card is one column of an auto-fit
                grid and can get down to ~320px. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <ProviderBadge provider={p.provider} />
                <ReconciliationBadge run={run} />
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right', display: 'inline-block' }}>{formatCost(cost)}</span>
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
        const color = PROVIDER_COLORS[m.provider] || 'var(--accent)';
        return (
          <div key={`${m.provider}-${m.model}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Name and bar both flex (name was a fixed 180px) so the row still
                fits when this card is one narrow column of the auto-fit grid. */}
            <div style={{
              fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
              flex: '2 1 0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={m.model}>
              {m.model}
            </div>
            <div className="iprog-bar" style={{ flex: '1 1 0', minWidth: 24, height: 5, borderRadius: 3 }}>
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
    <div className="obs-card dash-sub-card">
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

// ── Spend for the selected range, with per-provider progress bars ─────────────

const RANGE_LABEL_KEY = {
  '24h': 'dashboard.rangeLabel24h',
  '7d':  'dashboard.rangeLabel7d',
  '30d': 'dashboard.rangeLabel30d',
  '90d': 'dashboard.rangeLabel90d',
};

function RangeSpend({ byProvider, totalCost, prevTotalCost, range, configuredProviders, loading }) {
  const { t } = useTranslation();
  if (loading) return <div className="obs-skeleton" style={{ height: 120, borderRadius: 6 }} />;

  const items = (byProvider || []).filter(p => configuredProviders.includes(p.provider));
  if (!items.length) return null;

  const total = parseFloat(totalCost || 0);
  const rangeLabelKey = RANGE_LABEL_KEY[range] || RANGE_LABEL_KEY['7d'];

  return (
    <div className="obs-card dash-sub-card dash-range-spend">
      <div className="dash-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="obs-section-label">{t('dashboard.spentThisRange')}</div>
        <Delta value={calcDelta(totalCost, prevTotalCost)} inverse />
      </div>
      <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 14 }}>{t(rangeLabelKey)}</div>
      <div className="dash-scroll dash-range-spend-grid" style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        gap: 0,
      }}>
        {items.map((p, i) => {
          const cost = parseFloat(p.total_cost || 0);
          const pct  = total > 0 ? (cost / total) * 100 : 0;
          const color = PROVIDER_COLORS[p.provider] || 'var(--accent)';

          return (
            <div key={p.provider} style={{
              paddingRight: i < items.length - 1 ? 28 : 0,
              paddingLeft:  i > 0 ? 28 : 0,
              borderRight:  i < items.length - 1 ? '1px solid var(--border-soft)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <ProviderBadge provider={p.provider} size="lg" />
                <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCost(cost)}
                </span>
              </div>

              <div className="iprog-bar" style={{ height: 4, borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2, width: `${pct}%`,
                  background: color, transition: 'width 0.6s var(--ease-out)',
                }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {pct.toFixed(0)}%
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
              const color = PROVIDER_COLORS[m.provider] || 'var(--accent)';
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
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [hasCredentials, setHasCredentials] = useState(true);
  const [configuredProviders, setConfiguredProviders] = useState([]);
  const [disabledModels, setDisabledModels] = useState(() => new Set());
  const [allModels, setAllModels] = useState([]);
  const [reconciliation, setReconciliation] = useState([]);
  const [insights, setInsights] = useState([]);
  const [activeMetric, setActiveMetric] = useState('tokens');
  const [chartView, setChartView] = useState(() => localStorage.getItem('obs-chart-view') || '3d');
  // Client-side-only visual toggle for which models' bars/lines are shown in
  // the chart — unrelated to `disabledModels` above (that one is a server-side
  // filter sent as exclude_models, affecting KPIs/breakdowns too). Not
  // persisted: it's meant to be a lightweight, session-only declutter, same
  // as the toggle recharts' own <Legend> used to provide for the 2D view only.
  const [hiddenModels, setHiddenModels] = useState(() => new Set());
  const [toolbarCollapsed, setToolbarCollapsed] = useState(
    () => localStorage.getItem('obs-chart-toolbar-collapsed') === 'true'
  );
  // 2D-only, additive metrics only (requests/tokens/cost) — see ChartToolbar's
  // showCompare prop below for where the restriction is enforced.
  const [comparePrev, setComparePrev] = useState(
    () => localStorage.getItem('obs-chart-compare-prev') === 'true'
  );
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
      const [sumRes, credRes, reconRes, insightsRes] = await Promise.all([
        apiFetch(`/api/metrics/summary?range=${range}${excludeParam}`),
        apiFetch(`/api/credentials`),
        apiFetch(`/api/reconciliation/latest`),
        apiFetch(`/api/insights/summary?range=${range}`),
      ]);
      const sum = await sumRes.json();
      setSummary(sum);
      setAllModels(sum.all_models || []);
      const creds = (await credRes.json());
      const credList = creds.credentials || creds.data || [];
      setHasCredentials(credList.length > 0);
      setConfiguredProviders([...new Set(credList.map(c => c.provider))]);
      setReconciliation((await reconRes.json()).latest || []);
      setInsights((await insightsRes.json()).insights || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [range, disabledModels]);

  const handleDismissInsight = async (insightKey) => {
    setInsights(prev => prev.filter(i => i.insight_key !== insightKey));
    try {
      await apiFetch('/api/insights/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insight_key: insightKey }),
      });
    } catch (err) { console.error(err); }
  };

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
    if (!hourMap[row.hour]) hourMap[row.hour] = { hour: row.hour, byProvider: {}, requests: 0, cost: 0 };
    const tokens = parseInt(row.total_tokens || 0);
    hourMap[row.hour].byProvider[row.provider] = (hourMap[row.hour].byProvider[row.provider] || 0) + tokens;
    hourMap[row.hour].requests += parseInt(row.requests || 0);
    hourMap[row.hour].cost     += parseFloat(row.cost_usd || 0);
  }
  const timeSeries = Object.values(hourMap).sort((a, b) => new Date(a.hour) - new Date(b.hour));

  // Previous-period series, bucketed the same way as time_series but already
  // shifted onto the current period's bucket grid server-side (see
  // prev_time_series in metrics.js) — index i here lines up with index i of
  // timeSeries/xLabels, not with any real previous-period date.
  const prevTimeSeriesRaw = summary?.prev_time_series || [];
  const prevHourMap = {};
  for (const row of prevTimeSeriesRaw) {
    if (!prevHourMap[row.hour]) prevHourMap[row.hour] = { hour: row.hour, tokens: 0, requests: 0, cost: 0 };
    prevHourMap[row.hour].tokens   += parseInt(row.total_tokens || 0);
    prevHourMap[row.hour].requests += parseInt(row.requests || 0);
    prevHourMap[row.hour].cost     += parseFloat(row.cost_usd || 0);
  }
  const prevTimeSeries = Object.values(prevHourMap).sort((a, b) => new Date(a.hour) - new Date(b.hour));

  // 24h uses hourly buckets → show hours; all other ranges use daily buckets → show dates.
  const useDate = range !== '24h';
  const axisLocale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const xLabels = timeSeries.map(r => {
    const d = new Date(r.hour);
    if (useDate) return d.toLocaleDateString(axisLocale, { month: 'short', day: 'numeric' });
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  });

  const byProvider     = summary?.by_provider     || [];
  const byModel        = summary?.by_model        || [];
  const errorBreakdown = summary?.error_breakdown || [];

  // Shared model list for the chart toolbar's legend — derived independently
  // of hiddenModels, so a hidden model still shows up (dimmed) as a toggle
  // target. modelTimeSeries already reflects disabledModels' server-side
  // exclude_models filter, so a ModelPicker-disabled model can never appear here.
  const modelTimeSeries = summary?.model_time_series || [];
  const grid = useMemo(() => buildGrid(modelTimeSeries, activeMetric), [modelTimeSeries, activeMetric]);

  const toggleHiddenModel = (model) => setHiddenModels(prev => {
    const next = new Set(prev);
    next.has(model) ? next.delete(model) : next.add(model);
    return next;
  });

  const toggleToolbarCollapsed = () => setToolbarCollapsed(prev => {
    const next = !prev;
    localStorage.setItem('obs-chart-toolbar-collapsed', String(next));
    return next;
  });

  const toggleComparePrev = () => setComparePrev(prev => {
    const next = !prev;
    localStorage.setItem('obs-chart-compare-prev', String(next));
    return next;
  });

  // requests/tokens/cost are additive across providers, so a single "previous
  // period total" line is honest for them — latency/errorRate would need a
  // weighted average, not a sum, so the toggle just doesn't offer those.
  const COMPARE_METRIC_FIELD = { requests: 'total_requests', tokens: 'total_tokens', cost: 'total_cost_usd' };
  const COMPARE_SERIES_KEY   = { requests: 'requests', tokens: 'tokens', cost: 'cost' };
  const compareSupported = chartView === '2d' && Boolean(COMPARE_METRIC_FIELD[activeMetric]);
  const compareDelta = compareSupported
    ? calcDelta(s?.[COMPARE_METRIC_FIELD[activeMetric]], prev?.[COMPARE_METRIC_FIELD[activeMetric]])
    : null;
  // Sliced to match ModelTrendChart2D's trimmed grid so index i of prevSeries
  // lines up with index i of the chart's own per-model data rows.
  const prevMetricSeries = compareSupported
    ? prevTimeSeries.map(r => r[COMPARE_SERIES_KEY[activeMetric]]).slice(grid.labelOffset, grid.labelOffset + grid.hours.length)
    : null;

  const tokenSpark = timeSeries.map(r => Object.values(r.byProvider).reduce((a, b) => a + b, 0));
  const reqSpark    = timeSeries.map(r => r.requests);
  const costSpark   = timeSeries.map(r => r.cost);

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
        </div>
      </div>

      <div className="obs-content dash-content">
        <InsightsPanel insights={insights} loading={loading} range={range} onDismiss={handleDismissInsight} />

        {/* KPI Cards */}
        <div className="kpi-strip dash-kpi">
          <KpiCard
            label={t('activity.requestsCol')}
            value={loading ? '—' : fmt(s?.total_requests ?? 0)}
            delta={calcDelta(s?.total_requests, prev?.total_requests)}
            sparkData={reqSpark}
            accentColor="var(--text)"
            active={activeMetric === 'requests'}
            onClick={() => setActiveMetric('requests')}
          />
          <KpiCard
            label={t('activity.tokensCol')}
            value={loading ? '—' : fmt(s?.total_tokens ?? 0)}
            delta={calcDelta(s?.total_tokens, prev?.total_tokens)}
            sparkData={tokenSpark}
            accentColor="var(--tokens-color)"
            active={activeMetric === 'tokens'}
            onClick={() => setActiveMetric('tokens')}
          />
          <KpiCard
            label={t('dashboard.cost')}
            value={loading ? '—' : formatCost(s?.total_cost_usd)}
            delta={calcDelta(s?.total_cost_usd, prev?.total_cost_usd)}
            inverse
            sparkData={costSpark}
            accentColor="var(--cost-color)"
            active={activeMetric === 'cost'}
            onClick={() => setActiveMetric('cost')}
          />
          <KpiCard
            label={t('activity.avgLatencyCol')}
            value={loading ? '—' : fmtLatency(s?.avg_latency_ms)}
            delta={calcDelta(s?.avg_latency_ms, prev?.avg_latency_ms)}
            inverse
            accentColor="var(--latency-color)"
            active={activeMetric === 'latency'}
            onClick={() => setActiveMetric('latency')}
          />
          <KpiCard
            label={t('dashboard.errorRate')}
            value={loading ? '—' : errorRate}
            delta={errorDelta}
            inverse
            accentColor="var(--error)"
            highlight={!loading && errorCount > 0}
            active={activeMetric === 'errorRate'}
            onClick={() => setActiveMetric('errorRate')}
          />
        </div>

        {/* Chart spans the full content width; the toolbar is a vertical rail on
            its right edge (row-reverse in CSS — this stays the first DOM child
            so mobile, which switches to flex-direction:column, keeps it on top
            as a horizontal bar) so nothing eats into the plot's height. */}
        <div className="obs-card dash-chart-card">
          {toolbarCollapsed ? (
            <button
              type="button"
              className="dash-chart-expand-tab"
              title={t('dashboard.expandToolbar')}
              aria-label={t('dashboard.expandToolbar')}
              onClick={toggleToolbarCollapsed}
            >
              <IconExpand />
            </button>
          ) : (
            <ChartToolbar
              title={t(METRIC_HEADER_KEYS[activeMetric] || 'dashboard.tokensOverTime')}
              models={grid.models}
              hiddenModels={hiddenModels}
              onToggleModel={toggleHiddenModel}
              chartView={chartView}
              onSetChartView={(v) => { setChartView(v); localStorage.setItem('obs-chart-view', v); }}
              onRefresh={async () => { setSyncing(true); await fetchAll(); setSyncing(false); }}
              syncing={syncing}
              onToggleCollapsed={toggleToolbarCollapsed}
              showCompare={compareSupported}
              comparePrev={comparePrev}
              onToggleCompare={toggleComparePrev}
              compareDelta={compareDelta}
            />
          )}
          <div className="dash-chart-body">
            <Suspense fallback={<div className="obs-skeleton" style={{ height: '100%', borderRadius: 4 }} />}>
              {chartView === '3d' ? (
                <MetricSurface3D
                  modelTimeSeries={modelTimeSeries}
                  metric={activeMetric}
                  xLabels={xLabels}
                  loading={loading}
                  range={range}
                  hiddenModels={hiddenModels}
                />
              ) : (
                <ModelTrendChart2D
                  modelTimeSeries={modelTimeSeries}
                  metric={activeMetric}
                  xLabels={xLabels}
                  loading={loading}
                  hiddenModels={hiddenModels}
                  prevSeries={compareSupported && comparePrev ? prevMetricSeries : null}
                />
              )}
            </Suspense>
          </div>
        </div>

        {/* Full-width band: the providers render side by side with dividers, so
            this one card reads better spanning the row than boxed in a column. */}
        <RangeSpend
          byProvider={byProvider}
          totalCost={s?.total_cost_usd}
          prevTotalCost={prev?.total_cost_usd}
          range={range}
          configuredProviders={configuredProviders}
          loading={loading}
        />

        {/* Breakdown cards — auto-fit grid, so adding a card here reflows the
            row instead of needing a hand-tuned column split. Provider
            breakdown leads the row, then the rest of the info cards. */}
        <div className="dash-cards-grid">
          <div className="obs-card dash-sub-card">
            <div className="obs-section-label dash-card-head" style={{ marginBottom: 14 }}>{t('dashboard.byProvider')}</div>
            <div className="dash-scroll">
              <ProviderBreakdown byProvider={byProvider} loading={loading} reconciliation={reconciliation} />
            </div>
          </div>

          <div className="obs-card dash-sub-card">
            <div className="dash-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div className="obs-section-label">{t('dashboard.topModels')}</div>
                <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>sorted by cost</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 14, flexShrink: 0, whiteSpace: 'nowrap' }}>
                <span>{t('dashboard.cost')}</span>
                <span>{t('dashboard.reqs')}</span>
              </div>
            </div>
            <div className="dash-scroll">
              <TopModels byModel={byModel} loading={loading} />
            </div>
          </div>

          <div className="obs-card dash-sub-card">
            <div className="obs-section-label dash-card-head" style={{ marginBottom: 14 }}>{t('dashboard.errorsByType')}</div>
            <div className="dash-scroll">
              <ErrorBreakdown breakdown={errorBreakdown} loading={loading} />
            </div>
          </div>

          <TagBreakdown range={range} />
        </div>
      </div>
    </main>
  );
}
