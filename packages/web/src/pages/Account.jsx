import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useApi } from '../hooks/useApi';
import { fmtDate } from '../utils/fmt';

function Field({ label, children, hint }) {
  return (
    <div className="obs-field" style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function StatusMsg({ ok, msg }) {
  if (!msg) return null;
  return (
    <p style={{
      fontSize: 12,
      color: ok ? 'var(--success)' : 'var(--error)',
      marginTop: 10,
      padding: '7px 10px',
      borderRadius: 5,
      background: ok
        ? 'color-mix(in oklab, var(--success) 10%, transparent)'
        : 'color-mix(in oklab, var(--error) 10%, transparent)',
    }}>
      {msg}
    </p>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────
function ProfileSection({ user, updateUser, apiFetch }) {
  const [email,   setEmail]   = useState(user?.email || '');
  const [orgName, setOrgName] = useState(user?.orgName || '');
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState(null); // {ok, msg}

  const isAdmin = user?.role === 'admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const body = {};
      if (email !== user.email) body.email = email;
      if (isAdmin && orgName !== user.orgName) body.org_name = orgName;

      if (!Object.keys(body).length) {
        setStatus({ ok: true, msg: 'Sin cambios que guardar.' });
        return;
      }

      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setStatus({ ok: false, msg: data.error }); return; }

      updateUser({ email: data.email, orgName: data.orgName });
      setEmail(data.email);
      setOrgName(data.orgName || '');
      setStatus({ ok: true, msg: 'Perfil actualizado correctamente.' });
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="obs-card">
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>
        Perfil
      </h2>
      <form onSubmit={handleSubmit}>
        <Field label="Email" hint="Cambiar el email no requiere re-verificación.">
          <input
            className="obs-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </Field>

        {isAdmin && (
          <Field label="Nombre de la organización" hint="Solo los administradores pueden cambiar el nombre del equipo.">
            <input
              className="obs-input"
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              maxLength={100}
              style={{ width: '100%' }}
            />
          </Field>
        )}

        <StatusMsg {...(status || {})} msg={status?.msg} />

        <button
          type="submit"
          className="obs-btn obs-btn-primary obs-btn-sm"
          disabled={saving}
          style={{ marginTop: 12 }}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </section>
  );
}

// ── Password section ──────────────────────────────────────────────────────────
function PasswordSection({ apiFetch }) {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [status,   setStatus]   = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (next !== confirm) {
      setStatus({ ok: false, msg: 'Las contraseñas nuevas no coinciden.' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await apiFetch('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus({ ok: false, msg: data.error }); return; }

      setStatus({ ok: true, msg: data.message });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="obs-card">
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>
        Cambiar contraseña
      </h2>
      <form onSubmit={handleSubmit}>
        <Field label="Contraseña actual">
          <input
            className="obs-input"
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
            style={{ width: '100%' }}
          />
        </Field>
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
          <input
            className="obs-input"
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            style={{ width: '100%' }}
          />
        </Field>
        <Field label="Confirmar nueva contraseña">
          <input
            className="obs-input"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            style={{ width: '100%' }}
          />
        </Field>

        <StatusMsg {...(status || {})} msg={status?.msg} />

        <button
          type="submit"
          className="obs-btn obs-btn-primary obs-btn-sm"
          disabled={saving}
          style={{ marginTop: 12 }}
        >
          {saving ? 'Actualizando…' : 'Actualizar contraseña'}
        </button>
      </form>
    </section>
  );
}

// ── Session info section ──────────────────────────────────────────────────────
function SessionSection({ user, apiFetch, logout }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setInfo(d))
      .catch(() => {});
  }, []);

  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Member';

  return (
    <section className="obs-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Sesión actual
        </h2>
        <button
          className="obs-btn obs-btn-sm"
          style={{ color: 'var(--error)', borderColor: 'color-mix(in oklab, var(--error) 30%, transparent)' }}
          onClick={logout}
        >
          Cerrar sesión
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 20 }}>
        {[
          { label: 'Email',          value: user?.email,            mono: true },
          { label: 'Organización',   value: user?.orgName || '—' },
          { label: 'Rol',            value: roleLabel },
          { label: 'Miembro desde',  value: fmtDate(info?.createdAt) },
          { label: 'Último acceso',  value: fmtDate(info?.lastLoginAt) },
        ].map(({ label, value, mono }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: mono ? 'var(--font-mono)' : undefined, wordBreak: 'break-all' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Account() {
  const { user, updateUser, logout } = useAuth();
  const { apiFetch } = useApi();

  return (
    <main className="obs-main">
      <div className="obs-header">
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Mi cuenta</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{user?.email}</p>
        </div>
      </div>

      <div className="obs-content" style={{ padding: '24px 28px' }}>
        {/* Session info — full width strip at the top */}
        <SessionSection user={user} apiFetch={apiFetch} logout={logout} />

        {/* Forms — two-column grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}>
          <ProfileSection  user={user} updateUser={updateUser} apiFetch={apiFetch} />
          <PasswordSection apiFetch={apiFetch} />
        </div>
      </div>
    </main>
  );
}
