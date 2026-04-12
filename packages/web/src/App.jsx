import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Requests from './pages/Requests';
import Models from './pages/Models';
import Budgets from './pages/Budgets';
import Providers from './pages/Providers';
import Settings from './pages/Settings';
import Login          from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';

// Redirects to /login if not authenticated; shows spinner while loading auth state
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppShell() {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <Sidebar
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/requests"  element={<Requests />} />
            <Route path="/models"    element={<Models />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/budgets"   element={<Budgets />} />
            <Route path="/settings"  element={<Settings />} />
          </Routes>
        </main>
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
