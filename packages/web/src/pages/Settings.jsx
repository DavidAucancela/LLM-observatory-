import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ProviderBadge from '../components/ProviderBadge';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthProvider';
import { fmtDateTime, fmtDate } from '../utils/fmt';

// ── Keys tab ──────────────────────────────────────────────────
function KeyRow({ cred, onDeleted, onTested, isAdmin }) {
  const { apiFetch } = useApi();
  const { t } = useTranslation();
  const [testing,  setTesting]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing,  setSyncing]  = useState(false);
  const [syncOk,   setSyncOk]   = useState(null);
  const [testErr,  setTestErr]  = useState(null);

  const handleTest = async () => {
    setTesting(true); setTestErr(null);
    try {
      const res = await apiFetch(`/api/credentials/${cred.id}/test`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) {
        setTestErr(d.error || `Error ${res.status}`);
        return;
      }
      onTested(cred.id, d.valid);
      if (!d.valid && d.error) setTestErr(d.error);
    } catch (e) { setTestErr(e.message); } finally { setTesting(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete key "${cred.label}"?`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/credentials/${cred.id}`, { method: 'DELETE' });
      onDeleted(cred.id);
    } finally { setDeleting(false); }
  };

  const handleSync = async () => {
    setSyncing(true); setSyncOk(null);
    try {
      const res = await apiFetch(`/api/credentials/${cred.id}/ping`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { setSyncOk(false); return; }
      setSyncOk(d.success ?? false);
      if (d.success) setTimeout(() => setSyncOk(null), 3000);
    } catch { setSyncOk(false); } finally { setSyncing(false); }
  };

  const isValid = cred.is_valid;
  const tested  = !!cred.last_tested_at;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 110px 170px 100px auto',
      gap: 14, alignItems: 'center',
      padding: '11px 0',
      borderBottom: '1px solid var(--border-soft)'
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{cred.label}</div>
        {testErr && <span style={{ fontSize: 11, color: 'var(--error)' }}>{testErr}</span>}
      </div>
      <ProviderBadge provider={cred.provider} />
      <span className="kchip">{cred.key_hint}</span>
      <span className={`vbadge ${!tested ? '' : isValid ? 'vbadge-valid' : 'vbadge-invalid'}`}>
        <span className="dot" style={{ background: !tested ? 'var(--faint)' : isValid ? 'var(--success)' : 'var(--error)', width: 5, height: 5 }} />
        {!tested ? t('settings.keys.untested') : isValid ? t('settings.keys.valid') : t('settings.keys.invalid')}
      </span>
      <div style={{ display: 'flex', gap: 5 }}>
        {cred.key_type === 'sdk' && (
          <button className="obs-btn obs-btn-sm" disabled={syncing} onClick={handleSync}>
            {syncing ? '…' : t('settings.keys.syncButton')}
          </button>
        )}
        <button className="obs-btn obs-btn-sm" disabled={testing} onClick={handleTest}>
          {testing ? '…' : t('settings.keys.testButton')}
        </button>
        {isAdmin && (
          <button className="obs-btn obs-btn-ghost obs-btn-sm" disabled={deleting} onClick={handleDelete}
            style={{ color: 'var(--muted)' }}>
            {deleting ? '…' : t('common.delete')}
          </button>
        )}
      </div>
    </div>
  );
}

function AddKeyForm({ onSaved, onCancel }) {
  const { apiFetch } = useApi();
  const { t } = useTranslation();
  const [form, setForm]   = useState({ provider: 'anthropic', key_type: 'sdk', label: '', value: '' });
  const [show, setShow]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.label.trim() || !form.value.trim()) return;
    setSaving(true); setError('');
    try {
      const res = await apiFetch('/api/credentials', { method: 'POST', body: JSON.stringify(form) });
      const d = await res.json();
      if (res.ok) { onSaved(d.data); }
      else { setError(Array.isArray(d.error) ? d.error.map(e => e.message).join(', ') : (d.error || 'Error saving')); }
    } catch { setError('Connection error'); } finally { setSaving(false); }
  };

  const phLabel = form.provider === 'anthropic' ? (form.key_type === 'admin' ? 'sk-ant-admin-…' : 'sk-ant-api03-…') : (form.key_type === 'admin' ? 'sk-admin-…' : 'sk-proj-…');

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-soft)', marginBottom: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto auto', gap: 10, alignItems: 'flex-end' }}>
        <div className="obs-field">
          <label>{t('settings.keys.labelField')}</label>
          <input className="obs-input obs-input-lg" placeholder={t('settings.keys.labelPlaceholder')} value={form.label} onChange={e => set('label', e.target.value)} />
        </div>
        <div className="obs-field">
          <label>{t('settings.keys.providerTypeField')}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select className="obs-select" style={{ height: 36, flex: 1 }} value={form.provider} onChange={e => set('provider', e.target.value)}>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
            <select className="obs-select" style={{ height: 36, flex: 1 }} value={form.key_type} onChange={e => set('key_type', e.target.value)}>
              <option value="sdk">{t('settings.keys.sdkType')}</option>
              <option value="admin">{t('settings.keys.adminType')}</option>
            </select>
          </div>
        </div>
        <div className="obs-field" style={{ position: 'relative' }}>
          <label>{t('settings.keys.apiKeyField')}</label>
          <input
            className="obs-input obs-input-lg"
            type={show ? 'text' : 'password'}
            placeholder={phLabel}
            value={form.value}
            onChange={e => set('value', e.target.value)}
            style={{ fontFamily: 'var(--font-mono)', paddingRight: 32 }}
          />
          <button type="button" onClick={() => setShow(v => !v)}
            style={{ position: 'absolute', right: 8, bottom: 8, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>
            {show ? t('auth.hidePassword') : t('auth.showPassword')}
          </button>
        </div>
        <button className="obs-btn" onClick={onCancel} style={{ alignSelf: 'flex-end', height: 36 }}>{t('common.cancel')}</button>
        <button className="obs-btn obs-btn-primary" disabled={saving} onClick={handleSave} style={{ alignSelf: 'flex-end', height: 36 }}>
          {saving ? '…' : t('common.save')}
        </button>
      </div>
      {error && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--error)' }}>{error}</div>}
    </div>
  );
}

function KeysTab() {
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'admin';
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchCredentials = async () => {
    try {
      const res = await apiFetch('/api/credentials');
      const d = await res.json();
      setCredentials(d.credentials || d.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCredentials(); }, []);

  const handleDeleted = (id) => setCredentials(cs => cs.filter(c => c.id !== id));
  const handleTested  = (id, isValid) => setCredentials(cs => cs.map(c => c.id === id ? { ...c, is_valid: isValid, last_tested_at: new Date().toISOString() } : c));
  const handleSaved   = (cred) => { setCredentials(cs => [cred, ...cs]); setShowForm(false); };

  const sdkKeys   = credentials.filter(c => c.key_type === 'sdk');
  const adminKeys = credentials.filter(c => c.key_type === 'admin');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="obs-section-label">{t('settings.keys.sdkTitle')}</div>
        {isAdmin && <button className="obs-btn obs-btn-primary obs-btn-sm" onClick={() => setShowForm(v => !v)}>{t('settings.keys.addButton')}</button>}
      </div>

      {showForm && <AddKeyForm onSaved={handleSaved} onCancel={() => setShowForm(false)} />}

      {loading ? (
        <div className="obs-skeleton" style={{ height: 40, borderRadius: 4 }} />
      ) : sdkKeys.length === 0 && !showForm ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>{t('settings.keys.noSdk')}</div>
      ) : (
        sdkKeys.map(c => <KeyRow key={c.id} cred={c} onDeleted={handleDeleted} onTested={handleTested} isAdmin={isAdmin} />)
      )}

      <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="obs-section-label">{t('settings.keys.adminTitle')}</div>
      </div>

      {!loading && adminKeys.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>{t('settings.keys.noAdmin')}</div>
      ) : (
        adminKeys.map(c => <KeyRow key={c.id} cred={c} onDeleted={handleDeleted} onTested={handleTested} isAdmin={isAdmin} />)
      )}

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {t('settings.keys.encryption')}
      </div>

      <ObservatoryTokensSection />
    </>
  );
}

// ── Observatory Tokens section ─────────────────────────────────────────
function ObservatoryTokensSection() {
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'admin';
  const [tokens, setTokens]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchTokens = async () => {
    try {
      const d = await (await apiFetch('/api/tokens')).json();
      setTokens(d.tokens || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchTokens(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const d = await (await apiFetch('/api/tokens', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })).json();
      if (d.success) { setNewToken(d.data); setName(''); fetchTokens(); }
    } finally { setSaving(false); }
  };

  const handleRevoke = async (id) => {
    if (!confirm('Revoke this token? SDK calls using it will stop working.')) return;
    await apiFetch(`/api/tokens/${id}`, { method: 'DELETE' });
    fetchTokens();
  };

  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="obs-section-label">{t('settings.keys.tokensSection')}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
        {t('settings.keys.tokensInfo')}
      </div>

      {newToken && (
        <div style={{ background: 'color-mix(in oklab, var(--success) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--success) 30%, transparent)', borderRadius: 6, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, marginBottom: 6 }}>{t('settings.keys.tokenCreated')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, flex: 1, wordBreak: 'break-all', color: 'var(--text)' }}>{newToken.token}</code>
            <button className="obs-btn obs-btn-sm" onClick={() => copy(newToken.token, 'new')}>
              {copiedId === 'new' ? t('common.copied') : t('common.copy')}
            </button>
          </div>
          <button style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setNewToken(null)}>
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            className="obs-input"
            placeholder={t('settings.keys.tokenNamePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button className="obs-btn obs-btn-primary obs-btn-sm" disabled={!name.trim() || saving} onClick={handleCreate}>
            {saving ? '…' : t('settings.keys.createButton')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="obs-skeleton" style={{ height: 36, borderRadius: 4 }} />
      ) : tokens.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>{t('settings.keys.noTokens')}</div>
      ) : tokens.map(tok => (
        <div key={tok.id} style={{
          display: 'grid', gridTemplateColumns: '1fr 140px 110px auto',
          gap: 12, alignItems: 'center',
          padding: '10px 0', borderBottom: '1px solid var(--border-soft)',
          opacity: tok.revoked_at ? 0.45 : 1,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{tok.name}</div>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{tok.token_prefix}…</code>
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {tok.last_used_at ? t('settings.keys.lastUsed', { date: fmtDateTime(tok.last_used_at) }) : t('settings.keys.neverUsed')}
          </span>
          <span style={{ fontSize: 11, color: tok.revoked_at ? 'var(--error)' : 'var(--muted)' }}>
            {tok.revoked_at ? t('settings.keys.revokedStatus') : t('settings.keys.createdDate', { date: fmtDate(tok.created_at) })}
          </span>
          {isAdmin && !tok.revoked_at && (
            <button className="obs-btn obs-btn-ghost obs-btn-sm" style={{ color: 'var(--muted)' }} onClick={() => handleRevoke(tok.id)}>
              {t('common.revoke')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Sync tab ──────────────────────────────────────────────────
function SyncTab() {
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'admin';
  const [logs, setLogs]         = useState([]);
  const [syncing, setSyncing]   = useState({});
  const [clearing, setClearing] = useState({});
  const [syncDays, setSyncDays] = useState('30');
  const [msg, setMsg]           = useState(null);

  const fetchLogs = async () => {
    try { const d = await (await apiFetch('/api/sync/logs')).json(); setLogs(d.logs || []); } catch {}
  };
  useEffect(() => { fetchLogs(); }, []);

  const handleSync = async (provider) => {
    setSyncing(s => ({ ...s, [provider]: true })); setMsg(null);
    try {
      const d = await (await apiFetch(`/api/sync/${provider}?days=${syncDays}`, { method: 'POST' })).json();
      setMsg(d.success ? { ok: true, text: `Sync started for ${provider}` } : { ok: false, text: d.error || 'Sync error' });
      setTimeout(fetchLogs, 5000);
    } catch { setMsg({ ok: false, text: 'Connection error' }); }
    finally { setSyncing(s => ({ ...s, [provider]: false })); }
  };

  const handleClear = async (provider) => {
    if (!confirm(`Delete ALL ${provider} data? This cannot be undone.`)) return;
    setClearing(s => ({ ...s, [provider]: true })); setMsg(null);
    try {
      const d = await (await apiFetch(`/api/sync/${provider}/data`, { method: 'DELETE' })).json();
      setMsg(d.success ? { ok: true, text: `${d.deleted} records deleted` } : { ok: false, text: 'Error' });
    } catch { setMsg({ ok: false, text: 'Connection error' }); }
    finally { setClearing(s => ({ ...s, [provider]: false })); }
  };

  const stateColor = (s) => s === 'success' ? 'var(--success)' : s === 'error' ? 'var(--error)' : 'var(--accent)';

  return (
    <>
      {['anthropic', 'openai'].map(p => (
        <div key={p} style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr auto auto',
          gap: 14, alignItems: 'center',
          padding: '16px 0',
          borderBottom: '1px solid var(--border-soft)'
        }}>
          <ProviderBadge provider={p} size="lg" />
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {logs.find(l => l.provider === p) ? (
              <>{t('settings.sync.lastSync')}{' '}<span style={{ color: 'var(--text)' }}>{fmtDateTime(logs.find(l => l.provider === p).started_at)}</span></>
            ) : t('settings.sync.neverSynced')}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isAdmin && (
              <>
                <select className="obs-select" style={{ height: 30 }} value={syncDays} onChange={e => setSyncDays(e.target.value)}>
                  <option value="7">{t('settings.sync.days7')}</option>
                  <option value="30">{t('settings.sync.days30')}</option>
                  <option value="60">{t('settings.sync.days60')}</option>
                  <option value="90">{t('settings.sync.days90')}</option>
                </select>
                <button className="obs-btn obs-btn-primary obs-btn-sm" disabled={syncing[p]} onClick={() => handleSync(p)}>
                  {syncing[p] ? '…' : t('settings.sync.runButton')}
                </button>
              </>
            )}
          </div>
          {isAdmin && (
            <button className="obs-btn obs-btn-danger obs-btn-sm" disabled={clearing[p]} onClick={() => handleClear(p)}>
              {clearing[p] ? '…' : t('settings.sync.clearButton')}
            </button>
          )}
        </div>
      ))}

      {msg && (
        <div style={{ marginTop: 10, fontSize: 12, color: msg.ok ? 'var(--success)' : 'var(--error)' }}>{msg.text}</div>
      )}

      {logs.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="obs-section-label" style={{ marginBottom: 10 }}>{t('settings.sync.logTitle')}</div>
          {logs.slice(0, 10).map(l => (
            <div key={l.id} style={{
              display: 'grid', gridTemplateColumns: '14px 120px 1fr 80px 90px',
              gap: 12, alignItems: 'center', padding: '8px 0',
              fontSize: 12, borderBottom: '1px solid var(--border-soft)'
            }}>
              <span className="dot" style={{ background: stateColor(l.status), width: 7, height: 7 }} />
              <ProviderBadge provider={l.provider} />
              <span style={{ color: l.status === 'error' ? 'var(--error)' : 'var(--muted)' }}>
                {l.error_message || (l.status === 'running' ? t('settings.sync.inProgress') : t('settings.sync.completed'))}
              </span>
              <span style={{ color: 'var(--muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {l.records_synced > 0 ? `+${l.records_synced}` : '—'}
              </span>
              <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right' }}>
                {fmtDateTime(l.started_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Alerts tab ────────────────────────────────────────────────
function AlertsTab() {
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'admin';
  const [rules, setRules]       = useState([]);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ provider: 'all', threshold_usd: '', discord_webhook_url: '', debounce_hours: '6' });
  const [saving, setSaving]     = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testMsg, setTestMsg]   = useState({});

  const fetchData = async () => {
    try {
      const [r, h] = await Promise.all([
        apiFetch('/api/alerts/rules').then(r => r.json()),
        apiFetch('/api/alerts/history').then(r => r.json()),
      ]);
      setRules(r.rules || []); setHistory(h.history || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.threshold_usd || !form.discord_webhook_url) return;
    setSaving(true);
    try {
      const d = await (await apiFetch('/api/alerts/rules', {
        method: 'POST',
        body: JSON.stringify({ ...form, threshold_usd: parseFloat(form.threshold_usd), debounce_hours: parseInt(form.debounce_hours) || 6 })
      })).json();
      if (d.success) { setShowForm(false); setForm({ provider: 'all', threshold_usd: '', discord_webhook_url: '', debounce_hours: '6' }); fetchData(); }
    } finally { setSaving(false); }
  };

  const toggleEnabled = async (rule) => {
    await apiFetch(`/api/alerts/rules/${rule.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !rule.enabled }) });
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this rule?')) return;
    await apiFetch(`/api/alerts/rules/${id}`, { method: 'DELETE' }); fetchData();
  };

  const handleTest = async (id) => {
    setTestingId(id); setTestMsg({});
    try {
      const d = await (await apiFetch(`/api/alerts/rules/${id}/test`, { method: 'POST' })).json();
      setTestMsg({ [id]: { ok: d.success, text: d.success ? t('settings.alerts.testSuccess') : t('settings.alerts.testError') } });
    } finally { setTestingId(null); }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
        {isAdmin && <button className="obs-btn obs-btn-primary obs-btn-sm" onClick={() => setShowForm(v => !v)}>{t('settings.alerts.newRule')}</button>}
      </div>

      {showForm && (
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-soft)', marginBottom: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="obs-field">
              <label>{t('settings.alerts.providerLabel')}</label>
              <select className="obs-select" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
                <option value="all">{t('settings.alerts.allProviders')}</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div className="obs-field">
              <label>{t('settings.alerts.thresholdLabel')}</label>
              <input className="obs-input" type="number" step="0.01" min="0" placeholder="10.00"
                value={form.threshold_usd} onChange={e => setForm(f => ({ ...f, threshold_usd: e.target.value }))} />
            </div>
            <div className="obs-field">
              <label>{t('settings.alerts.debounceLabel')}</label>
              <select className="obs-select" value={form.debounce_hours} onChange={e => setForm(f => ({ ...f, debounce_hours: e.target.value }))}>
                <option value="1">1h</option><option value="2">2h</option><option value="6">6h</option>
                <option value="12">12h</option><option value="24">24h</option>
              </select>
            </div>
          </div>
          <div className="obs-field" style={{ marginTop: 10 }}>
            <label>{t('settings.alerts.webhookLabel')}</label>
            <input className="obs-input" type="url" placeholder={t('settings.alerts.webhookPlaceholder')}
              style={{ fontFamily: 'var(--font-mono)' }}
              value={form.discord_webhook_url} onChange={e => setForm(f => ({ ...f, discord_webhook_url: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button className="obs-btn obs-btn-primary obs-btn-sm" disabled={saving} onClick={handleSave}>{saving ? '…' : t('common.save')}</button>
            <button className="obs-btn obs-btn-sm" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="obs-skeleton" style={{ height: 40, borderRadius: 4 }} />
      ) : rules.length === 0 && !showForm ? (
        <div className="obs-empty">
          <div className="obs-empty-title">{t('settings.alerts.noRules')}</div>
          <div className="obs-empty-sub">{t('settings.alerts.rulesHint')}</div>
        </div>
      ) : rules.map(rule => (
        <div key={rule.id} style={{
          display: 'grid',
          gridTemplateColumns: '140px 140px 80px 1fr 28px 64px 64px',
          gap: 12, alignItems: 'center',
          padding: '13px 0',
          borderBottom: '1px solid var(--border-soft)',
          opacity: rule.enabled ? 1 : 0.5
        }}>
          {rule.provider === 'all'
            ? <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('settings.alerts.allProviders')}</span>
            : <ProviderBadge provider={rule.provider} />
          }
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>Threshold </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>${parseFloat(rule.threshold_usd).toFixed(2)}{t('settings.alerts.perDay')}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{rule.debounce_hours || 6}h {t('settings.alerts.debounceDisplay')}</div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rule.discord_webhook_url}
          </div>
          {isAdmin
            ? <button className={`tsw ${rule.enabled ? 'on' : ''}`} onClick={() => toggleEnabled(rule)} title={rule.enabled ? t('common.disable') : t('common.enable')} />
            : <span />
          }
          <div>
            <button className="obs-btn obs-btn-sm" disabled={testingId === rule.id} onClick={() => handleTest(rule.id)}>
              {testingId === rule.id ? '…' : t('common.test')}
            </button>
            {testMsg[rule.id] && (
              <div style={{ fontSize: 10, marginTop: 2, color: testMsg[rule.id].ok ? 'var(--success)' : 'var(--error)' }}>
                {testMsg[rule.id].text}
              </div>
            )}
          </div>
          {isAdmin && (
            <button className="obs-btn obs-btn-ghost obs-btn-sm" style={{ color: 'var(--muted)' }} onClick={() => handleDelete(rule.id)}>
              {t('common.delete')}
            </button>
          )}
        </div>
      ))}

      {history.length > 0 && (
        <details style={{ marginTop: 28 }}>
          <summary style={{
            listStyle: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9" /></svg>
            {t('settings.alerts.recentAlerts')} ({history.length})
          </summary>
          {history.slice(0, 10).map(h => (
            <div key={h.id} style={{
              display: 'grid', gridTemplateColumns: '14px 70px 120px 1fr',
              gap: 12, alignItems: 'center', padding: '8px 0',
              fontSize: 12, borderBottom: '1px solid var(--border-soft)'
            }}>
              <span className="dot" style={{ background: h.success ? 'var(--success)' : 'var(--error)', width: 7, height: 7 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                {fmtDateTime(h.sent_at)}
              </span>
              <ProviderBadge provider={h.provider} />
              <span style={{ color: 'var(--muted)' }}>${parseFloat(h.current_value).toFixed(4)} vs limit ${parseFloat(h.threshold_usd).toFixed(2)}</span>
            </div>
          ))}
        </details>
      )}
    </>
  );
}

// ── Team tab ──────────────────────────────────────────────────
function TeamTab() {
  const { apiFetch } = useApi();
  const { user }     = useAuth();
  const { t }        = useTranslation();
  const PAGE_SIZE = 20;
  const [members, setMembers]             = useState([]);
  const [membersTotal, setMembersTotal]   = useState(0);
  const [membersPage, setMembersPage]     = useState(1);
  const [invites, setInvites]             = useState([]);
  const [invitesTotal, setInvitesTotal]   = useState(0);
  const [invitesPage, setInvitesPage]     = useState(1);
  const [loading, setLoading]             = useState(true);
  const [inviteEmail, setInviteEmail]     = useState('');
  const [inviteRole, setInviteRole]       = useState('member');
  const [inviting, setInviting]           = useState(false);
  const [msg, setMsg]                     = useState(null);

  const fetchAll = async (mPage = 1, iPage = 1) => {
    try {
      const [m, i] = await Promise.all([
        apiFetch(`/api/team/members?page=${mPage}&limit=${PAGE_SIZE}`).then(r => r.json()),
        apiFetch(`/api/team/invitations?page=${iPage}&limit=${PAGE_SIZE}`).then(r => r.json()),
      ]);
      setMembers(m.members || []);
      setMembersTotal(m.total || 0);
      setMembersPage(mPage);
      setInvites(i.invitations || []);
      setInvitesTotal(i.total || 0);
      setInvitesPage(iPage);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const handleMembersPage = (page) => {
    apiFetch(`/api/team/members?page=${page}&limit=${PAGE_SIZE}`)
      .then(r => r.json())
      .then(d => { setMembers(d.members || []); setMembersTotal(d.total || 0); setMembersPage(page); })
      .catch(() => {});
  };

  const handleInvitesPage = (page) => {
    apiFetch(`/api/team/invitations?page=${page}&limit=${PAGE_SIZE}`)
      .then(r => r.json())
      .then(d => { setInvites(d.invitations || []); setInvitesTotal(d.total || 0); setInvitesPage(page); })
      .catch(() => {});
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true); setMsg(null);
    try {
      const res = await apiFetch('/api/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const d = await res.json();
      if (res.ok) { setMsg({ ok: true, text: 'Invitation sent' }); setInviteEmail(''); fetchAll(1, 1); }
      else         { setMsg({ ok: false, text: d.error || 'Error sending invitation' }); }
    } finally { setInviting(false); }
  };

  const handleRemove = async (userId, email) => {
    if (!confirm(`Remove ${email} from the organization?`)) return;
    await apiFetch(`/api/team/members/${userId}`, { method: 'DELETE' });
    fetchAll(1, 1);
  };

  const handleCancelInvite = async (id) => {
    await apiFetch(`/api/team/invitations/${id}`, { method: 'DELETE' });
    fetchAll(1, 1);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div className="obs-section-label" style={{ marginBottom: 4 }}>{t('settings.team.orgLabel')}</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{user?.orgName || '—'}</div>
      </div>

      {isAdmin && (
        <div style={{ marginBottom: 24 }}>
          <div className="obs-section-label" style={{ marginBottom: 10 }}>{t('settings.team.inviteLabel')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="obs-input"
              type="email"
              placeholder={t('settings.team.emailPlaceholder')}
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              style={{ flex: 1 }}
            />
            <select className="obs-select" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: 110 }}>
              <option value="member">{t('settings.team.memberRole')}</option>
              <option value="admin">{t('settings.team.adminRole')}</option>
            </select>
            <button className="obs-btn obs-btn-primary obs-btn-sm" disabled={!inviteEmail.trim() || inviting} onClick={handleInvite}>
              {inviting ? t('settings.team.inviting') : t('settings.team.inviteButton')}
            </button>
          </div>
          {msg && <div style={{ marginTop: 6, fontSize: 12, color: msg.ok ? 'var(--success)' : 'var(--error)' }}>{msg.text}</div>}
        </div>
      )}

      <div className="obs-section-label" style={{ marginBottom: 10 }}>
        {t('settings.team.membersLabel')}{membersTotal > 0 ? ` (${membersTotal})` : ''}
      </div>
      {loading ? (
        <div className="obs-skeleton" style={{ height: 40, borderRadius: 4 }} />
      ) : members.map(m => (
        <div key={m.id} style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 130px auto',
          gap: 12, alignItems: 'center',
          padding: '10px 0', borderBottom: '1px solid var(--border-soft)',
        }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{m.email}</div>
            {m.invited_by_email && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t('settings.team.invitedBy')} {m.invited_by_email}</div>}
          </div>
          <span className="kchip" style={{ textTransform: 'capitalize' }}>{m.role}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('settings.team.joinedLabel')} {fmtDate(m.joined_at)}</span>
          {isAdmin && m.id !== user?.id && (
            <button className="obs-btn obs-btn-ghost obs-btn-sm" style={{ color: 'var(--muted)' }} onClick={() => handleRemove(m.id, m.email)}>
              {t('common.remove')}
            </button>
          )}
        </div>
      ))}
      {membersTotal > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
          <button className="obs-btn obs-btn-sm" disabled={membersPage <= 1} onClick={() => handleMembersPage(membersPage - 1)}>←</button>
          <span>{t('settings.team.page', { page: membersPage, pages: Math.ceil(membersTotal / PAGE_SIZE) })}</span>
          <button className="obs-btn obs-btn-sm" disabled={membersPage >= Math.ceil(membersTotal / PAGE_SIZE)} onClick={() => handleMembersPage(membersPage + 1)}>→</button>
        </div>
      )}

      {isAdmin && invitesTotal > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="obs-section-label" style={{ marginBottom: 10 }}>{t('settings.team.invitationsLabel')} ({invitesTotal})</div>
          {invites.map(inv => (
            <div key={inv.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 130px auto',
              gap: 12, alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--border-soft)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{inv.email}</span>
              <span className="kchip" style={{ textTransform: 'capitalize' }}>{inv.role}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('settings.team.expiresLabel')} {fmtDate(inv.expires_at)}</span>
              <button className="obs-btn obs-btn-ghost obs-btn-sm" style={{ color: 'var(--muted)' }} onClick={() => handleCancelInvite(inv.id)}>
                {t('settings.team.cancelInvite')}
              </button>
            </div>
          ))}
          {invitesTotal > PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
              <button className="obs-btn obs-btn-sm" disabled={invitesPage <= 1} onClick={() => handleInvitesPage(invitesPage - 1)}>←</button>
              <span>{t('settings.team.page', { page: invitesPage, pages: Math.ceil(invitesTotal / PAGE_SIZE) })}</span>
              <button className="obs-btn obs-btn-sm" disabled={invitesPage >= Math.ceil(invitesTotal / PAGE_SIZE)} onClick={() => handleInvitesPage(invitesPage + 1)}>→</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function Settings() {
  const [tab, setTab] = useState('keys');
  const { t } = useTranslation();

  return (
    <main className="obs-main obs-fade-in">
      <div className="obs-header">
        <div className="obs-page-title">{t('settings.title')}</div>
      </div>

      <div className="obs-content" style={{ paddingTop: 0 }}>
        <div className="obs-tabbar">
          <button className={`obs-tab${tab === 'keys'   ? ' active' : ''}`} onClick={() => setTab('keys')}>{t('settings.keysTab')}</button>
          <button className={`obs-tab${tab === 'sync'   ? ' active' : ''}`} onClick={() => setTab('sync')}>{t('settings.syncTab')}</button>
          <button className={`obs-tab${tab === 'alerts' ? ' active' : ''}`} onClick={() => setTab('alerts')}>{t('settings.alertsTab')}</button>
          <button className={`obs-tab${tab === 'team'   ? ' active' : ''}`} onClick={() => setTab('team')}>{t('settings.teamTab')}</button>
        </div>

        {tab === 'keys'   && <KeysTab />}
        {tab === 'sync'   && <SyncTab />}
        {tab === 'alerts' && <AlertsTab />}
        {tab === 'team'   && <TeamTab />}
      </div>
    </main>
  );
}
