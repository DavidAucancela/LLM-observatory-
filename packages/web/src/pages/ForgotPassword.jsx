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
      if (!res.ok) throw new Error(data.error || 'Error sending email');
      setSent(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="theme-light obs-login-root">
      <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 24 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <div className="obs-brand-mark" style={{ width: 22, height: 22, fontSize: 12 }}>◐</div>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>{t('auth.brand')}</span>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{t('auth.checkEmailTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              {t('auth.checkEmailMsg', { email })}
            </div>
            <Link to="/login" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', marginTop: 8 }}>
              {t('auth.backToSignIn')}
            </Link>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginTop: -8 }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>{t('auth.resetTitle')}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{t('auth.resetSubtitle')}</div>
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--error)', background: 'color-mix(in oklab, var(--error) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--error) 25%, transparent)', borderRadius: 5, padding: '8px 12px' }}>
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
                style={{ height: 38, fontSize: 13, justifyContent: 'center', marginTop: 4 }}>
                {loading ? t('auth.sendingEmail') : t('auth.sendResetButton')}
              </button>
            </form>

            <div style={{ textAlign: 'center' }}>
              <Link to="/login" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>
                {t('auth.backToSignIn')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
