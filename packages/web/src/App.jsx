import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import NotificationBell from './components/NotificationBell';
import CommandPalette from './components/CommandPalette';
import Dashboard from './pages/Dashboard';
import Activity from './pages/Activity';
import Models from './pages/Models';
import Keys from './pages/Keys';
import Sync from './pages/Sync';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import LandingPage    from './pages/LandingPage';
import Login          from './pages/Login';
import Register       from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import AcceptInvite   from './pages/AcceptInvite';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="theme-light obs-login-root">
        <div className="dot dot-pulse" style={{ background: 'var(--accent)', width: 10, height: 10 }} />
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Root: landing if not logged in, redirect to /dashboard if logged in
function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function AppShell() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('dark-mode') !== 'false'
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleDarkMode = (value) => {
    localStorage.setItem('dark-mode', String(value));
    setDarkMode(value);
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(v => {
      localStorage.setItem('sidebar-collapsed', String(!v));
      return !v;
    });
  };


  return (
    <div className={darkMode ? 'theme-dark' : 'theme-light'} style={{ width: '100%', height: '100%' }}>
      <ThemeToggle darkMode={darkMode} onToggle={() => toggleDarkMode(!darkMode)} />
      <NotificationBell />
      <CommandPalette />
      {/* Mobile header — only visible on small screens */}
      <div className="obs-mobile-header">
        <button className="obs-mobile-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="obs-brand" style={{ padding: 0, border: 'none' }}>
          <div className="obs-brand-mark">◐</div>
          <span>Observatory</span>
        </div>
      </div>

      <div className="obs-root">
        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div className="obs-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/activity"  element={<Activity />} />
          <Route path="/models"    element={<Models />} />
          <Route path="/keys"      element={<Keys />} />
          <Route path="/sync"      element={<Sync />} />
          <Route path="/finance"   element={<Finance />} />
          <Route path="/settings"  element={<Settings />} />
          {/* Legacy redirects */}
          <Route path="/"          element={<Navigate to="/dashboard" replace />} />
          <Route path="/requests"  element={<Navigate to="/activity" replace />} />
          <Route path="/account"   element={<Navigate to="/settings?tab=account" replace />} />
          <Route path="/providers" element={<Navigate to="/finance" replace />} />
          <Route path="/budgets"   element={<Navigate to="/finance?tab=budgets" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/"                element={<RootRoute />} />
      <Route path="/login"           element={<Login />} />
      <Route path="/register"        element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword  />} />
      <Route path="/accept-invite"   element={<AcceptInvite />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
