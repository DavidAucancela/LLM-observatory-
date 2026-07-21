import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import i18n from '../i18n';

/* ── Nav icons ── */
function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconModels() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" />
      <polyline points="3 7 12 12 21 7" />
      <line x1="12" y1="12" x2="12" y2="22" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.6 12.4 20 3l2 2-1.5 1.5L22 8l-2.5 2.5-2-2-2.6 2.6" />
    </svg>
  );
}

function IconSync() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M20.49 9A9 9 0 0 0 5.6 5.6L1 10m22 4-4.6 4.4A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function IconFinance() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconAccount() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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

// "Resumen" (Dashboard) isn't a list item anymore — it's reached via the
// brand logo/link at the top of the sidebar instead, see the `obs-brand`
// block below. Requests/Models/Keys/Sync used to be tabs inside single pages
// (Activity, Settings); they're now their own top-level items with their own
// routes. "Mi cuenta" moved the other way — it used to be its own page, now
// it's a tab inside Settings (see the user-menu `navigate` calls below).
const navDefs = [
  { to: '/activity',  labelKey: 'nav.requests', descKey: 'nav.requests_desc', Icon: IconActivity },
  { to: '/models',    labelKey: 'nav.models',   descKey: 'nav.models_desc',   Icon: IconModels   },
  { to: '/finance',   labelKey: 'nav.finance',  descKey: 'nav.finance_desc',  Icon: IconFinance  },
  { to: '/keys',      labelKey: 'nav.keys',     descKey: 'nav.keys_desc',     Icon: IconKey      },
  { to: '/sync',      labelKey: 'nav.sync',     descKey: 'nav.sync_desc',     Icon: IconSync     },
  { to: '/settings',  labelKey: 'nav.settings', descKey: 'nav.settings_desc', Icon: IconSettings },
];

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const userBlockRef = useRef(null);

  const roleLabel = user?.role === 'admin' ? t('sidebar.roleAdmin') : t('sidebar.roleMember');
  const isAdmin   = user?.role === 'admin';

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('lang', next);
  };

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (userBlockRef.current && !userBlockRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
  };

  const handleLang = () => {
    toggleLanguage();
    setMenuOpen(false);
  };

  return (
    <aside className={`obs-sidebar${isOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
      {/* Brand — doubles as the entry point to Resumen/Dashboard now that it's
          no longer a regular nav item */}
      <div className="obs-brand">
        <Link to="/dashboard" className="obs-brand-link" title={t('dashboard.title')} onClick={onClose}>
          <img src="/logoMain.png" alt="Observatory" className="obs-brand-logo" />
          <span className="obs-brand-text">Observatory</span>
        </Link>
        <button
          className="obs-sidebar-toggle"
          onClick={onToggleCollapse}
          title={collapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
        >
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
      </div>

      {/* Nav */}
      <nav className="obs-nav">
        {navDefs.map(({ to, labelKey, descKey, Icon }) => {
          const label = t(labelKey);
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `obs-nav-item${isActive ? ' active' : ''}`}
              onClick={onClose}
              title={collapsed ? label : undefined}
            >
              <span className="obs-nav-icon"><Icon /></span>
              <span className="obs-nav-body">
                <span className="obs-nav-label">{label}</span>
                <span className="obs-nav-desc">{t(descKey)}</span>
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="obs-nav-spacer" />

      {/* User block */}
      <div className="obs-user-block" ref={userBlockRef}>
        {/* Collapsed: show user icon only */}
        <div
          className="obs-user-icon-collapsed"
          title={user?.email}
          onClick={() => navigate('/settings?tab=account')}
          style={{ cursor: 'pointer' }}
        >
          <IconUser />
        </div>

        {/* Expanded: clickable user info + dropdown */}
        {user && (
          <>
            <button
              className="obs-user-info--btn"
              onClick={() => setMenuOpen(v => !v)}
              title={t('sidebar.myAccount')}
            >
              <div className="obs-user-text-block">
                {user.orgName && (
                  <div className="obs-user-org">{user.orgName}</div>
                )}
                <div className="obs-user-email">{user.email}</div>
              </div>
              <span className={`obs-role-badge${isAdmin ? ' role-admin' : ''}`}>{roleLabel}</span>
            </button>

            {menuOpen && (
              <div className="obs-user-menu">
                <button className="obs-user-menu-item" onClick={() => { setMenuOpen(false); navigate('/settings?tab=account'); }}>
                  <IconAccount />
                  <span>{t('sidebar.myAccount')}</span>
                </button>
                <div className="obs-user-menu-sep" />
                <button className="obs-user-menu-item" onClick={handleLang}>
                  <IconGlobe />
                  <span>{i18n.language === 'en' ? 'Español' : 'English'}</span>
                </button>
                <div className="obs-user-menu-sep" />
                <button className="obs-user-menu-item obs-user-menu-item--danger" onClick={handleLogout}>
                  <IconLogout />
                  <span>{t('sidebar.signOut')}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
