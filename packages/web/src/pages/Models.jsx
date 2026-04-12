import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { Lightbulb, Layers, AlertTriangle, Calendar, X } from 'lucide-react';
import ProviderBadge from '../components/ProviderBadge';
import { useApi } from '../hooks/useApi';

const ANTHROPIC_COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'];
const OPENAI_COLORS    = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

// Normalize DB model rows so all numeric fields are actual numbers
function parseModel(m) {
  return {
    ...m,
    total_cost:  parseFloat(m.total_cost)  || 0,
    requests:    parseInt(m.requests,  10) || 0,
    total_tokens:parseInt(m.total_tokens, 10) || 0,
    avg_latency: parseFloat(m.avg_latency) || 0,
  };
}

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs">
      <p className="font-semibold text-white mb-1 truncate max-w-[180px]">{payload[0].name}</p>
      <p className="text-slate-300">Costo: <span className="text-emerald-400 font-bold">${payload[0].value.toFixed(4)}</span></p>
    </div>
  );
};

export default function Models() {
  const [summary, setSummary]       = useState(null);
  const [range, setRange]           = useState(() => localStorage.getItem('models-filter-range') || '30d');
  const [customStart, setCustomStart] = useState(() => localStorage.getItem('models-custom-start') || '');
  const [customEnd, setCustomEnd]     = useState(() => localStorage.getItem('models-custom-end') || '');
  const [useCustom, setUseCustom]     = useState(() => localStorage.getItem('models-use-custom') === 'true');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const { apiFetch } = useApi();

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = useCustom && customStart && customEnd
      ? `start=${customStart}T00:00:00&end=${customEnd}T23:59:59`
      : `range=${range}`;
    apiFetch(`/api/metrics/summary?${params}`)
      .then(r => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then(data => { setSummary(data); setLoading(false); })
      .catch(err => { console.error(err); setError(err.message); setLoading(false); });
  }, [range, useCustom, customStart, customEnd]);

  // Parse all numeric fields coming as strings from the DB
  const allModels       = (summary?.by_model || []).map(parseModel);
  const anthropicModels = allModels.filter(m => m.provider === 'anthropic');
  const openaiModels    = allModels.filter(m => m.provider === 'openai');
  const totalCost       = allModels.reduce((a, m) => a + m.total_cost, 0);
  const totalReqs       = allModels.reduce((a, m) => a + m.requests, 0);

  const recommendation = (() => {
    const opus   = anthropicModels.find(m => m.model?.includes('opus'));
    const sonnet = anthropicModels.find(m => m.model?.includes('sonnet'));
    const gpt4   = openaiModels.find(m => m.model === 'gpt-4-turbo');
    const gpt4o  = openaiModels.find(m => m.model === 'gpt-4o' && !m.model?.includes('mini'));
    const msgs = [];
    if (opus && sonnet && totalReqs > 0) {
      const pct = Math.round(opus.requests / totalReqs * 100);
      if (pct > 20) msgs.push(`${pct}% de tus requests usan Claude Opus. Considera migrar algunos a Sonnet (5x más barato para tareas generales).`);
    }
    if (gpt4 && gpt4o && totalReqs > 0) {
      const pct = Math.round(gpt4.requests / totalReqs * 100);
      if (pct > 10) msgs.push(`${pct}% usan GPT-4 Turbo. GPT-4o ofrece rendimiento similar a menor costo.`);
    }
    return msgs;
  })();

  const chartModels = allModels.map(m => ({
    ...m,
    name: (m.model || '').replace('claude-', '').replace('gpt-', 'gpt-'),
    cost: m.total_cost,
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Modelos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Análisis comparativo de uso y costos</p>
        </div>
        {useCustom ? (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input type="date" value={customStart}
              onChange={e => { setCustomStart(e.target.value); localStorage.setItem('models-custom-start', e.target.value); }}
              className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <span className="text-slate-300 dark:text-slate-600 text-sm">→</span>
            <input type="date" value={customEnd}
              onChange={e => { setCustomEnd(e.target.value); localStorage.setItem('models-custom-end', e.target.value); }}
              className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <button onClick={() => { setUseCustom(false); localStorage.setItem('models-use-custom', 'false'); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <select
            value={range}
            onChange={e => {
              if (e.target.value === 'custom') {
                setUseCustom(true); localStorage.setItem('models-use-custom', 'true');
              } else {
                const v = e.target.value; setRange(v); localStorage.setItem('models-filter-range', v);
              }
            }}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="60d">Últimos 60 días</option>
            <option value="90d">Últimos 90 días</option>
            <option value="custom">Rango personalizado…</option>
          </select>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 text-sm text-red-700 dark:text-red-400 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Error al cargar datos: {error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[0, 1].map(i => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-card animate-pulse">
              <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-40 mb-5" />
              <div className="h-[230px] bg-slate-50 dark:bg-slate-700/30 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Recommendations */}
          {recommendation.length > 0 && (
            <div className="space-y-2">
              {recommendation.map((msg, i) => (
                <div key={i}
                  className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3 animate-fade-in">
                  <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Pie charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[
              { label: 'Anthropic', provider: 'anthropic', models: anthropicModels, colors: ANTHROPIC_COLORS },
              { label: 'OpenAI',    provider: 'openai',    models: openaiModels,    colors: OPENAI_COLORS    },
            ].map(({ label, provider, models, colors }) => (
              <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-card">
                <div className="flex items-center gap-2 mb-5">
                  <ProviderBadge provider={provider} />
                  <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Distribución de Costo</h2>
                </div>
                {models.length > 0 && models.some(m => m.total_cost > 0) ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie
                        data={models}
                        dataKey="total_cost"
                        nameKey="model"
                        cx="50%" cy="50%"
                        innerRadius={58} outerRadius={92}
                        paddingAngle={2}
                        label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                        labelLine={false}
                      >
                        {models.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} strokeWidth={0} />)}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend
                        formatter={v => v.replace('claude-', '').replace('gpt-', 'gpt-')}
                        wrapperStyle={{ fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[230px] flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                    <Layers className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                    <span>Sin datos para este período</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-card">
            <div className="mb-5">
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Costo Total por Modelo (USD)</h2>
              <p className="text-xs text-slate-400 mt-0.5">Comparativa entre todos los modelos en uso</p>
            </div>
            {chartModels.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(160, chartModels.length * 32)}>
                <BarChart data={chartModels} layout="vertical">
                  <XAxis
                    type="number"
                    tickFormatter={v => `$${v.toFixed(3)}`}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip formatter={v => [`$${parseFloat(v).toFixed(5)}`, 'Costo']} />
                  <Bar dataKey="cost" radius={[0, 4, 4, 0]} maxBarSize={22} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Sin datos</div>
            )}
          </div>

          {/* Detailed table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-card">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/70">
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Detalle por Modelo</h2>
              <p className="text-xs text-slate-400 mt-0.5">{allModels.length} modelos activos</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/30">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-left">Modelo</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Requests</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Tokens</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Costo Total</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">% del Total</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Latencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {allModels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">
                      Sin datos para este período
                    </td>
                  </tr>
                ) : allModels.map(m => {
                  const pctCost = totalCost > 0 ? (m.total_cost / totalCost * 100) : 0;
                  return (
                    <tr key={`${m.provider}-${m.model}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <ProviderBadge provider={m.provider} />
                          <span className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{m.model}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300 tabular-nums">{m.requests.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300 tabular-nums">{m.total_tokens.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">${m.total_cost.toFixed(4)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pctCost}%` }} />
                          </div>
                          <span className="text-slate-400 text-xs tabular-nums w-10 text-right">{pctCost.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-400 tabular-nums">{Math.round(m.avg_latency)}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
