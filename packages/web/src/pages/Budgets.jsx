import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertTriangle, DollarSign } from 'lucide-react';
import { useApi } from '../hooks/useApi';

const PERIOD_LABELS = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' };
const PERIOD_COLORS = { daily: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20', weekly: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20', monthly: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' };

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', limit_usd: '', period: 'monthly' });
  const [submitting, setSubmitting] = useState(false);
  const { apiFetch } = useApi();

  const fetchBudgets = async () => {
    try {
      const res = await apiFetch(`/api/budgets`);
      const data = await res.json();
      setBudgets(data.data || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchBudgets(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/budgets`, {
        method: 'POST',
        body: JSON.stringify({ ...form, limit_usd: parseFloat(form.limit_usd) }),
      });
      setForm({ name: '', limit_usd: '', period: 'monthly' });
      setShowForm(false);
      fetchBudgets();
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    await apiFetch(`/api/budgets/${id}`, { method: 'DELETE' });
    fetchBudgets();
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Presupuestos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Alertas de gasto por período</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-sm px-3.5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm shadow-blue-500/25"
        >
          <Plus className="w-4 h-4" />
          Nuevo presupuesto
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-card animate-fade-in">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            Crear alerta de presupuesto
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Presupuesto mensual"
                  required
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Límite (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.limit_usd}
                  onChange={e => setForm(f => ({ ...f, limit_usd: e.target.value }))}
                  placeholder="50.00"
                  required
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Período</label>
                <select
                  value={form.period}
                  onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                {submitting ? 'Creando…' : 'Crear presupuesto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Budget list */}
      <div className="space-y-4">
        {budgets.length === 0 && !showForm && (
          <div className="text-center py-20 text-slate-400">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-700">
              <DollarSign className="w-6 h-6 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="font-semibold text-slate-500 dark:text-slate-400 text-base">Sin presupuestos</p>
            <p className="text-sm mt-1.5 text-slate-400">Crea uno para monitorear tu gasto en APIs.</p>
          </div>
        )}

        {budgets.map(budget => {
          const pct = Math.min(100, (budget.current_spend / parseFloat(budget.limit_usd)) * 100);
          const isOver    = pct >= 100;
          const isWarning = pct >= 80 && !isOver;
          const barColor  = isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500';
          const periodColor = PERIOD_COLORS[budget.period] || '';

          return (
            <div key={budget.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-card hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{budget.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${periodColor}`}>
                      {PERIOD_LABELS[budget.period] || budget.period}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Límite: <span className="font-semibold text-slate-600 dark:text-slate-300">${parseFloat(budget.limit_usd).toFixed(2)}</span>
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(budget.id)}
                  className="p-1.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-end">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-bold tabular-nums ${isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                      ${budget.current_spend.toFixed(4)}
                    </span>
                    <span className="text-xs text-slate-400">gastado</span>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-400'}`}>
                    {pct.toFixed(1)}%
                  </span>
                </div>

                <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {isOver && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Presupuesto excedido
                  </div>
                )}
                {isWarning && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Más del 80% utilizado
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
