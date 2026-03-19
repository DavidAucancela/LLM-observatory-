import React, { useState, useEffect, useCallback } from 'react';
import { Download, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import ProviderBadge from '../components/ProviderBadge';
import RequestDrawer from '../components/RequestDrawer';

const API_URL = import.meta.env.VITE_API_URL || '';

function formatDate(str) {
  return new Date(str).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Requests() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [range, setRange] = useState('7d');
  const [provider, setProvider] = useState('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20, range, sortBy, sortDir });
      if (provider) params.set('provider', provider);
      const res = await fetch(`${API_URL}/api/metrics?${params}`);
      setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, range, provider, sortBy, sortDir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
    setPage(1);
  };

  const SortBtn = ({ col, children }) => (
    <button onClick={() => handleSort(col)} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
      {children}
      <ArrowUpDown className={`w-3 h-3 ${sortBy === col ? 'text-blue-500' : 'text-slate-300'}`} />
    </button>
  );

  return (
    <>
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Requests</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Historial de llamadas a la API</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={provider} onChange={e => { setProvider(e.target.value); setPage(1); }}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <option value="">Todos los proveedores</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
          <select value={range} onChange={e => { setRange(e.target.value); setPage(1); }}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </select>
          <button
            onClick={() => window.open(`${API_URL}/api/metrics/export?range=${range}`, '_blank')}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 text-left"><span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Timestamp</span></th>
                <th className="px-5 py-3 text-left"><span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Proveedor / Modelo</span></th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide"><SortBtn col="total_tokens">Tokens</SortBtn></th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide"><SortBtn col="cost_usd">Costo</SortBtn></th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide"><SortBtn col="latency_ms">Latencia</SortBtn></th>
                <th className="px-5 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Prompt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (data?.data || []).length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Sin requests en este período</td></tr>
              ) : (data?.data || []).map(row => (
                <tr key={row.id} onClick={() => setSelectedId(row.id)} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(row.timestamp)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <ProviderBadge provider={row.provider} />
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                        {row.model.replace('claude-', '').replace('gpt-', 'gpt-')}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-700 dark:text-slate-300 font-medium">{parseInt(row.total_tokens).toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">${parseFloat(row.cost_usd).toFixed(5)}</td>
                  <td className="px-5 py-3.5 text-right text-slate-500 dark:text-slate-400">{row.latency_ms}ms</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.status_code === 200 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                      {row.status_code}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400 dark:text-slate-500 max-w-[200px] truncate">{row.prompt_preview || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.pagination && (
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {data.pagination.total.toLocaleString()} requests — página {data.pagination.page} de {data.pagination.pages || 1}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <button onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))} disabled={page >= data.pagination.pages}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4 text-slate-500" />
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
