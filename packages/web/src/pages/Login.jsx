import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const searchParams  = new URLSearchParams(window.location.search);
  const justReset     = searchParams.get('reset') === '1';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  if (isAuthenticated) { navigate('/dashboard', { replace: true }); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true); setError('');
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) { setError(err.message || 'Invalid credentials'); }
    finally { setLoading(false); }
  };

  return (
    <div className="theme-light obs-login-root">
      <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <div className="obs-brand-mark" style={{ width: 22, height: 22, fontSize: 12 }}>◐</div>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>Observatory</span>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginTop: -8 }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>Sign in</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Welcome back to your control panel</div>
        </div>

        {/* Success banners */}
        {justReset && (
          <div style={{ fontSize: 12, color: 'var(--success)', background: 'color-mix(in oklab, var(--success) 10%, transparent)', border: '1px solid color-mix(in oklab, var(--success) 30%, transparent)', borderRadius: 5, padding: '8px 12px' }}>
            Password updated. Sign in with your new password.
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ fontSize: 12, color: 'var(--error)', background: 'color-mix(in oklab, var(--error) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--error) 25%, transparent)', borderRadius: 5, padding: '8px 12px' }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="obs-field">
            <label>Email</label>
            <input
              className="obs-input obs-input-lg"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="obs-field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Password</span>
              <Link to="/forgot-password" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 400, fontSize: 12 }}>
                Forgot?
              </Link>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="obs-input obs-input-lg"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}
              >
                {showPw ? 'hide' : 'show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="obs-btn obs-btn-primary"
            disabled={loading || !email || !password}
            style={{ height: 38, fontSize: 13, justifyContent: 'center', marginTop: 4 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Create one
          </Link>
        </div>

        <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
          LLM Observatory · internal tooling
        </div>
      </div>
    </div>
  );
}
