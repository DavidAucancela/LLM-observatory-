import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ProviderBadge from '../components/ProviderBadge';
import TopBar from '../components/TopBar';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthProvider';
import { fmtDateTime } from '../utils/fmt';

export default function Sync({ darkMode, onToggleDarkMode }) {
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
    <main className="obs-main obs-fade-in">
      <TopBar title={t('settings.syncTab')} darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />

      <div className="obs-content" style={{ paddingTop: 0 }}>
        {['anthropic', 'openai'].map(p => (
          <div key={p} className="obs-row-grid" style={{
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
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
              <div key={l.id} className="obs-row-grid" style={{
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
      </div>
    </main>
  );
}
