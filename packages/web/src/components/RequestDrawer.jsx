import React, { useEffect, useState } from 'react';
import ProviderBadge from './ProviderBadge';
import { fmtDateTime } from '../utils/fmt';
import { useApi } from '../hooks/useApi';

export default function RequestDrawer({ requestId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { apiFetch } = useApi();

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
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Request detail</div>
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
                <div className="obs-section-label" style={{ marginBottom: 10 }}>Metadata</div>
                <dl className="meta-grid">
                  <dt>Time</dt>
                  <dd>{fmtDateTime(data.timestamp)}</dd>
                  <dt>Provider</dt>
                  <dd><ProviderBadge provider={data.provider} /></dd>
                  <dt>Model</dt>
                  <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{data.model}</dd>
                  <dt>Latency</dt>
                  <dd>{data.latency_ms}ms</dd>
                  <dt>Status</dt>
                  <dd style={{ color: data.status_code === 200 ? 'var(--success)' : 'var(--error)' }}>
                    {data.status_code} {data.status_code === 200 ? 'OK' : 'Error'}
                  </dd>
                  {data.stop_reason && <><dt>Stop reason</dt><dd>{data.stop_reason}</dd></>}
                  {data.error_type && (
                    <><dt>Error type</dt><dd style={{ color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{data.error_type}</dd></>
                  )}
                  {data.error_message && (
                    <><dt>Error msg</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', wordBreak: 'break-all' }}>{data.error_message}</dd></>
                  )}
                </dl>
              </div>

              <div className="obs-drawer-section">
                <div className="obs-section-label" style={{ marginBottom: 10 }}>Token breakdown</div>
                <dl className="meta-grid">
                  <dt>Input</dt>
                  <dd>{parseInt(data.input_tokens || 0).toLocaleString()}</dd>
                  {data.cache_read_tokens > 0 && <><dt>Cache read</dt><dd>{parseInt(data.cache_read_tokens).toLocaleString()}</dd></>}
                  {data.cache_write_tokens > 0 && <><dt>Cache write</dt><dd>{parseInt(data.cache_write_tokens).toLocaleString()}</dd></>}
                  <dt>Output</dt>
                  <dd>{parseInt(data.output_tokens || 0).toLocaleString()}</dd>
                  <dt>Total cost</dt>
                  <dd>${parseFloat(data.cost_usd).toFixed(6)}</dd>
                </dl>
              </div>

              {data.tools_used && (() => {
                try {
                  const tools = JSON.parse(data.tools_used);
                  if (tools.length > 0) return (
                    <div className="obs-drawer-section">
                      <div className="obs-section-label" style={{ marginBottom: 8 }}>Tools used</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {tools.map(t => <span key={t} className="kchip">{t}</span>)}
                      </div>
                    </div>
                  );
                } catch {}
                return null;
              })()}

              {data.tags && Object.keys(data.tags).length > 0 && (
                <div className="obs-drawer-section">
                  <div className="obs-section-label" style={{ marginBottom: 8 }}>Tags</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {Object.entries(data.tags).map(([k, v]) => (
                      <span key={k} className="kchip">{k}: {String(v)}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="obs-drawer-section">
                <div className="obs-section-label" style={{ marginBottom: 10 }}>Prompt preview</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.55,
                  color: 'var(--muted)', padding: 10,
                  background: 'var(--hover)', borderRadius: 4,
                  maxHeight: 160, overflow: 'auto',
                }}>
                  {data.prompt_full || data.prompt_preview || '(no preview available)'}
                </div>
              </div>
            </>
          ) : (
            <div className="obs-empty">
              <div className="obs-empty-title">Could not load request</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
