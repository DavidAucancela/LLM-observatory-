import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import ProviderBadge from '../components/ProviderBadge';

const API_URL = import.meta.env.VITE_API_URL || '';

const ANTHROPIC_COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'];
const OPENAI_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-medium text-white mb-1">{payload[0].name}</p>
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

  const allModels = summary?.by_model || [];
  const anthropicModels = allModels.filter(m => m.provider === 'anthropic');
  const openaiModels = allModels.filter(m => m.provider === 'openai');
  const totalCost = allModels.reduce((a, m) => a + parseFloat(m.total_cost), 0);
  const totalReqs = allModels.reduce((a, m) => a + parseInt(m.requests), 0);

  const recommendation = (() => {
    const opus = anthropicModels.find(m => m.model.includes('opus'));
    const sonnet = anthropicModels.find(m => m.model.includes('sonnet'));
    const gpt4 = openaiModels.find(m => m.model === 'gpt-4-turbo');
    const gpt4o = openaiModels.find(m => m.model === 'gpt-4o' && !m.model.includes('mini'));
    const msgs = [];
    if (opus && sonnet && totalReqs > 0) {
      const pct = Math.round(parseInt(opus.requests) / totalReqs * 100);
      if (pct > 20) msgs.push(`${pct}% de tus requests usan Claude Opus. Considera migrar algunos a Sonnet (5x más barato para tareas generales).`);
    }
    if (gpt4 && gpt4o && totalReqs > 0) {
      const pct = Math.round(parseInt(gpt4.requests) / totalReqs * 100);
      if (pct > 10) msgs.push(`${pct}% usan GPT-4 Turbo. GPT-4o ofrece rendimiento similar a menor costo.`);
    }
    return msgs;
  })();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Modelos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Análisis comparativo de uso y costos</p>
        </div>
        <select value={range} onChange={e => setRange(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          <option value="24h">Últimas 24h</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
        </select>
      </div>

      {recommendation.length > 0 && (
        <div className="space-y-2">
          {recommendation.map((msg, i) => (
            <div key={i} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
              <span className="text-base flex-shrink-0">💡</span>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pie charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[{ label: 'Anthropic', models: anthropicModels, colors: ANTHROPIC_COLORS }, { label: 'OpenAI', models: openaiModels, colors: OPENAI_COLORS }].map(({ label, models, colors }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ProviderBadge provider={label.toLowerCase()} />
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Distribución de Costo</h2>
            </div>
            {models.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={models} dataKey="total_cost" nameKey="model" cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    label={({ model, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}>
                    {models.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend formatter={(v) => v.replace('claude-', '').replace('gpt-', 'gpt-')} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">Sin datos</div>}
          </div>
        ))}
      </div>

      {/* Bar chart - cost comparison */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white text-sm mb-5">Costo Total por Modelo (USD)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={allModels.map(m => ({ ...m, name: m.model.replace('claude-', '').replace('gpt-', 'gpt-'), cost: parseFloat(m.total_cost) }))} layout="vertical">
            <XAxis type="number" tickFormatter={v => `$${v.toFixed(3)}`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={v => [`$${parseFloat(v).toFixed(5)}`, 'Costo']} />
            <Bar dataKey="cost" radius={[0, 4, 4, 0]} maxBarSize={22} fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Detalle por Modelo</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/30">
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-left">Modelo</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Requests</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Tokens</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Costo Total</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">% del Total</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Latencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {allModels.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">Sin datos para este período</td></tr>
            ) : allModels.map(m => (
              <tr key={`${m.provider}-${m.model}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <ProviderBadge provider={m.provider} />
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{m.model}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{parseInt(m.requests).toLocaleString()}</td>
                <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{parseInt(m.total_tokens).toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">${parseFloat(m.total_cost).toFixed(4)}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalCost > 0 ? (parseFloat(m.total_cost) / totalCost * 100) : 0}%` }} />
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs w-10 text-right">
                      {totalCost > 0 ? ((parseFloat(m.total_cost) / totalCost) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400">{Math.round(m.avg_latency)}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
