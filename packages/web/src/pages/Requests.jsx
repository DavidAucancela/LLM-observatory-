import React, { useState, useEffect, useCallback } from 'react';
import { Download, ChevronLeft, ChevronRight, ArrowUpDown, Search, X, Calendar } from 'lucide-react';
import ProviderBadge from '../components/ProviderBadge';
import RequestDrawer from '../components/RequestDrawer';
import { useApi } from '../hooks/useApi';

function formatDate(str) {
  return new Date(str).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Requests() {
  const [data, setData]         = useState(null);
  const [page, setPage]         = useState(1);
  const [range, setRange]       = useState(() => localStorage.getItem('req-filter-range') || '7d');
  const [provider, setProvider] = useState(() => localStorage.getItem('req-filter-provider') || '');
  const [search, setSearch]     = useState(() => localStorage.getItem('req-filter-search') || '');
  const [searchInput, setSearchInput] = useState(() => localStorage.getItem('req-filter-search') || '');
  const [customStart, setCustomStart] = useState(() => localStorage.getItem('req-custom-start') || '');
  const [customEnd, setCustomEnd]     = useState(() => localStorage.getItem('req-custom-end') || '');
  const [useCustom, setUseCustom]     = useState(() => localStorage.getItem('req-use-custom') === 'true');
  const [sortBy, setSortBy]     = useState('timestamp');
  const [sortDir, setSortDir]   = useState('desc');
  const [loading, setLoading]   = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const { apiFetch } = useApi();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20, sortBy, sortDir });
      if (useCustom && customStart && customEnd) {
        params.set('start', `${customStart}T00:00:00`);
        params.set('end',   `${customEnd}T23:59:59`);
      } else {
        params.set('range', range);
      }
      if (provider) params.set('provider', provider);
      if (search)   params.set('search', search);
      const res = await apiFetch(`/api/metrics?${params}`);
      setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, range, provider, search, sortBy, sortDir, useCustom, customStart, customEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Debounce search input → search state
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      localStorage.setItem('req-filter-search', searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
    setPage(1);
  };

  const SortBtn = ({ col, children }) => (
    <button onClick={() => handleSort(col)}
      className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group">
      {children}
      <ArrowUpDown className={`w-3 h-3 transition-colors ${sortBy === col ? 'text-blue-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
    </button>
  );

  const total = data?.pagination?.total ?? 0;

  const handleClearFilters = () => {
    setSearchInput(''); setSearch('');
    setProvider(''); setRange('7d');
    setUseCustom(false); setCustomStart(''); setCustomEnd('');
    setPage(1);
    ['req-filter-search','req-filter-provider','req-filter-range','req-use-custom','req-custom-start','req-custom-end']
      .forEach(k => localStorage.removeItem(k));
  };

  const hasActiveFilters = search || provider || useCustom || range !== '7d';

  return (
    <>
    <div className="p-6 space-y-5 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Requests</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Historial de llamadas a la API</p>
        </div>
        <button
          onClick={async () => {
            try {
              const params = new URLSearchParams();
              if (useCustom && customStart && customEnd) {
                params.set('start', `${customStart}T00:00:00`);
                params.set('end',   `${customEnd}T23:59:59`);
              } else {
                params.set('range', range);
              }
              const res = await apiFetch(`/api/metrics/export?${params}`);
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `metrics-${range}.csv`; a.click();
              URL.revokeObjectURL(url);
            } catch {}
          }}
          className="flex items-center gap-1.5 text-sm px-3.5 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>

      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search input */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por prompt o modelo…"
              className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); localStorage.removeItem('req-filter-search'); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Provider */}
          <select value={provider} onChange={e => { const v = e.target.value; setProvider(v); localStorage.setItem('req-filter-provider', v); setPage(1); }}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            <option value="">Todos los proveedores</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>

          {/* Range or custom toggle */}
          {!useCustom ? (
            <select value={range}
              onChange={e => {
                if (e.target.value === 'custom') {
                  setUseCustom(true); localStorage.setItem('req-use-custom', 'true');
                } else {
                  const v = e.target.value; setRange(v); localStorage.setItem('req-filter-range', v); setPage(1);
                }
              }}
              className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="60d">Últimos 60 días</option>
              <option value="90d">Últimos 90 días</option>
              <option value="custom">Rango personalizado…</option>
            </select>
          ) : (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input type="date" value={customStart}
                onChange={e => { setCustomStart(e.target.value); localStorage.setItem('req-custom-start', e.target.value); setPage(1); }}
                className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              <span className="text-slate-300 dark:text-slate-600 text-sm">→</span>
              <input type="date" value={customEnd}
                onChange={e => { setCustomEnd(e.target.value); localStorage.setItem('req-custom-end', e.target.value); setPage(1); }}
                className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              <button onClick={() => { setUseCustom(false); localStorage.setItem('req-use-custom', 'false'); setPage(1); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <button onClick={handleClearFilters}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Result count */}
        <p className="text-xs text-slate-400">
          {loading ? '…' : <><span className="font-medium text-slate-600 dark:text-slate-300">{total.toLocaleString()}</span> requests{search ? ` para "${search}"` : ''}</>}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Modelo</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <SortBtn col="total_tokens">Tokens</SortBtn>
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <SortBtn col="cost_usd">Costo</SortBtn>
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <SortBtn col="latency_ms">Latencia</SortBtn>
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Prompt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded" style={{ width: `${45 + (i * j * 7) % 35}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (data?.data || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <p className="text-slate-400 text-sm">
                      {search ? `Sin resultados para "${search}"` : 'Sin requests en este período'}
                    </p>
                  </td>
                </tr>
              ) : (data?.data || []).map(row => (
                <tr key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors cursor-pointer group">
                  <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{formatDate(row.timestamp)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ProviderBadge provider={row.provider} />
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                        {row.model.replace('claude-', '').replace('gpt-', 'gpt-')}
                      </span>
                      {row.tags && Object.keys(row.tags).length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(row.tags).map(([k, v]) => (
                            <span key={k} className="text-[10px] px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full font-mono">
                              {k}:{String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-700 dark:text-slate-300 font-medium tabular-nums">
                    {parseInt(row.total_tokens).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ${parseFloat(row.cost_usd).toFixed(5)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-400 tabular-nums">{row.latency_ms}ms</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                      row.status_code === 200
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {row.status_code}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400 dark:text-slate-500 max-w-[180px] truncate">
                    {row.prompt_preview || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.pagination && (
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-700/10">
            <span className="text-xs text-slate-500">
              <span className="font-medium text-slate-700 dark:text-slate-300">{data.pagination.total.toLocaleString()}</span> requests — página{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">{data.pagination.page}</span> de{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">{data.pagination.pages || 1}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors text-slate-500">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                disabled={page >= data.pagination.pages}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors text-slate-500">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {selectedId && (
      <RequestDrawer requestId={selectedId} onClose={() => setSelectedId(null)} />
    )}
    </>
  );
}
