import React from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Activity, Layers, DollarSign, Moon, Sun, Telescope, Wallet, Settings } from 'lucide-react';

const navItems = [
  { to: '/',          icon: Activity,  label: 'Dashboard'   },
  { to: '/requests',  icon: BarChart3, label: 'Requests'    },
  { to: '/models',    icon: Layers,    label: 'Modelos'     },
  { to: '/providers', icon: Wallet,    label: 'Proveedores' },
  { to: '/budgets',   icon: DollarSign,label: 'Presupuestos'},
  { to: '/settings',  icon: Settings,  label: 'Ajustes'     },
];

export default function Sidebar({ darkMode, setDarkMode }) {
  return (
    <aside className="w-56 flex flex-col sidebar-gradient border-r border-slate-800/60">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl gradient-blue flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Telescope className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-tight tracking-tight">LLM Observatory</div>
            <div className="text-slate-500 text-xs mt-0.5">AI Cost Tracker</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-slate-600 text-[10px] font-semibold px-3 pb-2 pt-1 uppercase tracking-widest">
          Navegación
        </p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
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
                <span>{label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-slate-800/60 space-y-1">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
        >
          <span className="flex-shrink-0">
            {darkMode
              ? <Sun className="w-3.5 h-3.5 text-amber-400" />
              : <Moon className="w-3.5 h-3.5" />
            }
          </span>
          <span>{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
        <div className="px-3 pt-1">
          <div className="text-[10px] text-slate-700 font-mono">v1.0.0</div>
        </div>
      </div>
    </aside>
  );
}
