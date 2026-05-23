import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProviderBadge from './ProviderBadge';
import { fmtDateTime } from '../utils/fmt';
import { useApi } from '../hooks/useApi';

export default function RequestDrawer({ requestId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { apiFetch } = useApi();
  const { t } = useTranslation();

  useEffect(() => {
    if (!requestId) return;
    setLoading(true);
    apiFetch(`/api/metrics/${requestId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [requestId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="obs-drawer-backdrop" onClick={onClose} />
      <div className="obs-drawer">
        <div className="obs-drawer-header">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('drawer.title')}</div>
            {data && (
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                #{data.id}
              </div>
            )}
          </div>
          <button className="obs-btn obs-btn-ghost" style={{ padding: '4px 6px' }} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="obs-drawer-body">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="obs-skeleton" style={{ height: 36, borderRadius: 4 }} />
              ))}
            </div>
          ) : data ? (
            <>
              <div className="obs-drawer-section">
                <div className="obs-section-label" style={{ marginBottom: 10 }}>{t('drawer.metadata')}</div>
                <dl className="meta-grid">
                  <dt>{t('drawer.time')}</dt>
                  <dd>{fmtDateTime(data.timestamp)}</dd>
                  <dt>{t('drawer.provider')}</dt>
                  <dd><ProviderBadge provider={data.provider} /></dd>
                  <dt>{t('drawer.model')}</dt>
                  <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{data.model}</dd>
                  <dt>{t('drawer.latency')}</dt>
                  <dd>{data.latency_ms}ms</dd>
                  <dt>{t('drawer.status')}</dt>
                  <dd style={{ color: data.status_code < 400 ? 'var(--success)' : 'var(--error)' }}>
                    {data.status_code} {data.status_code < 400 ? t('drawer.statusOk') : t('drawer.statusError')}
                  </dd>
                  {data.error_message && (
                    <><dt>{t('drawer.errorLabel')}</dt><dd style={{ color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: 11, wordBreak: 'break-word' }}>{data.error_message}</dd></>
                  )}
                  {data.stop_reason && <><dt>{t('drawer.stopReason')}</dt><dd>{data.stop_reason}</dd></>}
                  {data.error_type && (
                    <><dt>{t('drawer.errorType')}</dt><dd style={{ color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{data.error_type}</dd></>
                  )}
                  {data.error_message && (
                    <><dt>{t('drawer.errorMessage')}</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', wordBreak: 'break-all' }}>{data.error_message}</dd></>
                  )}
                </dl>
              </div>

              <div className="obs-drawer-section">
                <div className="obs-section-label" style={{ marginBottom: 10 }}>{t('drawer.tokenBreakdown')}</div>
                <dl className="meta-grid">
                  <dt>{t('drawer.input')}</dt>
                  <dd>{parseInt(data.input_tokens || 0).toLocaleString()}</dd>
                  {data.cache_read_tokens > 0 && <><dt>{t('drawer.cacheRead')}</dt><dd>{parseInt(data.cache_read_tokens).toLocaleString()}</dd></>}
                  {data.cache_write_tokens > 0 && <><dt>{t('drawer.cacheWrite')}</dt><dd>{parseInt(data.cache_write_tokens).toLocaleString()}</dd></>}
                  <dt>{t('drawer.output')}</dt>
                  <dd>{parseInt(data.output_tokens || 0).toLocaleString()}</dd>
                  <dt>{t('drawer.totalCost')}</dt>
                  <dd>${parseFloat(data.cost_usd).toFixed(6)}</dd>
                </dl>
              </div>

              {data.tools_used && (() => {
                try {
                  const tools = JSON.parse(data.tools_used);
                  if (tools.length > 0) return (
                    <div className="obs-drawer-section">
                      <div className="obs-section-label" style={{ marginBottom: 8 }}>{t('drawer.toolsUsed')}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {tools.map(tool => <span key={tool} className="kchip">{tool}</span>)}
                      </div>
                    </div>
                  );
                } catch {}
                return null;
              })()}

              {data.tags && Object.keys(data.tags).length > 0 && (
                <div className="obs-drawer-section">
                  <div className="obs-section-label" style={{ marginBottom: 8 }}>{t('drawer.tags')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {Object.entries(data.tags).map(([k, v]) => (
                      <span key={k} className="kchip">{k}: {String(v)}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="obs-drawer-section">
                <div className="obs-section-label" style={{ marginBottom: 10 }}>{t('drawer.promptPreview')}</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.55,
                  color: 'var(--muted)', padding: 10,
                  background: 'var(--hover)', borderRadius: 4,
                  maxHeight: 160, overflow: 'auto',
                }}>
                  {data.prompt_full || data.prompt_preview || t('drawer.noPreview')}
                </div>
              </div>
            </>
          ) : (
            <div className="obs-empty">
              <div className="obs-empty-title">{t('drawer.loadError')}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
