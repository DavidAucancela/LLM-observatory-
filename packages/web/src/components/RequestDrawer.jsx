import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProviderBadge from './ProviderBadge';
import { fmtDateTime, fmtLatency, formatCost } from '../utils/fmt';
import { useApi } from '../hooks/useApi';

function CopyButton({ text, style }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  return (
    <button
      className="obs-btn obs-btn-ghost"
      style={{ padding: '2px 8px', fontSize: 10, ...style }}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? t('drawer.copied') : t('drawer.copy')}
    </button>
  );
}

// JSONB columns come back already-parsed from node-postgres, but fall back to
// JSON.parse for safety (mirrors the pre-existing tools_used handling).
function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function ExpandableText({ text, emptyLabel, threshold = 500 }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  if (!text) {
    return <div style={{ fontSize: 12, color: 'var(--muted)' }}>{emptyLabel}</div>;
  }

  const isLong = text.length > threshold;
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.55,
        color: 'var(--muted)', padding: 10,
        background: 'var(--hover)', borderRadius: 4,
        maxHeight: expanded ? 'none' : 160, overflow: expanded ? 'visible' : 'auto',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {text}
      </div>
      {isLong && (
        <button
          className="obs-btn obs-btn-ghost"
          style={{ marginTop: 6, fontSize: 10, padding: '2px 8px' }}
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? t('drawer.showLess') : t('drawer.showMore')}
        </button>
      )}
    </div>
  );
}

export default function RequestDrawer({ requestId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { apiFetch } = useApi();
  const { t } = useTranslation();

  useEffect(() => {
    if (!requestId) return;
    let stale = false; // ignore responses that arrive after requestId changed
    setLoading(true);
    apiFetch(`/api/metrics/${requestId}`)
      .then(r => r.json())
      .then(d => { if (!stale) { setData(d); setLoading(false); } })
      .catch(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [requestId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const tools       = parseJsonField(data?.tools_used, []);
  const toolCalls   = parseJsonField(data?.tool_calls, []);
  const reqParams   = parseJsonField(data?.request_params, {});

  const promptText   = data?.prompt_full || data?.prompt_preview || '';
  const responseText = data?.response_full || '';
  const totalTokens = data
    ? parseInt(data.total_tokens || 0) ||
      (parseInt(data.input_tokens || 0) + parseInt(data.output_tokens || 0))
    : 0;

  const hasReqParams = reqParams && (
    reqParams.temperature !== undefined || reqParams.max_tokens !== undefined ||
    reqParams.top_p !== undefined || reqParams.stream !== undefined
  );

  return (
    <>
      <div className="obs-drawer-backdrop" onClick={onClose} />
      <div className="obs-drawer" role="dialog" aria-modal="true" aria-label={t('drawer.title')}>
        <div className="obs-drawer-header">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('drawer.title')}</div>
            {data && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  #{data.id}
                </span>
                <CopyButton text={String(data.id)} style={{ padding: '1px 6px' }} />
              </div>
            )}
          </div>
          <button
            className="obs-btn obs-btn-ghost"
            style={{ padding: '4px 6px' }}
            onClick={onClose}
            aria-label={t('drawer.close')}
          >
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
                  {data.api_key_hint && (
                    <><dt>{t('drawer.apiKey')}</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{data.api_key_hint}</dd></>
                  )}
                  <dt>{t('drawer.latency')}</dt>
                  <dd>{fmtLatency(data.latency_ms)}</dd>
                  <dt>{t('drawer.status')}</dt>
                  <dd style={{ color: data.status_code < 400 ? 'var(--success)' : 'var(--error)' }}>
                    {data.status_code} {data.status_code < 400 ? t('drawer.statusOk') : t('drawer.statusError')}
                  </dd>
                  {data.stop_reason && <><dt>{t('drawer.stopReason')}</dt><dd>{data.stop_reason}</dd></>}
                  {data.error_type && (
                    <><dt>{t('drawer.errorType')}</dt><dd style={{ color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{data.error_type}</dd></>
                  )}
                  {data.error_message && (
                    <><dt>{t('drawer.errorMessage')}</dt><dd style={{ color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: 11, wordBreak: 'break-word' }}>{data.error_message}</dd></>
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
                  <dt>{t('drawer.totalTokens')}</dt>
                  <dd>{totalTokens.toLocaleString()}</dd>
                  <dt>{t('drawer.totalCost')}</dt>
                  <dd>{formatCost(data.cost_usd, { small: true })}</dd>
                </dl>
              </div>

              {hasReqParams && (
                <div className="obs-drawer-section">
                  <div className="obs-section-label" style={{ marginBottom: 10 }}>{t('drawer.requestParams')}</div>
                  <dl className="meta-grid">
                    {reqParams.temperature !== undefined && (
                      <><dt>{t('drawer.temperature')}</dt><dd>{reqParams.temperature}</dd></>
                    )}
                    {reqParams.max_tokens !== undefined && (
                      <><dt>{t('drawer.maxTokens')}</dt><dd>{reqParams.max_tokens}</dd></>
                    )}
                    {reqParams.top_p !== undefined && (
                      <><dt>{t('drawer.topP')}</dt><dd>{reqParams.top_p}</dd></>
                    )}
                    {reqParams.stream !== undefined && (
                      <><dt>{t('drawer.streaming')}</dt><dd>{reqParams.stream ? t('common.yes') : t('common.no')}</dd></>
                    )}
                  </dl>
                </div>
              )}

              {tools.length > 0 && (
                <div className="obs-drawer-section">
                  <div className="obs-section-label" style={{ marginBottom: 8 }}>{t('drawer.toolsUsed')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tools.map(tool => <span key={tool} className="kchip">{tool}</span>)}
                  </div>
                </div>
              )}

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

              {data.system_prompt && (
                <div className="obs-drawer-section">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div className="obs-section-label" style={{ marginBottom: 0 }}>{t('drawer.systemPrompt')}</div>
                    <CopyButton text={data.system_prompt} />
                  </div>
                  <ExpandableText text={data.system_prompt} emptyLabel={t('drawer.noSystemPrompt')} />
                </div>
              )}

              <div className="obs-drawer-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div className="obs-section-label" style={{ marginBottom: 0 }}>{t('drawer.promptPreview')}</div>
                  {promptText && <CopyButton text={promptText} />}
                </div>
                <ExpandableText text={promptText} emptyLabel={t('drawer.noPreview')} />
              </div>

              {toolCalls.length > 0 && (
                <div className="obs-drawer-section">
                  <div className="obs-section-label" style={{ marginBottom: 8 }}>{t('drawer.toolCallsInvoked')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {toolCalls.map((call, i) => (
                      <div key={i} style={{
                        background: 'var(--hover)', borderRadius: 4, padding: 8,
                      }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                          {call.name}
                        </div>
                        <pre style={{
                          margin: 0, fontFamily: 'var(--font-mono)', fontSize: 10.5,
                          lineHeight: 1.5, color: 'var(--muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {JSON.stringify(call.arguments, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="obs-drawer-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div className="obs-section-label" style={{ marginBottom: 0 }}>{t('drawer.responseText')}</div>
                  {responseText && <CopyButton text={responseText} />}
                </div>
                <ExpandableText text={responseText} emptyLabel={t('drawer.noResponse')} />
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
