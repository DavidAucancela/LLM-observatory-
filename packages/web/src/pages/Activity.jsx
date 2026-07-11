import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProviderBadge from '../components/ProviderBadge';
import RequestDrawer from '../components/RequestDrawer';
import HBar from '../components/HBar';
import { fmtDateTime, formatCost, fmtLatency } from '../utils/fmt';
import { useApi } from '../hooks/useApi';

const RANGES = ['24h', '7d', '30d', '90d'];

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

const PROVIDER_COLORS = { anthropic: '#D97706', openai: '#059669' };

// ── Requests tab ──────────────────────────────────────────────
function RequestsTab({ range, onRangeChange, configuredProviders }) {
  const [data, setData]         = useState(null);
  const [page, setPage]         = useState(1);
  const [provider, setProvider] = useState('');
  const [status, setStatus]     = useState('');
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy]     = useState('timestamp');
  const [sortDir, setSortDir]   = useState('desc');
  const [loading, setLoading]   = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [tagKeys, setTagKeys]   = useState([]);
  const [tagKey, setTagKey]     = useState('');
  const [tagValues, setTagValues] = useState([]);
  const [tagValue, setTagValue] = useState('');
  const { apiFetch } = useApi();
  const { t } = useTranslation();

  useEffect(() => {
    apiFetch(`/api/metrics/tag-keys?range=${range}`)
      .then(r => r.json())
      .then(d => setTagKeys(d.keys || []))
      .catch(() => {});
  }, [range]);

  useEffect(() => {
    if (!tagKey) { setTagValues([]); setTagValue(''); return; }
    apiFetch(`/api/metrics/tag-values?key=${encodeURIComponent(tagKey)}&range=${range}`)
      .then(r => r.json())
      .then(d => setTagValues(d.values || []))
      .catch(() => {});
  }, [tagKey, range]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20, sortBy, sortDir, range });
      if (provider) params.set('provider', provider);
      if (status)   params.set('status',   status);
      if (search)   params.set('search',   search);
      if (tagKey)   params.set('tag_key',  tagKey);
      if (tagValue) params.set('tag_value', tagValue);
      const res = await apiFetch(`/api/metrics?${params}`);
      setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, range, provider, status, search, sortBy, sortDir, tagKey, tagValue]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
    setPage(1);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ range });
      if (provider) params.set('provider', provider);
      if (status)   params.set('status',   status);
      if (search)   params.set('search',   search);
      if (tagKey)   params.set('tag_key',  tagKey);
      if (tagValue) params.set('tag_value', tagValue);
      const res = await apiFetch(`/api/metrics/export?${params}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `metrics-${range}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const total = data?.pagination?.total ?? 0;
  const pages = data?.pagination?.pages ?? 1;

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="obs-search-wrap">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="obs-search-input"
            type="text"
            placeholder={t('activity.searchPlaceholder')}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>

        <select
          className="obs-btn"
          style={{ height: 30, paddingTop: 0, paddingBottom: 0 }}
          value={provider}
          onChange={e => { setProvider(e.target.value); setPage(1); }}
        >
          <option value="">{t('activity.allProviders')}</option>
          {(configuredProviders.length ? configuredProviders : ['anthropic', 'openai']).map(p => (
            <option key={p} value={p}>{p === 'anthropic' ? 'Anthropic' : p === 'openai' ? 'OpenAI' : p}</option>
          ))}
        </select>

        <select
          className="obs-btn"
          style={{ height: 30, paddingTop: 0, paddingBottom: 0 }}
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">{t('activity.allStatuses')}</option>
          <option value="success">{t('activity.successStatus')}</option>
          <option value="error">{t('activity.errorStatus')}</option>
        </select>

        {tagKeys.length > 0 && (
          <select
            className="obs-btn"
            style={{ height: 30, paddingTop: 0, paddingBottom: 0 }}
            value={tagKey}
            onChange={e => { setTagKey(e.target.value); setTagValue(''); setPage(1); }}
          >
            <option value="">{t('activity.allTags')}</option>
            {tagKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        )}

        {tagKey && tagValues.length > 0 && (
          <select
            className="obs-btn"
            style={{ height: 30, paddingTop: 0, paddingBottom: 0 }}
            value={tagValue}
            onChange={e => { setTagValue(e.target.value); setPage(1); }}
          >
            <option value="">{t('common.all')}</option>
            {tagValues.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}

        <div className="obs-range-picker">
          {RANGES.map(r => (
            <button key={r} className={`obs-range-btn${range === r ? ' active' : ''}`} onClick={() => { onRangeChange(r); setPage(1); }}>{r}</button>
          ))}
        </div>

        <button className="obs-btn" style={{ marginLeft: 'auto' }} onClick={handleExport}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t('activity.exportCsv')}
        </button>
      </div>

      {/* Table */}
      <div className="obs-table-wrap">
      <table className="obs-table">
        <thead>
          <tr>
            <th style={{ width: 90 }}>{t('activity.timeColumn')}</th>
            <th>{t('activity.providerColumn')}</th>
            <th>{t('activity.modelColumn')}</th>
            <th className="col-num" style={{ cursor: 'pointer' }} onClick={() => handleSort('total_tokens')}>
              {t('activity.tokensColumn')} {sortBy === 'total_tokens' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th className="col-num" style={{ cursor: 'pointer' }} onClick={() => handleSort('cost_usd')}>
              {t('activity.costColumn')} {sortBy === 'cost_usd' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th className="col-num" style={{ cursor: 'pointer' }} onClick={() => handleSort('latency_ms')}>
              {t('activity.latencyColumn')} {sortBy === 'latency_ms' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th>{t('activity.statusColumn')}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j}><div className="obs-skeleton" style={{ height: 10, width: `${40 + (i * j * 7) % 40}%` }} /></td>
                ))}
              </tr>
            ))
          ) : (data?.data || []).length === 0 ? (
            <tr>
              <td colSpan={7}>
                <div className="obs-empty">
                  <div className="obs-empty-title">{t('activity.noRequests')}</div>
                </div>
              </td>
            </tr>
          ) : (data?.data || []).map(row => {
            const ok = row.status_code === 200;
            return (
              <tr key={row.id} onClick={() => setSelectedId(row.id)}>
                <td className="col-muted col-mono">{fmtDateTime(row.timestamp)}</td>
                <td><ProviderBadge provider={row.provider} /></td>
                <td className="col-mono">{row.model}</td>
                <td className="col-num">{parseInt(row.input_tokens || 0).toLocaleString()} / {parseInt(row.output_tokens || 0).toLocaleString()}</td>
                <td className="col-num">
                  {formatCost(row.cost_usd, { small: true })}
                  {row.cost_confidence === 'unknown' && (
                    <span title={t('drawer.costUnknownHint')} style={{ color: 'var(--warning)', marginLeft: 4, fontSize: 10, cursor: 'help' }}>●</span>
                  )}
                </td>
                <td className="col-num col-muted">{fmtLatency(row.latency_ms)}</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span className="dot" style={{ background: ok ? 'var(--success)' : 'var(--error)', width: 6, height: 6 }} />
                    <span style={{ fontSize: 11, color: ok ? 'var(--text)' : 'var(--error)', fontVariantNumeric: 'tabular-nums' }}>{row.status_code}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', fontSize: 12, color: 'var(--muted)' }}>
        <span>{t('activity.showing', { start: Math.min((page - 1) * 20 + 1, total), end: Math.min(page * 20, total), total: total.toLocaleString() })}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="obs-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('common.prev')}</button>
          <button className="obs-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{t('common.next')}</button>
        </div>
      </div>

      {selectedId && <RequestDrawer requestId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  );
}

// ── Models tab ────────────────────────────────────────────────
function ModelsTab({ range, onRangeChange }) {
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

  const allModels = (summary?.by_model || []).map(parseModel);
  const maxCost = Math.max(...allModels.map(m => m.total_cost), 0.001);
  const sorted  = [...allModels].sort((a, b) => b.total_cost - a.total_cost);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div className="obs-range-picker">
          {RANGES.map(r => (
            <button key={r} className={`obs-range-btn${range === r ? ' active' : ''}`} onClick={() => onRangeChange(r)}>{r}</button>
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
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function Activity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'models' ? 'models' : 'requests');
  const [range, setRange] = useState(() => localStorage.getItem('obs-range') || '7d');
  const [configuredProviders, setConfiguredProviders] = useState([]);
  const { apiFetch } = useApi();
  const { t } = useTranslation();

  useEffect(() => {
    apiFetch('/api/credentials')
      .then(r => r.json())
      .then(d => {
        const credList = d.credentials || d.data || [];
        setConfiguredProviders([...new Set(credList.map(c => c.provider))]);
      })
      .catch(() => {});
  }, []);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setSearchParams(newTab === 'models' ? { tab: 'models' } : {}, { replace: true });
  };

  const handleRangeChange = (r) => {
    setRange(r);
    localStorage.setItem('obs-range', r);
  };

  return (
    <main className="obs-main obs-fade-in">
      <div className="obs-header">
        <div className="obs-page-title">{t('activity.title')}</div>
      </div>

      <div className="obs-content" style={{ paddingTop: 0 }}>
        <div className="obs-tabbar">
          <button className={`obs-tab${tab === 'requests' ? ' active' : ''}`} onClick={() => handleTabChange('requests')}>
            {t('activity.requestsTab')}
          </button>
          <button className={`obs-tab${tab === 'models' ? ' active' : ''}`} onClick={() => handleTabChange('models')}>
            {t('activity.modelsTab')}
          </button>
        </div>

        {tab === 'requests' && <RequestsTab range={range} onRangeChange={handleRangeChange} configuredProviders={configuredProviders} />}
        {tab === 'models'   && <ModelsTab   range={range} onRangeChange={handleRangeChange} />}
      </div>
    </main>
  );
}
