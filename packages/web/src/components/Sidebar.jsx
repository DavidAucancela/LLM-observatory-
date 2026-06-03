import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import i18n from '../i18n';

/* ── Nav icons ── */
function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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

const navDefs = [
  { to: '/dashboard', labelKey: 'nav.overview', descKey: 'nav.overview_desc', Icon: IconGrid     },
  { to: '/activity',  labelKey: 'nav.activity',  descKey: 'nav.activity_desc', Icon: IconActivity },
  { to: '/finance',   labelKey: 'nav.finance',   descKey: 'nav.finance_desc',  Icon: IconFinance  },
  { to: '/settings',  labelKey: 'nav.settings',  descKey: 'nav.settings_desc', Icon: IconSettings },
];

export default function Sidebar({ darkMode, setDarkMode, isOpen, onClose, collapsed, onToggleCollapse }) {
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

  const handleTheme = () => {
    setDarkMode(!darkMode);
    setMenuOpen(false);
  };

  const handleLang = () => {
    toggleLanguage();
    setMenuOpen(false);
  };

  return (
    <aside className={`obs-sidebar${isOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
      {/* Brand */}
      <div className="obs-brand">
        <img src="/logoMain.png" alt="Observatory" className="obs-brand-logo" />
        <span className="obs-brand-text">Observatory</span>
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
              end={to === '/dashboard'}
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
          onClick={() => navigate('/account')}
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
                <button className="obs-user-menu-item" onClick={() => { setMenuOpen(false); navigate('/account'); }}>
                  <IconAccount />
                  <span>{t('sidebar.myAccount')}</span>
                </button>
                <div className="obs-user-menu-sep" />
                <button className="obs-user-menu-item" onClick={handleTheme}>
                  {darkMode ? <IconSun /> : <IconMoon />}
                  <span>{darkMode ? t('sidebar.themeLight') : t('sidebar.themeDark')}</span>
                </button>
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
