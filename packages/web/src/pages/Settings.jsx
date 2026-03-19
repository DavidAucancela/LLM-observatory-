import React, { useState, useEffect } from 'react';
import { Key, CheckCircle, XCircle, Loader, Trash2, Save, Eye, EyeOff, Bell, Plus, RefreshCw, History } from 'lucide-react';
import ProviderBadge from '../components/ProviderBadge';

const API_URL = import.meta.env.VITE_API_URL || '';

const PROVIDERS = ['anthropic', 'openai'];

function StatusBadge({ isValid, lastTested }) {
  if (isValid === null || isValid === undefined || !lastTested) {
    return <span className="text-xs text-slate-400">Sin verificar</span>;
  }
  if (isValid) {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
        <CheckCircle className="w-3.5 h-3.5" /> Válida
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
      <XCircle className="w-3.5 h-3.5" /> Inválida
    </span>
  );
}

function CredentialCard({ provider, credential, onSaved, onDeleted }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: apiKey.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setApiKey('');
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/credentials/${provider}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult(data.valid ? 'ok' : 'fail');
      onSaved();
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar credencial de ${provider}?`)) return;
    await fetch(`${API_URL}/api/credentials/${provider}`, { method: 'DELETE' });
    onDeleted();
  };

  const isConfigured = !!credential;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <Key className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <ProviderBadge provider={provider} />
              {isConfigured && <StatusBadge isValid={credential.is_valid} lastTested={credential.last_tested_at} />}
            </div>
            {isConfigured && (
              <p className="text-xs text-slate-400 mt-1 font-mono">{credential.key_hint}</p>
            )}
            {!isConfigured && (
              <p className="text-xs text-slate-400 mt-1">No configurada</p>
            )}
          </div>
        </div>
        {isConfigured && (
          <button
            onClick={handleDelete}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Eliminar credencial"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            {isConfigured ? 'Reemplazar API Key' : 'API Key'}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={provider === 'anthropic' ? 'sk-ant-api03-...' : 'sk-proj-...'}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 pr-10 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white text-sm rounded-lg hover:bg-slate-700 dark:hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </button>

          {isConfigured && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              {testing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Probar conexión
            </button>
          )}
        </div>

        {testResult === 'ok' && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Conexión exitosa — API key válida
          </p>
        )}
        {testResult === 'fail' && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Conexión fallida — verifica la key
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Alerts Section ───────────────────────────────────────────────────────────
function AlertsSection() {
  const [rules, setRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: 'all', threshold_usd: '', discord_webhook_url: '' });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testMsg, setTestMsg] = useState({});

  const fetchData = async () => {
    try {
      const [r, h] = await Promise.all([
        fetch(`${API_URL}/api/alerts/rules`).then(r => r.json()),
        fetch(`${API_URL}/api/alerts/history`).then(r => r.json())
      ]);
      setRules(r.rules || []);
      setHistory(h.history || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.threshold_usd || !form.discord_webhook_url) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/alerts/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, threshold_usd: parseFloat(form.threshold_usd) })
      });
      if ((await res.json()).success) {
        setShowForm(false);
        setForm({ provider: 'all', threshold_usd: '', discord_webhook_url: '' });
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (rule) => {
    await fetch(`${API_URL}/api/alerts/rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled })
    });
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta regla?')) return;
    await fetch(`${API_URL}/api/alerts/rules/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleTest = async (id) => {
    setTestingId(id);
    setTestMsg({});
    try {
      const res = await fetch(`${API_URL}/api/alerts/rules/${id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestMsg({ [id]: data.success ? { ok: true, text: 'Enviado a Discord ✓' } : { ok: false, text: 'Error al enviar' } });
    } finally {
      setTestingId(null);
    }
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
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-blue-500 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nueva regla
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Proveedor</label>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <option value="all">Todos</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Límite diario (USD)</label>
              <input type="number" step="0.01" min="0" value={form.threshold_usd}
                onChange={e => setForm(f => ({ ...f, threshold_usd: e.target.value }))}
                placeholder="10.00"
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Discord Webhook URL</label>
            <input type="url" value={form.discord_webhook_url}
              onChange={e => setForm(f => ({ ...f, discord_webhook_url: e.target.value }))}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40">
              {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" /> : (
        <div className="space-y-2">
          {rules.length === 0 && !showForm && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400 text-sm">
              Sin reglas configuradas. Crea una para recibir alertas en Discord.
            </div>
          )}
          {rules.map(rule => (
            <div key={rule.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {rule.provider === 'all' ? <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Todos los proveedores</span> : <ProviderBadge provider={rule.provider} />}
                  <span className="text-xs text-slate-400">· Límite: <strong className="text-slate-700 dark:text-slate-300">${parseFloat(rule.threshold_usd).toFixed(2)}/día</strong></span>
                </div>
                <p className="text-xs text-slate-400 font-mono truncate">{rule.discord_webhook_url.slice(0, 50)}...</p>
                {rule.last_triggered_at && <p className="text-xs text-slate-400 mt-0.5">Última alerta: {new Date(rule.last_triggered_at).toLocaleString('es-ES')}</p>}
                {testMsg[rule.id] && (
                  <p className={`text-xs mt-1 ${testMsg[rule.id].ok ? 'text-emerald-500' : 'text-red-500'}`}>{testMsg[rule.id].text}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleTest(rule.id)} disabled={testingId === rule.id}
                  className="text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40">
                  {testingId === rule.id ? <Loader className="w-3 h-3 animate-spin" /> : 'Probar'}
                </button>
                <button onClick={() => toggleEnabled(rule)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.enabled ? 'translate-x-4' : ''}`} />
                </button>
                <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <details className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <summary className="px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-slate-400" /> Historial de alertas ({history.length})
          </summary>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {history.slice(0, 10).map(h => (
              <div key={h.id} className="px-5 py-3 flex items-center gap-3 text-xs">
                {h.success ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                <span className="text-slate-500 capitalize">{h.provider}</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">${parseFloat(h.current_value).toFixed(4)}</span>
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

// ─── Sync Section ─────────────────────────────────────────────────────────────
function OpenAIBalance({ hasKey }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/credentials/openai/balance`);
      const data = await res.json();
      if (data.balance) setBalance(data.balance);
      else setError(data.error || 'No disponible');
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (!hasKey) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Key className="w-4 h-4 text-slate-400" /> Saldo OpenAI
      </h2>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        {balance ? (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Consumo este mes ({balance.month})</span><span className="font-semibold text-emerald-600 dark:text-emerald-400">${parseFloat(balance.cost_usd).toFixed(4)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tokens entrada</span><span className="text-slate-700 dark:text-slate-300">{balance.input_tokens?.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tokens salida</span><span className="text-slate-700 dark:text-slate-300">{balance.output_tokens?.toLocaleString()}</span></div>
          </div>
        ) : error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          <p className="text-xs text-slate-400">Haz clic en "Consultar" para ver el saldo</p>
        )}
        <button onClick={fetchBalance} disabled={loading}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-40">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Consultando...' : 'Consultar saldo'}
        </button>
      </div>
    </div>
  );
}

function SyncSection({ credentials, fetchCredentials }) {
  const [logs, setLogs] = useState([]);
  const [adminKey, setAdminKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingOai, setSyncingOai] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [syncDays, setSyncDays] = useState('30');
  const adminCred = credentials.find(c => c.provider === 'anthropic_admin');
  const openaiCred = credentials.find(c => c.provider === 'openai');

  const fetchLogs = async () => {
    const res = await fetch(`${API_URL}/api/sync/logs`);
    const data = await res.json();
    setLogs(data.logs || []);
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleSaveAdmin = async () => {
    if (!adminKey.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'anthropic_admin', api_key: adminKey.trim() })
      });
      setAdminKey('');
      fetchCredentials();
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (provider) => {
    const setS = provider === 'openai' ? setSyncingOai : setSyncing;
    setS(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/sync/${provider}?days=${syncDays}`, { method: 'POST' });
      const data = await res.json();
      setSyncMsg(data.success ? { ok: true, text: 'Sync iniciado — los datos aparecerán en segundos' } : { ok: false, text: data.error });
      setTimeout(fetchLogs, 5000);
    } catch {
      setSyncMsg({ ok: false, text: 'Error de conexión' });
    } finally {
      setS(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-slate-400" /> Sincronización Anthropic
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">Importa uso real desde la Admin API de Anthropic (requiere Admin API key)</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Admin API Key {adminCred && <span className="font-mono text-slate-400">· {adminCred.key_hint}</span>}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type={showKey ? 'text' : 'password'} value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                placeholder="sk-ant-admin..."
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 pr-10 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono" />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={handleSaveAdmin} disabled={!adminKey.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40">
              {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Obtén tu Admin key en Console → Settings → Admin keys (sk-ant-admin...)</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select value={syncDays} onChange={e => setSyncDays(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
            <option value="7">7 días</option>
            <option value="30">30 días</option>
            <option value="60">60 días</option>
            <option value="90">90 días</option>
            <option value="180">180 días</option>
          </select>
          <button onClick={() => handleSync('anthropic')} disabled={syncing || !adminCred}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sync Anthropic'}
          </button>
          <button onClick={() => handleSync('openai')} disabled={syncingOai || !openaiCred}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white text-sm rounded-lg disabled:opacity-40 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${syncingOai ? 'animate-spin' : ''}`} />
            {syncingOai ? 'Sincronizando...' : 'Sync OpenAI'}
          </button>
          {!adminCred && <span className="text-xs text-slate-400">Guarda tu Admin key de Anthropic primero</span>}
        </div>

        {syncMsg && (
          <p className={`text-xs ${syncMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{syncMsg.text}</p>
        )}
      </div>

      {logs.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Historial de syncs</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {logs.slice(0, 5).map(log => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-3 text-xs">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'success' ? 'bg-emerald-500' : log.status === 'error' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
                <span className="text-slate-700 dark:text-slate-300 capitalize font-medium">{log.status}</span>
                {log.records_imported > 0 && <span className="text-slate-500">{log.records_imported} registros</span>}
                {log.error_message && <span className="text-red-500 truncate">{log.error_message}</span>}
                <span className="ml-auto text-slate-400">{new Date(log.started_at).toLocaleString('es-ES')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function Settings() {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCredentials = async () => {
    try {
      const res = await fetch(`${API_URL}/api/credentials`);
      const data = await res.json();
      setCredentials(data.credentials || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCredentials(); }, []);

  const getCredential = (provider) => credentials.find(c => c.provider === provider) || null;

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Credenciales, alertas y sincronización.</p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          <strong>Seguridad:</strong> Las API keys se encriptan (AES-256) antes de guardarse y nunca se devuelven completas al navegador.
        </p>
      </div>

      {/* API Keys */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-400" /> API Keys
        </h2>
        {loading ? (
          <div className="space-y-4">
            {PROVIDERS.map(p => (
              <div key={p} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 animate-pulse h-40" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {PROVIDERS.map(provider => (
              <CredentialCard
                key={provider}
                provider={provider}
                credential={getCredential(provider)}
                onSaved={fetchCredentials}
                onDeleted={fetchCredentials}
              />
            ))}
          </div>
        )}
      </section>

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* OpenAI Balance */}
      <OpenAIBalance hasKey={!!getCredential('openai')} />

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* Sync */}
      <SyncSection credentials={credentials} fetchCredentials={fetchCredentials} />

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* Alerts */}
      <AlertsSection />
    </div>
  );
}
