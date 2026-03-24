import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { Lightbulb, Layers } from 'lucide-react';
import ProviderBadge from '../components/ProviderBadge';

const API_URL = import.meta.env.VITE_API_URL || '';

const ANTHROPIC_COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'];
const OPENAI_COLORS    = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs">
      <p className="font-semibold text-white mb-1 truncate max-w-[180px]">{payload[0].name}</p>
      <p className="text-slate-300">Costo: <span className="text-emerald-400 font-bold">${parseFloat(payload[0].value).toFixed(4)}</span></p>
    </div>
  );
};

export default function Models() {
  const [summary, setSummary] = useState(null);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    fetch(`${API_URL}/api/metrics/summary?range=${range}`)
      .then(r => r.json()).then(setSummary).catch(console.error);
  }, [range]);

  const allModels      = summary?.by_model || [];
  const anthropicModels = allModels.filter(m => m.provider === 'anthropic');
  const openaiModels    = allModels.filter(m => m.provider === 'openai');
  const totalCost       = allModels.reduce((a, m) => a + parseFloat(m.total_cost), 0);
  const totalReqs       = allModels.reduce((a, m) => a + parseInt(m.requests), 0);

  const recommendation = (() => {
    const opus   = anthropicModels.find(m => m.model.includes('opus'));
    const sonnet = anthropicModels.find(m => m.model.includes('sonnet'));
    const gpt4   = openaiModels.find(m => m.model === 'gpt-4-turbo');
    const gpt4o  = openaiModels.find(m => m.model === 'gpt-4o' && !m.model.includes('mini'));
    const msgs = [];
    if (opus && sonnet && totalReqs > 0) {
      const pct = Math.round(parseInt(opus.requests) / totalReqs * 100);
      if (pct > 20) msgs.push(`${pct}% de tus requests usan Claude Opus. Considera migrar algunos a Sonnet (5× más barato para tareas generales).`);
    }
    if (gpt4 && gpt4o && totalReqs > 0) {
      const pct = Math.round(parseInt(gpt4.requests) / totalReqs * 100);
      if (pct > 10) msgs.push(`${pct}% usan GPT-4 Turbo. GPT-4o ofrece rendimiento similar a menor costo.`);
    }
    return msgs;
  })();

  const chartModels = allModels.map(m => ({
    ...m,
    name: m.model.replace('claude-', '').replace('gpt-', 'gpt-'),
    cost: parseFloat(m.total_cost),
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Modelos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Análisis comparativo de uso y costos</p>
        </div>
        <select value={range} onChange={e => setRange(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="24h">Últimas 24h</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
        </select>
      </div>

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
            {models.length > 0 ? (
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
              const pctCost = totalCost > 0 ? (parseFloat(m.total_cost) / totalCost * 100) : 0;
              return (
                <tr key={`${m.provider}-${m.model}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <ProviderBadge provider={m.provider} />
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{m.model}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300 tabular-nums">{parseInt(m.requests).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300 tabular-nums">{parseInt(m.total_tokens).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">${parseFloat(m.total_cost).toFixed(4)}</td>
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
    </div>
  );
}
