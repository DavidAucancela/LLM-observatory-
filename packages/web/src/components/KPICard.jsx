import React from 'react';

const colorConfig = {
  blue: {
    icon: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20',
    value: 'text-slate-900 dark:text-white',
    accent: 'border-l-blue-500'
  },
  green: {
    icon: 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20',
    value: 'text-slate-900 dark:text-white',
    accent: 'border-l-emerald-500'
  },
  purple: {
    icon: 'bg-violet-500/10 text-violet-500 dark:bg-violet-500/20',
    value: 'text-slate-900 dark:text-white',
    accent: 'border-l-violet-500'
  },
  orange: {
    icon: 'bg-orange-500/10 text-orange-500 dark:bg-orange-500/20',
    value: 'text-slate-900 dark:text-white',
    accent: 'border-l-orange-500'
  },
  red: {
    icon: 'bg-red-500/10 text-red-500 dark:bg-red-500/20',
    value: 'text-slate-900 dark:text-white',
    accent: 'border-l-red-500'
  }
};

export default function KPICard({ title, value, subtitle, icon: Icon, color = 'blue', extra }) {
  const cfg = colorConfig[color] || colorConfig.blue;
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 border-l-2 ${cfg.accent} shadow-card hover:shadow-card-hover transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
        {Icon && (
          <div className={`p-2 rounded-lg ${cfg.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <p className={`text-2xl font-bold tracking-tight ${cfg.value}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{subtitle}</p>}
      {extra && <div className="mt-3">{extra}</div>}
    </div>
  );
}
