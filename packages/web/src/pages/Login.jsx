import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

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
          <img src="/logoMain.png" alt="Observatory" className="obs-brand-logo" style={{ width: 26, height: 26 }} />
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>{t('auth.brand')}</span>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginTop: -8 }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>{t('auth.signInTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{t('auth.signInSubtitle')}</div>
        </div>

        {/* Success banners */}
        {justReset && (
          <div style={{ fontSize: 12, color: 'var(--success)', background: 'color-mix(in oklab, var(--success) 10%, transparent)', border: '1px solid color-mix(in oklab, var(--success) 30%, transparent)', borderRadius: 5, padding: '8px 12px' }}>
            {t('auth.resetSuccess')}
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
            <label>{t('auth.emailLabel')}</label>
            <input
              className="obs-input obs-input-lg"
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="obs-field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('auth.passwordLabel')}</span>
              <Link to="/forgot-password" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 400, fontSize: 12 }}>
                {t('auth.forgotLink')}
              </Link>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="obs-input obs-input-lg"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('auth.passwordPlaceholder')}
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
                {showPw ? t('auth.hidePassword') : t('auth.showPassword')}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="obs-btn obs-btn-primary"
            disabled={loading || !email || !password}
            style={{ height: 38, fontSize: 13, justifyContent: 'center', marginTop: 4 }}
          >
            {loading ? t('auth.signingIn') : t('auth.signInButton')}
          </button>
        </form>

        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
          {t('auth.noAccount')}{' '}
          <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            {t('auth.createAccount')}
          </Link>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link to="/" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={e => e.target.style.color = 'var(--text)'}
            onMouseLeave={e => e.target.style.color = 'var(--muted)'}
          >
            {t('auth.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
