import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const navItems = [
  { to: '/',         label: 'Overview'  },
  { to: '/activity', label: 'Activity'  },
  { to: '/finance',  label: 'Finance'   },
  { to: '/settings', label: 'Settings'  },
];

const PROVIDER_COLORS = { anthropic: '#D97706', openai: '#059669' };

function StatusDot({ color, pulse }) {
  return (
    <span
      className={pulse ? 'dot dot-pulse' : 'dot'}
      style={{ background: color, width: 7, height: 7 }}
    />
  );
}

export default function Sidebar({ darkMode, setDarkMode, liveProviders = [] }) {
  const { user, logout } = useAuth();

  return (
    <aside className="obs-sidebar">
      {/* Brand */}
      <div className="obs-brand">
        <div className="obs-brand-mark">◐</div>
        <span>Observatory</span>
      </div>

      {/* Nav */}
      <nav className="obs-nav">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `obs-nav-item${isActive ? ' active' : ''}`}
          >
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="obs-nav-spacer" />

      {/* Provider status */}
      <div className="obs-status-block">
        <div className="obs-status-label">Providers</div>
        {['anthropic', 'openai'].map(p => {
          const active = liveProviders.includes(p);
          return (
            <div key={p} className="obs-status-row">
              <StatusDot color={active ? PROVIDER_COLORS[p] : 'var(--faint)'} pulse={active} />
              <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{p === 'openai' ? 'OpenAI' : 'Anthropic'}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: active ? 'var(--success)' : 'var(--faint)' }}>
                {active ? 'OK' : '--'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Theme toggle */}
      <button className="obs-theme-toggle" onClick={() => setDarkMode(!darkMode)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {darkMode
            ? <><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.22" y1="4.22" x2="7.05" y2="7.05" /><line x1="16.95" y1="16.95" x2="19.78" y2="19.78" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.22" y1="19.78" x2="7.05" y2="16.95" /><line x1="16.95" y1="7.05" x2="19.78" y2="4.22" /></>
            : <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          }
        </svg>
        {darkMode ? 'Light mode' : 'Dark mode'}
      </button>

      {/* Logout */}
      <button className="obs-logout-btn" onClick={logout}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign out
      </button>

      {user && (
        <div style={{ padding: '6px 18px 0', fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email}
        </div>
      )}
    </aside>
  );
}
