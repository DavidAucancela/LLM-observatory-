import React from 'react';

const colorConfig = {
  blue: {
    strip: 'gradient-blue',
    icon: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400',
    glow: 'shadow-blue-500/10',
  },
  green: {
    strip: 'gradient-green',
    icon: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    glow: 'shadow-emerald-500/10',
  },
  purple: {
    strip: 'gradient-purple',
    icon: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
    glow: 'shadow-violet-500/10',
  },
  orange: {
    strip: 'gradient-orange',
    icon: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
    glow: 'shadow-orange-500/10',
  },
  red: {
    strip: 'gradient-red',
    icon: 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    glow: 'shadow-red-500/10',
  },
};

export default function KPICard({ title, value, subtitle, icon: Icon, color = 'blue', extra }) {
  const cfg = colorConfig[color] || colorConfig.blue;
  return (
    <div className={`relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5`}>
      {/* Colored strip */}
      <div className={`h-1 w-full ${cfg.strip}`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none">
            {title}
          </p>
          {Icon && (
            <div className={`p-2 rounded-lg ${cfg.icon}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-1.5">
          {value}
        </p>

        {subtitle && (
          <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            {subtitle}
          </p>
        )}
        {extra && <div className="mt-3">{extra}</div>}
      </div>
    </div>
  );
}
