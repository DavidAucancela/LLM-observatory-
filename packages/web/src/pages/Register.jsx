import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';

export default function Register() {
  const { apiFetch } = useApi();

  const [email, setEmail]       = useState('');
  const [orgName, setOrgName]   = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  const pwMismatch = confirm && password !== confirm;
  const pwShort    = password && password.length < 8;
  const canSubmit  = email && password.length >= 8 && password === confirm && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, org_name: orgName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>Create account</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Set up your Observatory access</div>
        </div>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--success)', background: 'color-mix(in oklab, var(--success) 10%, transparent)', border: '1px solid color-mix(in oklab, var(--success) 30%, transparent)', borderRadius: 5, padding: '12px 14px', lineHeight: 1.6 }}>
              Account created. Check your email (or the server terminal in development) for the activation link.
            </div>
            <Link
              to="/login"
              style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', textAlign: 'center' }}
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
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
                <label>Organization name <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  className="obs-input obs-input-lg"
                  type="text"
                  placeholder="Acme Corp"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                />
              </div>

              <div className="obs-field">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="obs-input obs-input-lg"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
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
                {pwShort && (
                  <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>
                    At least 8 characters required
                  </span>
                )}
              </div>

              <div className="obs-field">
                <label>Confirm password</label>
                <input
                  className="obs-input obs-input-lg"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                />
                {pwMismatch && (
                  <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>
                    Passwords don't match
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="obs-btn obs-btn-primary"
                disabled={!canSubmit}
                style={{ height: 38, fontSize: 13, justifyContent: 'center', marginTop: 4 }}
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                Sign in
              </Link>
            </div>
          </>
        )}

        <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
          LLM Observatory · internal tooling
        </div>
      </div>
    </div>
  );
}
