import React, { useEffect, useState } from 'react';
import { X, Clock, DollarSign, Zap, Hash, CheckCircle, XCircle, Wrench, Tag } from 'lucide-react';
import ProviderBadge from './ProviderBadge';

const API_URL = import.meta.env.VITE_API_URL || '';

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm text-slate-800 dark:text-slate-200 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
    </div>
  );
}

export default function RequestDrawer({ requestId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestId) return;
    setLoading(true);
    fetch(`${API_URL}/api/metrics/${requestId}`)
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
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold text-slate-900 dark:text-white">Detalle de Request</h2>
            {data && <span className="text-xs text-slate-400 font-mono">#{data.id}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />)}
            </div>
          ) : data ? (
            <>
              {/* Status + provider */}
              <div className="flex items-center gap-3">
                <ProviderBadge provider={data.provider} />
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${data.status_code === 200 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                  {data.status_code === 200 ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {data.status_code}
                </span>
                <span className="text-xs text-slate-400">{new Date(data.timestamp).toLocaleString('es-ES')}</span>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Zap, label: 'Tokens', value: parseInt(data.total_tokens).toLocaleString(), sub: `${data.input_tokens} in / ${data.output_tokens} out` },
                  { icon: DollarSign, label: 'Costo', value: `$${parseFloat(data.cost_usd).toFixed(6)}`, sub: '' },
                  { icon: Clock, label: 'Latencia', value: `${data.latency_ms}ms`, sub: '' }
                ].map(({ icon: Icon, label, value, sub }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                    <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="font-bold text-slate-800 dark:text-white text-sm">{value}</p>
                    {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>

              {/* Model */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Modelo</p>
                <p className="font-mono text-sm text-slate-800 dark:text-slate-200">{data.model}</p>
              </div>

              {/* Tools */}
              {data.tools_used && JSON.parse(data.tools_used || '[]').length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Tools usadas</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {JSON.parse(data.tools_used).map(t => (
                      <span key={t} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-mono">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {data.tags && Object.keys(data.tags).length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Tags</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(data.tags).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full text-xs font-mono">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt */}
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Prompt</p>
                <div className="bg-slate-950 rounded-xl p-4 max-h-64 overflow-y-auto">
                  <p className="text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                    {data.prompt_full || data.prompt_preview || '(sin preview disponible)'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm">No se pudo cargar el detalle.</p>
          )}
        </div>
      </div>
    </>
  );
}
