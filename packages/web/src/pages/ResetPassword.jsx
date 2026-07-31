import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');

  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]                   = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [done, setDone]                       = useState(false);
  const [error, setError]                     = useState('');

  useEffect(() => {
    if (!token) setError(t('auth.invalidToken'));
  }, [token, t]);

  const passwordsMatch   = newPassword && confirmPassword && newPassword === confirmPassword;
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
      if (!res.ok) throw new Error(data.error || 'Error resetting password');
      setDone(true);
      setTimeout(() => navigate('/login?reset=1', { replace: true }), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="theme-dark obs-login-root">
      <div className="obs-auth-card">

        <div className="obs-auth-brand">
          <img src="/logo-dark.png" alt="Observatory" />
          <span className="obs-auth-brand-name">{t('auth.brand')}</span>
        </div>

        <div className="obs-auth-divider" />

        {done ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            <div style={{ fontSize: 28 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#E2EAF4' }}>{t('auth.passwordUpdatedTitle')}</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{t('auth.passwordUpdatedMsg')}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--faint)' }}>{t('auth.redirecting')}</p>
            <Link to="/login" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', marginTop: 4, fontWeight: 500 }}>
              {t('auth.goToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <div className="obs-auth-title">
              <h2>{t('auth.newPasswordTitle')}</h2>
              <p>{t('auth.newPasswordHint')}</p>
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--error)', background: 'color-mix(in oklab, var(--error) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--error) 25%, transparent)', borderRadius: 6, padding: '8px 12px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="obs-field">
                <label>{t('auth.newPasswordLabel')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="obs-input obs-input-lg"
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoFocus
                    autoComplete="new-password"
                    placeholder={t('auth.newPasswordPlaceholder')}
                    required
                    style={{ width: '100%', paddingRight: 48 }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>
                    {showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                  </button>
                </div>
                {passwordTooShort && (
                  <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>{t('auth.passwordMinError')}</span>
                )}
              </div>

              <div className="obs-field">
                <label>{t('auth.confirmPasswordLabel')}</label>
                <input
                  className="obs-input obs-input-lg"
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  required
                />
                {confirmPassword && !passwordsMatch && (
                  <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>{t('auth.passwordMismatchError')}</span>
                )}
              </div>

              <button
                type="submit"
                className="obs-btn obs-btn-primary"
                disabled={loading || !token || !passwordsMatch || passwordTooShort}
                style={{ height: 40, fontSize: 13, justifyContent: 'center', marginTop: 4, borderRadius: 8 }}
              >
                {loading ? t('auth.savingButton') : t('auth.changePasswordButton')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
