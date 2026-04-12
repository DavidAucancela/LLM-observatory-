import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Telescope, Loader, KeyRound, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ResetPassword() {
  const navigate = useNavigate();
  const params   = new URLSearchParams(window.location.search);
  const token    = params.get('token');

  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]               = useState(false);
  const [loading, setLoading]             = useState(false);
  const [done, setDone]                   = useState(false);
  const [error, setError]                 = useState('');

  // If there's no token in the URL, show an error immediately
  useEffect(() => {
    if (!token) setError('Link inválido. Solicita un nuevo link de restablecimiento.');
  }, [token]);

  const passwordsMatch  = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passwordsMatch || passwordTooShort) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API_URL}/api/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al restablecer la contraseña');
      setDone(true);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login?reset=1', { replace: true }), 3000);
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
          {done ? (
            /* ── Success state ── */
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-900/30 border border-emerald-800/50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-white font-semibold text-lg mb-2">Contraseña actualizada</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-1">
                Tu contraseña fue cambiada correctamente.
              </p>
              <p className="text-slate-600 text-xs mb-5">
                Redirigiendo al login en unos segundos…
              </p>
              <Link to="/login"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                Ir al login ahora
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-blue-400" />
                </div>
                <h1 className="text-white font-semibold text-lg">Nueva contraseña</h1>
              </div>
              <p className="text-slate-400 text-sm mb-6 ml-[42px]">
                Elige una contraseña segura de al menos 8 caracteres.
              </p>

              {error && (
                <div className="flex items-start gap-2 text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5 mb-4 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      autoFocus
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                      required
                      className={`w-full bg-slate-800 border rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                        passwordTooShort
                          ? 'border-red-500/60 focus:ring-red-500/30'
                          : 'border-slate-700 focus:ring-blue-500/40 focus:border-blue-500/60'
                      }`}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      tabIndex={-1}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordTooShort && (
                    <p className="text-xs text-red-400 mt-1">Mínimo 8 caracteres</p>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Confirmar contraseña
                  </label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Repite la contraseña"
                    required
                    className={`w-full bg-slate-800 border rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                      confirmPassword && !passwordsMatch
                        ? 'border-red-500/60 focus:ring-red-500/30'
                        : confirmPassword && passwordsMatch
                        ? 'border-emerald-500/60 focus:ring-emerald-500/30'
                        : 'border-slate-700 focus:ring-blue-500/40 focus:border-blue-500/60'
                    }`}
                  />
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-red-400 mt-1">Las contraseñas no coinciden</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !token || !passwordsMatch || passwordTooShort}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-2"
                >
                  {loading
                    ? <><Loader className="w-4 h-4 animate-spin" /> Guardando...</>
                    : 'Cambiar contraseña'
                  }
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
