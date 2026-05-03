import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProviderBadge from '../components/ProviderBadge';
import { useApi } from '../hooks/useApi';

// ── Balances tab ──────────────────────────────────────────────
function BalancesTab() {
  const [data, setData]         = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ provider: 'anthropic', amount_usd: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const { apiFetch } = useApi();

  const fetchData = async () => {
    try {
      const res = await apiFetch(`/api/balances?range=all`);
      setData(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/balances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount_usd: parseFloat(form.amount_usd) }),
      });
      setForm({ provider: 'anthropic', amount_usd: '', note: '' });
      setShowForm(false);
      fetchData();
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    await apiFetch(`/api/balances/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const providers = data?.providers || [];
  const history   = data?.history   || [];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button className="obs-btn obs-btn-primary obs-btn-sm" onClick={() => setShowForm(s => !s)}>
          + Register recharge
        </button>
      </div>

      {/* Provider rows */}
      {providers.map((p, i) => {
        const pct = Math.min(100, p.pct_used || 0);
        const isWarn = pct > 75 && pct < 100;
        const isOver = pct >= 100;
        const fillCls = isOver ? 'error' : isWarn ? 'warning' : '';
        return (
          <div key={p.provider} style={{
            display: 'grid',
            gridTemplateColumns: '160px 160px 1fr 200px 110px',
            gap: 18, alignItems: 'center',
            padding: '18px 0',
            borderBottom: '1px solid var(--border-soft)'
          }}>
            <ProviderBadge provider={p.provider} size="lg" />
            <div>
              <div className="obs-section-label" style={{ fontSize: 10, marginBottom: 2 }}>Remaining</div>
              <div style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: 'var(--text)' }}>
                ${parseFloat(p.remaining || 0).toFixed(2)}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Consumed <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${parseFloat(p.total_spent || 0).toFixed(2)}</span>
              {' '}of <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${parseFloat(p.total_loaded || 0).toFixed(2)}</span>
            </div>
            <div className="iprog-bar">
              <div className={`iprog-fill ${fillCls}`} style={{ width: `${pct}%` }} />
            </div>
            <button className="obs-btn" style={{ justifySelf: 'end' }} onClick={() => setShowForm(true)}>
              + Add funds
            </button>
          </div>
        );
      })}

      {providers.length === 0 && (
        <div className="obs-empty">
          <div className="obs-empty-title">No balances tracked</div>
          <div className="obs-empty-sub">Register a recharge to start tracking balance</div>
        </div>
      )}

      {/* Add funds form */}
      {showForm && (
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-soft)' }}>
          <form onSubmit={handleSubmit} className="obs-form-row" style={{ flexWrap: 'wrap' }}>
            <div className="obs-field">
              <label>Provider</label>
              <select className="obs-select" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div className="obs-field">
              <label>Amount (USD)</label>
              <input className="obs-input" type="number" step="0.01" min="0.01" required placeholder="100.00"
                value={form.amount_usd} onChange={e => setForm(f => ({ ...f, amount_usd: e.target.value }))} />
            </div>
            <div className="obs-field" style={{ flex: 1 }}>
              <label>Note</label>
              <input className="obs-input" type="text" placeholder="Optional note"
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <button type="button" className="obs-btn" style={{ alignSelf: 'flex-end' }} onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="obs-btn obs-btn-primary" disabled={submitting} style={{ alignSelf: 'flex-end' }}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      )}

      {/* Recharge history */}
      {history.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="obs-section-label" style={{ marginBottom: 10 }}>Recharge history</div>
          <table className="obs-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Date</th>
                <th>Provider</th>
                <th className="col-num">Amount</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} style={{ cursor: 'default' }}>
                  <td className="col-muted col-mono">{new Date(h.recharged_at).toLocaleDateString('en-CA')}</td>
                  <td><ProviderBadge provider={h.provider} /></td>
                  <td className="col-num">${parseFloat(h.amount_usd).toFixed(2)}</td>
                  <td className="col-muted">{h.note || '—'}</td>
                  <td className="col-num">
                    <button className="obs-btn obs-btn-ghost obs-btn-sm" style={{ color: 'var(--muted)' }} onClick={() => handleDelete(h.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Budgets tab ───────────────────────────────────────────────
function BudgetsTab() {
  const [budgets, setBudgets]   = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', limit_usd: '', period: 'monthly' });
  const [submitting, setSubmitting] = useState(false);
  const { apiFetch } = useApi();

  const fetchBudgets = async () => {
    try {
      const res = await apiFetch(`/api/budgets`);
      const d = await res.json();
      setBudgets(d.data || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchBudgets(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button className="obs-btn obs-btn-primary obs-btn-sm" onClick={() => setShowForm(s => !s)}>
          + New budget
        </button>
      </div>

      {/* New budget form */}
      {showForm && (
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-soft)' }}>
          <form onSubmit={handleSubmit} className="obs-form-row" style={{ flexWrap: 'wrap' }}>
            <div className="obs-field" style={{ flex: '2 1 200px' }}>
              <label>Name</label>
              <input className="obs-input" required placeholder="e.g. Monthly production"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="obs-field">
              <label>Period</label>
              <select className="obs-select" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="obs-field">
              <label>Limit (USD)</label>
              <input className="obs-input" type="number" step="0.01" min="0.01" required placeholder="100.00"
                value={form.limit_usd} onChange={e => setForm(f => ({ ...f, limit_usd: e.target.value }))} />
            </div>
            <button type="button" className="obs-btn" style={{ alignSelf: 'flex-end' }} onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="obs-btn obs-btn-primary" disabled={submitting} style={{ alignSelf: 'flex-end' }}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      )}

      {budgets.length === 0 && !showForm ? (
        <div className="obs-empty">
          <div className="obs-empty-title">No budgets configured</div>
          <div className="obs-empty-sub">Add a budget to track spending limits</div>
        </div>
      ) : budgets.map(b => {
        const pct = Math.min(100, (parseFloat(b.spent_usd || 0) / parseFloat(b.limit_usd)) * 100);
        const isOver  = pct >= 100;
        const isWarn  = pct >= 75 && pct < 100;
        const fillCls = isOver ? 'error' : isWarn ? 'warning' : '';
        return (
          <div key={b.id} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 80px 120px 120px 1fr 80px',
            gap: 16, alignItems: 'center',
            padding: '14px 0',
            borderBottom: '1px solid var(--border-soft)'
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{b.name}</div>
            <span className="period-badge" style={{ justifySelf: 'start', textTransform: 'capitalize' }}>{b.period}</span>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Limit <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${parseFloat(b.limit_usd).toFixed(2)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Spent <span style={{ color: isOver ? 'var(--error)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                ${parseFloat(b.spent_usd || 0).toFixed(2)}
              </span>
            </div>
            <div className="iprog-bar">
              <div className={`iprog-fill ${fillCls}`} style={{ width: `${pct}%` }} />
            </div>
            <button className="obs-btn obs-btn-ghost obs-btn-sm" style={{ color: 'var(--muted)', justifySelf: 'end' }} onClick={() => handleDelete(b.id)}>
              Delete
            </button>
          </div>
        );
      })}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function Finance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'budgets' ? 'budgets' : 'balances');

  const handleTabChange = (t) => {
    setTab(t);
    setSearchParams(t === 'budgets' ? { tab: 'budgets' } : {}, { replace: true });
  };

  return (
    <main className="obs-main obs-fade-in">
      <div className="obs-header">
        <div className="obs-page-title">Finance</div>
      </div>

      <div className="obs-content" style={{ paddingTop: 0 }}>
        <div className="obs-tabbar">
          <button className={`obs-tab${tab === 'balances' ? ' active' : ''}`} onClick={() => handleTabChange('balances')}>
            Balances
          </button>
          <button className={`obs-tab${tab === 'budgets' ? ' active' : ''}`} onClick={() => handleTabChange('budgets')}>
            Budgets
          </button>
        </div>

        {tab === 'balances' && <BalancesTab />}
        {tab === 'budgets'  && <BudgetsTab />}
      </div>
    </main>
  );
}
