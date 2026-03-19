import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ProviderBadge from '../components/ProviderBadge';

const API_URL = import.meta.env.VITE_API_URL || '';

function formatDate(str) {
  return new Date(str).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Providers() {
  const [data, setData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: 'anthropic', amount_usd: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/balances?range=all`);
      setData(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${API_URL}/api/balances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount_usd: parseFloat(form.amount_usd) })
      });
      setForm({ provider: 'anthropic', amount_usd: '', note: '' });
      setShowForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    await fetch(`${API_URL}/api/balances/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const providers = data?.providers || [];
  const history = data?.history || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Proveedores</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gestiona saldos de Anthropic y OpenAI</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" /> Registrar recarga
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {providers.map(p => {
          const isAnthropic = p.provider === 'anthropic';
          const pct = Math.min(100, p.pct_used);
          const isWarning = pct > 75;
          const isOver = pct >= 100;
          return (
            <div key={p.provider} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isAnthropic ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                  {isAnthropic ? '🔶' : '🟢'}
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white capitalize">{p.provider}</div>
                  <ProviderBadge provider={p.provider} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">Cargado</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">${p.total_loaded.toFixed(2)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">Consumido</div>
                  <div className="text-lg font-bold text-red-500">${p.total_spent.toFixed(3)}</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${isOver ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                  <div className="text-xs text-slate-500 mb-1">Restante</div>
                  <div className={`text-lg font-bold ${isOver ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>${p.remaining.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className={isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-500'}>
                    {isOver ? '⚠️ Saldo agotado' : isWarning ? '⚠️ Saldo bajo (>75%)' : 'En uso'}
                  </span>
                  <span className="text-slate-400">{pct.toFixed(1)}% utilizado</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : isAnthropic ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add recharge form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Nueva Recarga</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Proveedor</label>
              <select
                value={form.provider}
                onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Monto (USD)</label>
              <input
                type="number" step="0.01" min="0.01"
                value={form.amount_usd}
                onChange={e => setForm(f => ({ ...f, amount_usd: e.target.value }))}
                placeholder="50.00"
                required
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nota (opcional)</label>
              <input
                type="text"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Recarga mensual"
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400">Cancelar</button>
              <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {submitting ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Historial de Recargas</h2>
          <span className="text-xs text-slate-400">{history.length} recargas</span>
        </div>
        {history.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No hay recargas registradas</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/30">
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-left">Proveedor</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Monto</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-left">Nota</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-left">Fecha</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {history.map(h => (
                <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-5 py-3"><ProviderBadge provider={h.provider} /></td>
                  <td className="px-5 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">${parseFloat(h.amount_usd).toFixed(2)}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{h.note || '—'}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(h.recharged_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleDelete(h.id)} className="p-1.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
