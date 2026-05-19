import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function AcceptInvite() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const { login }  = useAuth();
  const token      = params.get('token') || '';

  const [invite, setInvite]     = useState(null);
  const [loadErr, setLoadErr]   = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!token) { setLoadErr('Token de invitación no encontrado'); return; }
    fetch(`${API_URL}/api/auth/invite-info?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setLoadErr(d.error);
        else { setInvite(d); setEmail(d.email || ''); }
      })
      .catch(() => setLoadErr('No se pudo cargar la invitación'));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 8) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/accept-invite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aceptar invitación');
      // Store token and redirect like a normal login
      localStorage.setItem('llm_obs_token', data.token);
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="theme-light obs-login-root">
      <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <div className="obs-brand-mark" style={{ width: 22, height: 22, fontSize: 12 }}>◐</div>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>Observatory</span>
        </div>

        {loadErr ? (
          <div style={{ fontSize: 13, color: 'var(--error)', textAlign: 'center' }}>{loadErr}</div>
        ) : !invite ? (
          <div style={{ textAlign: 'center' }}>
            <div className="dot dot-pulse" style={{ background: 'var(--accent)', width: 8, height: 8, margin: '0 auto' }} />
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginTop: -8 }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>
                Join {invite.org_name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                {invite.invited_by_email
                  ? `Invited by ${invite.invited_by_email}`
                  : 'You have been invited to join this organization'}
              </div>
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--error)', background: 'color-mix(in oklab, var(--error) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--error) 25%, transparent)', borderRadius: 5, padding: '8px 12px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="obs-field">
                <label>Email</label>
                <input
                  className="obs-input obs-input-lg"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="obs-field">
                <label>Set a password</label>
                <input
                  className="obs-input obs-input-lg"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                {password && password.length < 8 && (
                  <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>At least 8 characters required</span>
                )}
              </div>
              <button
                type="submit"
                className="obs-btn obs-btn-primary"
                disabled={loading || password.length < 8}
                style={{ height: 38, fontSize: 13, justifyContent: 'center', marginTop: 4 }}
              >
                {loading ? 'Joining…' : `Join ${invite.org_name}`}
              </button>
            </form>

            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
