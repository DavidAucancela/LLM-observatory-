import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Requests from './pages/Requests';
import Models from './pages/Models';
import Budgets from './pages/Budgets';
import Providers from './pages/Providers';
import Settings from './pages/Settings';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <Sidebar darkMode={darkMode} setDarkMode={setDarkMode} />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/models" element={<Models />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
