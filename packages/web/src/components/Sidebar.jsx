import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3, Activity, Layers, DollarSign, Moon, Sun,
  Telescope, Wallet, Settings, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

const navItems = [
  { to: '/',          icon: Activity,  label: 'Dashboard'   },
  { to: '/requests',  icon: BarChart3, label: 'Requests'    },
  { to: '/models',    icon: Layers,    label: 'Modelos'     },
  { to: '/providers', icon: Wallet,    label: 'Proveedores' },
  { to: '/budgets',   icon: DollarSign,label: 'Presupuestos'},
  { to: '/settings',  icon: Settings,  label: 'Ajustes'     },
];

export default function Sidebar({ darkMode, setDarkMode, collapsed, onToggle }) {
  const { user, logout } = useAuth();

  return (
    <aside
      className={`flex flex-col sidebar-gradient border-r border-slate-800/60 transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Logo + toggle */}
      <div className="px-3 py-4 border-b border-slate-800/60 flex items-center justify-between min-h-[60px]">
        {!collapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-xl gradient-blue flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
              <Telescope className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white text-sm leading-tight tracking-tight whitespace-nowrap">LLM Observatory</div>
              <div className="text-slate-500 text-xs mt-0.5 whitespace-nowrap">AI Cost Tracker</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-xl gradient-blue flex items-center justify-center shadow-lg shadow-blue-500/25 mx-auto">
            <Telescope className="w-4 h-4 text-white" />
          </div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className={`flex-shrink-0 p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors ${
            collapsed ? 'absolute left-[52px] top-[18px] z-10 bg-slate-900 border border-slate-700/60 shadow' : 'ml-auto'
          }`}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <ChevronLeft  className="w-3.5 h-3.5" />
          }
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-slate-600 text-[10px] font-semibold px-3 pb-2 pt-1 uppercase tracking-widest">
            Navegación
          </p>
        )}
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex-shrink-0 transition-transform duration-150 ${isActive ? '' : 'group-hover:scale-110'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                {!collapsed && <span>{label}</span>}
                {!collapsed && isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4 pt-3 border-t border-slate-800/60 space-y-1">
        {/* User info */}
        {user && !collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-[10px] text-slate-500 truncate font-mono" title={user.email}>
              {user.email}
            </p>
          </div>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Modo claro' : 'Modo oscuro'}
          className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <span className="flex-shrink-0">
            {darkMode
              ? <Sun  className="w-3.5 h-3.5 text-amber-400" />
              : <Moon className="w-3.5 h-3.5" />
            }
          </span>
          {!collapsed && <span>{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          title="Cerrar sesión"
          className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>

        {!collapsed && (
          <div className="px-3 pt-1">
            <div className="text-[10px] text-slate-700 font-mono">v1.0.0</div>
          </div>
        )}
      </div>
    </aside>
  );
}
