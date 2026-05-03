import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Activity from './pages/Activity';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Login          from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import { useApi } from './hooks/useApi';

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

function AppShell() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('dark-mode') === 'true'
  );
  const [liveProviders, setLiveProviders] = useState([]);
  const { apiFetch } = useApi();

  const toggleDarkMode = (value) => {
    localStorage.setItem('dark-mode', String(value));
    setDarkMode(value);
  };

  useEffect(() => {
    apiFetch('/api/credentials')
      .then(r => r.json())
      .then(data => {
        const providers = [...new Set((data.data || []).map(c => c.provider))];
        setLiveProviders(providers);
      })
      .catch(() => {});
  }, []);

  return (
    <div className={darkMode ? 'theme-dark' : 'theme-light'} style={{ width: '100%', height: '100%' }}>
      <div className="obs-root">
        <Sidebar
          darkMode={darkMode}
          setDarkMode={toggleDarkMode}
          liveProviders={liveProviders}
        />
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/activity"  element={<Activity />} />
          <Route path="/finance"   element={<Finance />} />
          <Route path="/settings"  element={<Settings />} />
          {/* Legacy redirects */}
          <Route path="/requests"  element={<Navigate to="/activity" replace />} />
          <Route path="/models"    element={<Navigate to="/activity?tab=models" replace />} />
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
      <Route path="/login"           element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword  />} />
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
