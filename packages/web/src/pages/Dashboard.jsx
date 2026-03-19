import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { Activity, DollarSign, Zap, Clock, Wifi, WifiOff, TrendingUp, RefreshCw, TrendingDown } from 'lucide-react';
import KPICard from '../components/KPICard';
import ProviderBadge from '../components/ProviderBadge';
import { useSocket } from '../hooks/useSocket';

const API_URL = import.meta.env.VITE_API_URL || '';

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function fmtHour(str) {
  const d = new Date(str);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}h`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-2">{fmtHour(label)}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-medium">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const CostTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-2">{fmtHour(label)}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-medium">${parseFloat(p.value).toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [range, setRange] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [summary, setSummary] = useState(null);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [projection, setProjection] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const { connected, on } = useSocket();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const sumParams = useCustom && customStart && customEnd
        ? `start=${customStart}T00:00:00&end=${customEnd}T23:59:59`
        : `range=${range}`;
      const [sumRes, balRes, projRes] = await Promise.all([
        fetch(`${API_URL}/api/metrics/summary?${sumParams}`),
        fetch(`${API_URL}/api/balances?range=all`),
        fetch(`${API_URL}/api/metrics/projection`)
      ]);
      setSummary(await sumRes.json());
      setBalances(await balRes.json());
      setProjection(await projRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [range, useCustom, customStart, customEnd]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    on('new-metric', () => { setLiveCount(c => c + 1); fetchAll(); });
  }, [on, fetchAll]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/sync/anthropic`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncMsg({ ok: true, text: 'Sync iniciado — los datos se actualizarán en segundos' });
        setTimeout(fetchAll, 5000);
      } else {
        setSyncMsg({ ok: false, text: data.error || 'Error al sincronizar' });
      }
    } catch {
      setSyncMsg({ ok: false, text: 'Error de conexión' });
    } finally {
      setSyncing(false);
    }
  };

  const s = summary?.summary;

  // Process time series - merge anthropic + openai by hour
  const timeSeriesRaw = summary?.time_series || [];
  const hourMap = {};
  for (const row of timeSeriesRaw) {
    const key = row.hour;
    if (!hourMap[key]) hourMap[key] = { hour: key, anthropic_tokens: 0, openai_tokens: 0, anthropic_cost: 0, openai_cost: 0 };
    if (row.provider === 'anthropic') {
      hourMap[key].anthropic_tokens += parseInt(row.total_tokens);
      hourMap[key].anthropic_cost += parseFloat(row.cost_usd);
    } else {
      hourMap[key].openai_tokens += parseInt(row.total_tokens);
      hourMap[key].openai_cost += parseFloat(row.cost_usd);
    }
  }
  const timeSeries = Object.values(hourMap).sort((a, b) => new Date(a.hour) - new Date(b.hour));

  const byProvider = summary?.by_provider || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Consumo de APIs de IA en tiempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {connected ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-slate-400" />}
            <span className={connected ? 'text-emerald-500 font-medium' : 'text-slate-400'}>
              {connected ? `En vivo${liveCount > 0 ? ` · ${liveCount} nuevos` : ''}` : 'Desconectado'}
            </span>
          </div>
          {useCustom ? (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300" />
              <span className="text-slate-400 text-xs">→</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300" />
              <button onClick={() => setUseCustom(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2">✕</button>
            </div>
          ) : (
            <select value={range} onChange={e => { if (e.target.value === 'custom') setUseCustom(true); else setRange(e.target.value); }}
              className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="60d">Últimos 60 días</option>
              <option value="90d">Últimos 90 días</option>
              <option value="custom">Rango personalizado...</option>
            </select>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Sincronizar datos desde Anthropic Admin API"
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sync'}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm ${syncMsg.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800/50'}`}>
          {syncMsg.text}
        </div>
      )}

      {/* Projection banner */}
      {projection && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projection.projection.map(p => {
            const isAnthropic = p.provider === 'anthropic';
            return (
              <div key={p.provider} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isAnthropic ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                  <TrendingDown className={`w-5 h-5 ${isAnthropic ? 'text-amber-600' : 'text-emerald-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 capitalize">{p.provider} — Proyección mensual</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">${p.projected_month_total.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">${p.spent_this_month.toFixed(2)} gastado · ${p.avg_daily.toFixed(3)}/día · {p.days_remaining}d restantes</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Balance Cards - Anthropic & OpenAI */}
      {balances && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {balances.providers.map(p => {
            const isAnthopic = p.provider === 'anthropic';
            const pct = Math.min(100, p.pct_used);
            const isWarning = pct > 75;
            const isOver = pct >= 100;
            return (
              <div key={p.provider} className={`rounded-xl border p-5 ${isAnthopic ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <ProviderBadge provider={p.provider} />
                      <span className="text-xs text-slate-500 dark:text-slate-400 capitalize font-medium">Balance de saldo</span>
                    </div>
                    <div className="flex items-baseline gap-3 mt-2">
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">${p.remaining.toFixed(2)}</span>
                      <span className="text-sm text-slate-500">restante</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Consumido</div>
                    <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">${p.total_spent.toFixed(4)}</div>
                    <div className="text-xs text-slate-400">de ${p.total_loaded.toFixed(2)} cargados</div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className={`font-medium ${isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}>
                      {isOver ? '⚠ Saldo agotado' : isWarning ? '⚠ Saldo bajo' : `${pct.toFixed(1)}% utilizado`}
                    </span>
                    <span className="text-slate-400">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : isAnthopic ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Requests" value={loading ? '–' : fmt(s?.total_requests || 0)} subtitle={`${s?.error_count || 0} errores`} icon={Activity} color="blue" />
        <KPICard title="Total Tokens" value={loading ? '–' : fmt(s?.total_tokens || 0)} subtitle={`In: ${fmt(s?.total_input_tokens || 0)} / Out: ${fmt(s?.total_output_tokens || 0)}`} icon={Zap} color="purple" />
        <KPICard title="Costo Total" value={loading ? '–' : `$${parseFloat(s?.total_cost_usd || 0).toFixed(3)}`} subtitle={`Promedio: $${parseFloat(s?.avg_cost_usd || 0).toFixed(5)}/req`} icon={DollarSign} color="green" />
        <KPICard title="Latencia Promedio" value={loading ? '–' : `${Math.round(s?.avg_latency_ms || 0)}ms`} icon={Clock} color="orange" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Token usage - Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Tokens por Proveedor</h2>
              <p className="text-xs text-slate-400 mt-0.5">Consumo acumulado por hora</p>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeSeries}>
              <defs>
                <linearGradient id="gradAnthropic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOpenAI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tickFormatter={fmtHour} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="anthropic_tokens" stroke="#f59e0b" strokeWidth={2} fill="url(#gradAnthropic)" name="Anthropic" dot={false} />
              <Area type="monotone" dataKey="openai_tokens" stroke="#10b981" strokeWidth={2} fill="url(#gradOpenAI)" name="OpenAI" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Provider cost breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Costo por Proveedor</h2>
            <p className="text-xs text-slate-400 mt-0.5">Distribución del gasto</p>
          </div>
          <div className="space-y-4">
            {byProvider.map((p, i) => {
              const totalCost = byProvider.reduce((a, b) => a + parseFloat(b.total_cost), 0);
              const pct = totalCost > 0 ? (parseFloat(p.total_cost) / totalCost * 100) : 0;
              const isAnthropic = p.provider === 'anthropic';
              return (
                <div key={p.provider}>
                  <div className="flex items-center justify-between mb-1.5">
                    <ProviderBadge provider={p.provider} />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">${parseFloat(p.total_cost).toFixed(3)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isAnthropic ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{fmt(p.requests)} requests</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
            {byProvider.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Sin datos</p>}
          </div>
        </div>
      </div>

      {/* Cost over time */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="mb-5">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Costo por Hora (USD)</h2>
          <p className="text-xs text-slate-400 mt-0.5">Gasto acumulado por proveedor</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={timeSeries} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="hour" tickFormatter={fmtHour} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `$${v.toFixed(3)}`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CostTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="anthropic_cost" name="Anthropic" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={20} />
            <Bar dataKey="openai_cost" name="OpenAI" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Model breakdown table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Top Modelos por Costo</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-slate-50 dark:bg-slate-700/30">
              <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Proveedor / Modelo</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide text-right">Requests</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide text-right">Tokens</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide text-right">Costo</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide text-right">Latencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {(summary?.by_model || []).slice(0, 8).map(m => (
              <tr key={`${m.provider}-${m.model}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <ProviderBadge provider={m.provider} />
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{m.model.replace('claude-', '').replace('gpt-', 'gpt-')}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{fmt(m.requests)}</td>
                <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{fmt(m.total_tokens)}</td>
                <td className="px-5 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">${parseFloat(m.total_cost).toFixed(3)}</td>
                <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400">{Math.round(m.avg_latency)}ms</td>
              </tr>
            ))}
            {!loading && (summary?.by_model || []).length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">Sin datos — ejecuta <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">npm run seed</code></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
