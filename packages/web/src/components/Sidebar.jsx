import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

/* ── Nav icons ── */
function IconGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconFinance() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="7.05" y2="7.05" /><line x1="16.95" y1="16.95" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="7.05" y2="16.95" /><line x1="16.95" y1="7.05" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const navItems = [
  { to: '/dashboard', label: 'Overview',  Icon: IconGrid     },
  { to: '/activity',  label: 'Activity',  Icon: IconActivity },
  { to: '/finance',   label: 'Finance',   Icon: IconFinance  },
  { to: '/settings',  label: 'Settings',  Icon: IconSettings },
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

export default function Sidebar({ darkMode, setDarkMode, liveProviders = [], isOpen, onClose, collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials  = user?.email ? user.email[0].toUpperCase() : '?';
  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Member';

  return (
    <aside className={`obs-sidebar${isOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
      {/* Brand */}
      <div className="obs-brand">
        <div className="obs-brand-mark">◐</div>
        <span className="obs-brand-text">Observatory</span>
        <button
          className="obs-sidebar-toggle"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
      </div>

      {/* Nav */}
      <nav className="obs-nav">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) => `obs-nav-item${isActive ? ' active' : ''}`}
            onClick={onClose}
            title={collapsed ? label : undefined}
          >
            <span className="obs-nav-icon"><Icon /></span>
            <span className="obs-nav-label">{label}</span>
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
              <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>
                {p === 'openai' ? 'OpenAI' : 'Anthropic'}
              </span>
              <span style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: active ? 'var(--success)' : 'var(--faint)',
              }}>
                {active ? 'OK' : '--'}
              </span>
            </div>
          );
        })}
      </div>

      {/* User block */}
      <div className="obs-user-block">
        {user && (
          <button
            className="obs-user-info obs-user-info--btn"
            onClick={() => navigate('/account')}
            title="Mi cuenta"
          >
            <div className="obs-user-avatar">{initials}</div>
            <div className="obs-user-meta">
              {user.orgName && (
                <div className="obs-user-org">{user.orgName}</div>
              )}
              <div className="obs-user-email">{user.email}</div>
            </div>
            <span className="obs-role-badge">{roleLabel}</span>
          </button>
        )}
        <div className="obs-user-actions">
          <button
            className="obs-user-action-btn"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <IconSun /> : <IconMoon />}
            <span>{darkMode ? 'Light' : 'Dark'}</span>
          </button>
          <button
            className="obs-user-action-btn obs-user-action-btn--danger"
            onClick={logout}
            title="Sign out"
          >
            <IconLogout />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
