import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Telescope, Eye, EyeOff, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const searchParams  = new URLSearchParams(window.location.search);
  const justActivated = searchParams.get('activated') === '1';
  const justReset     = searchParams.get('reset')     === '1';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Already logged in → go home
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas');
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

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl">
          <h1 className="text-white font-semibold text-lg mb-1">Iniciar sesión</h1>
          <p className="text-slate-400 text-sm mb-6">Acceso restringido al administrador</p>

          {justActivated && (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2.5 mb-4 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Cuenta activada correctamente. Ya puedes ingresar.
            </div>
          )}

          {justReset && (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2.5 mb-4 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Contraseña actualizada. Ingresa con tu nueva contraseña.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
                autoComplete="email"
                placeholder="admin@example.com"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-2"
            >
              {loading
                ? <><Loader className="w-4 h-4 animate-spin" /> Verificando...</>
                : 'Ingresar'
              }
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <Link to="/forgot-password"
            className="text-xs text-slate-600 hover:text-blue-400 transition-colors">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
    </div>
  );
}
