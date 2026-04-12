import React, { useState, useEffect } from 'react';
import {
  Key, CheckCircle, XCircle, Loader, Trash2, Save, Eye, EyeOff,
  Bell, Plus, RefreshCw, History, Shield, Info
} from 'lucide-react';
import ProviderBadge from '../components/ProviderBadge';
import { useApi } from '../hooks/useApi';

// ── StatusBadge ────────────────────────────────────────────────────────────────
function StatusBadge({ isValid, lastTested }) {
  if (isValid === null || isValid === undefined || !lastTested) {
    return (
      <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
        Sin verificar
      </span>
    );
  }
  if (isValid) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
        <CheckCircle className="w-3 h-3" /> Válida
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> Inválida
    </span>
  );
}

// ── CredentialRow — single key in the list ─────────────────────────────────────
function CredentialRow({ cred, onDeleted, onTested }) {
  const { apiFetch } = useApi();
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await apiFetch(`/api/credentials/${cred.id}/test`, { method: 'POST' });
      const data = await res.json();
      onTested(cred.id, data.valid);
    } catch {}
    finally { setTesting(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar la key "${cred.label}"?`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/credentials/${cred.id}`, { method: 'DELETE' });
      onDeleted(cred.id);
    } finally { setDeleting(false); }
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{cred.label}</span>
          <StatusBadge isValid={cred.is_valid} lastTested={cred.last_tested_at} />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <ProviderBadge provider={cred.provider} />
          <span className="text-xs font-mono text-slate-400">{cred.key_hint}</span>
          {cred.last_tested_at && (
            <span className="text-xs text-slate-400">
              · probada {new Date(cred.last_tested_at).toLocaleDateString('es-ES')}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={handleTest} disabled={testing}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
          {testing ? <Loader className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
          Probar
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40">
          {deleting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ── AddKeyForm — inline form to add a new key ──────────────────────────────────
function AddKeyForm({ onSaved, onCancel }) {
  const { apiFetch } = useApi();
  const [form, setForm]     = useState({ provider: 'anthropic', key_type: 'sdk', label: '', value: '' });
  const [showVal, setShowVal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.label.trim() || !form.value.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch('/api/credentials', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) { onSaved(data.data); }
      else {
        const msg = Array.isArray(data.error)
          ? data.error.map(e => e.message).join(', ')
          : (data.error || 'Error al guardar');
        setError(msg);
      }
    } catch { setError('Error de conexión'); }
    finally { setSaving(false); }
  };

  const placeholder = form.provider === 'anthropic'
    ? (form.key_type === 'admin' ? 'sk-ant-admin-…' : 'sk-ant-api03-…')
    : (form.key_type === 'admin' ? 'sk-admin-…'     : 'sk-proj-…');

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
            Proveedor
          </label>
          <select value={form.provider} onChange={e => set('provider', e.target.value)}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
            Tipo
          </label>
          <select value={form.key_type} onChange={e => set('key_type', e.target.value)}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            <option value="sdk">SDK</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
          Etiqueta
        </label>
        <input type="text" value={form.label} onChange={e => set('label', e.target.value)}
          placeholder="p. ej. Proyecto Principal, Producción…"
          className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
          API Key
        </label>
        <div className="relative">
          <input type={showVal ? 'text' : 'password'} value={form.value} onChange={e => set('value', e.target.value)}
            placeholder={placeholder}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 pr-10 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          <button type="button" onClick={() => setShowVal(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            {showVal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={!form.label.trim() || !form.value.trim() || saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white text-sm rounded-lg hover:bg-slate-700 dark:hover:bg-blue-500 disabled:opacity-40 transition-colors font-medium">
          {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar key
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── CredentialsSection ─────────────────────────────────────────────────────────
function CredentialsSection() {
  const { apiFetch } = useApi();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);

  const fetchCredentials = async () => {
    try {
      const res  = await apiFetch('/api/credentials');
      const data = await res.json();
      setCredentials(data.credentials || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCredentials(); }, []);

  const handleDeleted = (id) => setCredentials(cs => cs.filter(c => c.id !== id));
  const handleTested  = (id, isValid) => setCredentials(cs =>
    cs.map(c => c.id === id ? { ...c, is_valid: isValid, last_tested_at: new Date().toISOString() } : c)
  );
  const handleSaved = (newCred) => {
    setCredentials(cs => [newCred, ...cs]);
    setShowForm(false);
  };

  const sdkKeys   = credentials.filter(c => c.key_type === 'sdk');
  const adminKeys = credentials.filter(c => c.key_type === 'admin');

  const KeyGroup = ({ title, description, keys, icon: Icon, accentClass }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-card">
      <div className={`h-1 w-full ${accentClass}`} />
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
        {loading ? (
          <div className="h-12 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
        ) : keys.length === 0 ? (
          <p className="text-xs text-slate-400 py-2 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
            Sin keys configuradas
          </p>
        ) : (
          <div>
            {keys.map(cred => (
              <CredentialRow key={cred.id} cred={cred} onDeleted={handleDeleted} onTested={handleTested} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-400" /> Credenciales
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestiona las API keys para el SDK y la sincronización de historial
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-sm px-3.5 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-blue-500 transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" /> Agregar key
        </button>
      </div>

      {showForm && (
        <AddKeyForm onSaved={handleSaved} onCancel={() => setShowForm(false)} />
      )}

      <KeyGroup
        title="SDK Keys"
        description="Usadas en tus proyectos con MonitoredAnthropic / MonitoredOpenAI para registrar métricas"
        keys={sdkKeys}
        icon={Shield}
        accentClass="bg-gradient-to-r from-blue-400 to-blue-500"
      />

      <KeyGroup
        title="Admin Keys"
        description="Para sincronizar historial de uso. Anthropic: console.anthropic.com › Settings › Admin Keys"
        keys={adminKeys}
        icon={Key}
        accentClass="bg-gradient-to-r from-violet-400 to-violet-500"
      />

      <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg px-3 py-2.5">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-400" />
        <span>
          Las keys se almacenan cifradas (AES-256-CBC) en la base de datos. Nunca se muestran completas.
        </span>
      </div>
    </div>
  );
}

// ── AlertsSection ──────────────────────────────────────────────────────────────
function AlertsSection() {
  const { apiFetch } = useApi();
  const [rules, setRules]         = useState([]);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ provider: 'all', threshold_usd: '', discord_webhook_url: '', debounce_hours: '6' });
  const [saving, setSaving]       = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testMsg, setTestMsg]     = useState({});

  const fetchData = async () => {
    try {
      const [r, h] = await Promise.all([
        apiFetch('/api/alerts/rules').then(r => r.json()),
        apiFetch('/api/alerts/history').then(r => r.json()),
      ]);
      setRules(r.rules || []);
      setHistory(h.history || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.threshold_usd || !form.discord_webhook_url) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/alerts/rules', {
        method: 'POST',
        body: JSON.stringify({ ...form, threshold_usd: parseFloat(form.threshold_usd), debounce_hours: parseInt(form.debounce_hours, 10) || 6 })
      });
      if ((await res.json()).success) {
        setShowForm(false);
        setForm({ provider: 'all', threshold_usd: '', discord_webhook_url: '', debounce_hours: '6' });
        fetchData();
      }
    } finally { setSaving(false); }
  };

  const toggleEnabled = async (rule) => {
    await apiFetch(`/api/alerts/rules/${rule.id}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: !rule.enabled })
    });
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta regla?')) return;
    await apiFetch(`/api/alerts/rules/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleTest = async (id) => {
    setTestingId(id);
    setTestMsg({});
    try {
      const res  = await apiFetch(`/api/alerts/rules/${id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestMsg({ [id]: data.success
        ? { ok: true,  text: 'Enviado a Discord ✓' }
        : { ok: false, text: 'Error al enviar' }
      });
    } finally { setTestingId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-400" /> Alertas Discord
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Recibe notificaciones cuando el gasto diario supere un límite</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-sm px-3.5 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-blue-500 transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" /> Nueva regla
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-card">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Proveedor</label>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="all">Todos</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Límite diario (USD)</label>
              <input type="number" step="0.01" min="0" value={form.threshold_usd}
                onChange={e => setForm(f => ({ ...f, threshold_usd: e.target.value }))}
                placeholder="10.00"
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Debounce (horas)
              <span className="ml-1 normal-case font-normal text-slate-400">— mínimo entre alertas repetidas</span>
            </label>
            <select value={form.debounce_hours} onChange={e => setForm(f => ({ ...f, debounce_hours: e.target.value }))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="1">1 hora</option>
              <option value="2">2 horas</option>
              <option value="6">6 horas (por defecto)</option>
              <option value="12">12 horas</option>
              <option value="24">24 horas</option>
              <option value="48">48 horas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Discord Webhook URL</label>
            <input type="url" value={form.discord_webhook_url}
              onChange={e => setForm(f => ({ ...f, discord_webhook_url: e.target.value }))}
              placeholder="https://discord.com/api/webhooks/…"
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40 font-medium transition-colors">
              {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      ) : (
        <div className="space-y-2">
          {rules.length === 0 && !showForm && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center">
              <Bell className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Sin reglas configuradas. Crea una para recibir alertas en Discord.</p>
            </div>
          )}
          {rules.map(rule => (
            <div key={rule.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 shadow-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {rule.provider === 'all'
                    ? <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Todos los proveedores</span>
                    : <ProviderBadge provider={rule.provider} />
                  }
                  <span className="text-xs text-slate-400">· Límite: <strong className="text-slate-700 dark:text-slate-300">${parseFloat(rule.threshold_usd).toFixed(2)}/día</strong></span>
                  <span className="text-xs text-slate-400">· Debounce: <strong className="text-slate-600 dark:text-slate-400">{rule.debounce_hours || 6}h</strong></span>
                </div>
                <p className="text-xs text-slate-400 font-mono truncate">{rule.discord_webhook_url.slice(0, 50)}…</p>
                {rule.last_triggered_at && (
                  <p className="text-xs text-slate-400 mt-0.5">Última alerta: {new Date(rule.last_triggered_at).toLocaleString('es-ES')}</p>
                )}
                {testMsg[rule.id] && (
                  <p className={`text-xs mt-1 font-medium ${testMsg[rule.id].ok ? 'text-emerald-500' : 'text-red-500'}`}>
                    {testMsg[rule.id].text}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleTest(rule.id)} disabled={testingId === rule.id}
                  className="text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
                  {testingId === rule.id ? <Loader className="w-3 h-3 animate-spin" /> : 'Probar'}
                </button>
                <button onClick={() => toggleEnabled(rule)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.enabled ? 'translate-x-4' : ''}`} />
                </button>
                <button onClick={() => handleDelete(rule.id)}
                  className="p-1.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <details className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-card">
          <summary className="px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <History className="w-3.5 h-3.5 text-slate-400" />
            Historial de alertas
            <span className="ml-auto text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full font-medium">{history.length}</span>
          </summary>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {history.slice(0, 10).map(h => (
              <div key={h.id} className="px-5 py-3 flex items-center gap-3 text-xs">
                {h.success
                  ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  : <XCircle    className="w-3.5 h-3.5 text-red-500    flex-shrink-0" />
                }
                <span className="text-slate-500 capitalize">{h.provider}</span>
                <span className="text-slate-700 dark:text-slate-300 font-semibold">${parseFloat(h.current_value).toFixed(4)}</span>
                <span className="text-slate-400">vs límite ${parseFloat(h.threshold_usd).toFixed(2)}</span>
                <span className="ml-auto text-slate-400">{new Date(h.sent_at).toLocaleString('es-ES')}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── SyncSection ────────────────────────────────────────────────────────────────
function SyncSection() {
  const { apiFetch } = useApi();
  const [logs, setLogs]         = useState([]);
  const [syncing, setSyncing]   = useState({ anthropic: false, openai: false });
  const [syncMsg, setSyncMsg]   = useState(null);
  const [syncDays, setSyncDays] = useState('30');

  const fetchLogs = async () => {
    try {
      const res  = await apiFetch('/api/sync/logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {}
  };
  useEffect(() => { fetchLogs(); }, []);

  const handleSync = async (provider) => {
    setSyncing(s => ({ ...s, [provider]: true }));
    setSyncMsg(null);
    try {
      const res  = await apiFetch(`/api/sync/${provider}?days=${syncDays}`, { method: 'POST' });
      const data = await res.json();
      setSyncMsg(data.success
        ? { ok: true,  text: `Sync de ${provider} iniciado — los datos aparecerán en segundos` }
        : { ok: false, text: data.error || data.detail || 'Error al iniciar sync' }
      );
      setTimeout(fetchLogs, 5000);
    } catch { setSyncMsg({ ok: false, text: 'Error de conexión' }); }
    finally { setSyncing(s => ({ ...s, [provider]: false })); }
  };

  const statusDot = (s) => {
    if (s === 'success') return 'bg-emerald-500';
    if (s === 'error')   return 'bg-red-500';
    return 'bg-amber-500 animate-pulse';
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-slate-400" /> Sincronización de historial
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Importa uso real desde las APIs de Anthropic y OpenAI. Requiere Admin Keys configuradas arriba.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-card">
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
              Días a importar
            </label>
            <select value={syncDays} onChange={e => setSyncDays(e.target.value)}
              className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="7">7 días</option>
              <option value="30">30 días</option>
              <option value="60">60 días</option>
              <option value="90">90 días</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['anthropic', 'openai'].map(provider => (
            <button key={provider} onClick={() => handleSync(provider)} disabled={syncing[provider]}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors font-medium">
              <ProviderBadge provider={provider} />
              {syncing[provider]
                ? <Loader className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />
              }
              Sincronizar {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
            </button>
          ))}
        </div>

        {syncMsg && (
          <p className={`text-xs px-3 py-2 rounded-lg ${syncMsg.ok
            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
            : 'text-red-500 bg-red-50 dark:bg-red-900/20'}`}>
            {syncMsg.text}
          </p>
        )}
      </div>

      {logs.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-card">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700/50">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Historial de sync
            </p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {logs.slice(0, 8).map(log => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-3 text-xs">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(log.status)}`} />
                <span className="capitalize text-slate-700 dark:text-slate-300 font-medium">{log.provider}</span>
                <span className="text-slate-400">{log.status}</span>
                {log.records_synced > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{log.records_synced} registros</span>
                )}
                {log.error_message && (
                  <span className="text-red-500 truncate max-w-[200px]" title={log.error_message}>{log.error_message}</span>
                )}
                <span className="ml-auto text-slate-400">
                  {new Date(log.started_at).toLocaleString('es-ES')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Settings page ─────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Ajustes</h1>
        <p className="text-sm text-slate-400 mt-1">Credenciales, alertas y sincronización</p>
      </div>

      <CredentialsSection />
      <hr className="border-slate-200 dark:border-slate-700/50" />
      <SyncSection />
      <hr className="border-slate-200 dark:border-slate-700/50" />
      <AlertsSection />
    </div>
  );
}
