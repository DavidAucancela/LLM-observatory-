import React from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Activity, Layers, DollarSign, Moon, Sun, Telescope, Wallet, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: Activity, label: 'Dashboard' },
  { to: '/requests', icon: BarChart3, label: 'Requests' },
  { to: '/models', icon: Layers, label: 'Models' },
  { to: '/providers', icon: Wallet, label: 'Providers' },
  { to: '/budgets', icon: DollarSign, label: 'Budgets' },
  { to: '/settings', icon: Settings, label: 'Settings' }
];

export default function Sidebar({ darkMode, setDarkMode }) {
  return (
    <aside className="w-56 bg-slate-900 dark:bg-slate-950 flex flex-col">
      <div className="p-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Telescope className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">LLM Observatory</div>
            <div className="text-slate-400 text-xs">AI Cost Tracker</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        <p className="text-slate-500 text-xs font-medium px-3 py-2 uppercase tracking-wider">Menu</p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700/50">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors w-full px-2 py-1.5 rounded-lg hover:bg-slate-800"
        >
          {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {darkMode ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </aside>
  );
}
