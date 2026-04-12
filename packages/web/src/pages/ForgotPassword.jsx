import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Telescope, Loader, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ForgotPassword() {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar el email');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Telescope className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-base tracking-tight">LLM Observatory</div>
            <div className="text-slate-500 text-xs">AI Cost Tracker</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl">
          {sent ? (
            /* ── Success state ── */
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-900/30 border border-emerald-800/50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-white font-semibold text-lg mb-2">Revisa tu email</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Si <span className="text-slate-300">{email}</span> está registrado,
                recibirás un link para restablecer tu contraseña en los próximos minutos.
              </p>
              <p className="text-slate-600 text-xs mb-5">
                No olvides revisar tu carpeta de spam.
              </p>
              <Link to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Volver al login
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-400" />
                </div>
                <h1 className="text-white font-semibold text-lg">Olvidé mi contraseña</h1>
              </div>
              <p className="text-slate-400 text-sm mb-6 ml-[42px]">
                Ingresa tu email y te enviaremos un link para crear una nueva contraseña.
              </p>

              {error && (
                <div className="text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5 mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                    autoComplete="email"
                    placeholder="tu@email.com"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
                >
                  {loading
                    ? <><Loader className="w-4 h-4 animate-spin" /> Enviando...</>
                    : 'Enviar instrucciones'
                  }
                </button>
              </form>

              <div className="text-center mt-5">
                <Link to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  <ArrowLeft className="w-3 h-3" /> Volver al login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
