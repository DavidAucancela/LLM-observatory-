import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error sending request');
      setSent(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="theme-dark obs-login-root">
      <div className="obs-auth-card">

        <div className="obs-auth-brand">
          <img src="/logo-dark.png" alt="Observatory" />
          <span className="obs-auth-brand-name">{t('auth.brand')}</span>
        </div>

        <div className="obs-auth-divider" />

        {sent ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            <div style={{ fontSize: 28 }}>✉️</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#E2EAF4' }}>{t('auth.checkEmailTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              {t('auth.checkEmailMsg', { email })}
            </div>
            <Link to="/login" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', marginTop: 8, fontWeight: 500 }}>
              {t('auth.backToSignIn')}
            </Link>
          </div>
        ) : (
          <>
            <div className="obs-auth-title">
              <h2>{t('auth.resetTitle')}</h2>
              <p>{t('auth.resetSubtitle')}</p>
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--error)', background: 'color-mix(in oklab, var(--error) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--error) 25%, transparent)', borderRadius: 6, padding: '8px 12px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="obs-field">
                <label>{t('auth.emailLabel')}</label>
                <input
                  className="obs-input obs-input-lg"
                  type="email"
                  autoFocus
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="obs-btn obs-btn-primary" disabled={loading || !email}
                style={{ height: 40, fontSize: 13, justifyContent: 'center', marginTop: 4, borderRadius: 8 }}>
                {loading ? t('auth.sendingEmail') : t('auth.sendResetButton')}
              </button>
            </form>

            <div className="obs-auth-divider" />

            <div style={{ textAlign: 'center' }}>
              <Link to="/login" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}
                onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                onMouseLeave={e => e.target.style.color = 'var(--muted)'}
              >
                {t('auth.backToSignIn')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
