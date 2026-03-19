import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', limit_usd: '', period: 'monthly' });
  const [submitting, setSubmitting] = useState(false);

  const fetchBudgets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/budgets`);
      const data = await res.json();
      setBudgets(data.data || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchBudgets(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${API_URL}/api/budgets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, limit_usd: parseFloat(form.limit_usd) })
      });
      setForm({ name: '', limit_usd: '', period: 'monthly' });
      setShowForm(false);
      fetchBudgets();
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    await fetch(`${API_URL}/api/budgets/${id}`, { method: 'DELETE' });
    fetchBudgets();
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Presupuestos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Alertas de gasto por período</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
          <Plus className="w-4 h-4" /> Nuevo presupuesto
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Crear alerta de presupuesto</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nombre</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Presupuesto mensual" required
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Límite (USD)</label>
              <input type="number" step="0.01" min="0.01" value={form.limit_usd}
                onChange={e => setForm(f => ({ ...f, limit_usd: e.target.value }))} placeholder="50.00" required
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Período</label>
              <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
            <div className="col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400">Cancelar</button>
              <button type="submit" disabled={submitting} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {submitting ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {budgets.length === 0 && !showForm && (
          <div className="text-center py-16 text-slate-400">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-slate-300" />
            </div>
            <p className="font-medium text-slate-500 dark:text-slate-400">Sin presupuestos</p>
            <p className="text-sm mt-1">Crea uno para monitorear tu gasto en APIs.</p>
          </div>
        )}
        {budgets.map(budget => {
          const pct = Math.min(100, (budget.current_spend / parseFloat(budget.limit_usd)) * 100);
          const isOver = pct >= 100;
          const isWarning = pct >= 80 && !isOver;
          const periodMap = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' };
          return (
            <div key={budget.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{budget.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {periodMap[budget.period] || budget.period} · límite ${parseFloat(budget.limit_usd).toFixed(2)}
                  </p>
                </div>
                <button onClick={() => handleDelete(budget.id)} className="p-1.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-lg font-bold ${isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                      ${budget.current_spend.toFixed(4)}
                    </span>
                    <span className="text-xs text-slate-400">gastado</span>
                  </div>
                  <span className={`text-sm font-medium ${isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-400'}`}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                </div>
                {isOver && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> Presupuesto excedido
                  </div>
                )}
                {isWarning && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
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
