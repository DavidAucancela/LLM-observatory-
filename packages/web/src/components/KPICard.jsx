import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const colorConfig = {
  blue:   { strip: 'gradient-blue',   icon: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400',       glow: 'shadow-blue-500/10'   },
  green:  { strip: 'gradient-green',  icon: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400', glow: 'shadow-emerald-500/10'},
  purple: { strip: 'gradient-purple', icon: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',    glow: 'shadow-violet-500/10' },
  orange: { strip: 'gradient-orange', icon: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',    glow: 'shadow-orange-500/10' },
  red:    { strip: 'gradient-red',    icon: 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400',               glow: 'shadow-red-500/10'    },
};

/**
 * delta: percentage change vs previous period (number, e.g. 12.5 or -8.3)
 * deltaInverse: if true, negative delta = good (green), positive = bad (red)
 *               use for cost and latency (less is better)
 */
function DeltaBadge({ delta, inverse }) {
  if (delta === null || delta === undefined || isNaN(delta)) return null;
  const abs = Math.abs(delta).toFixed(1);
  const isUp = delta > 0;
  const isNeutral = Math.abs(delta) < 0.1;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded-full">
        <Minus className="w-2.5 h-2.5" /> 0%
      </span>
    );
  }

  // For inverse metrics (cost, latency): up is bad, down is good
  const isPositive = inverse ? !isUp : isUp;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
      isPositive
        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
        : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
    }`}>
      {isUp
        ? <TrendingUp  className="w-2.5 h-2.5" />
        : <TrendingDown className="w-2.5 h-2.5" />
      }
      {abs}%
    </span>
  );
}

export default function KPICard({ title, value, subtitle, icon: Icon, color = 'blue', extra, delta, deltaInverse }) {
  const cfg = colorConfig[color] || colorConfig.blue;
  return (
    <div className="relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
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

        <div className="flex items-center gap-2 flex-wrap">
          {subtitle && (
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              {subtitle}
            </p>
          )}
          <DeltaBadge delta={delta} inverse={deltaInverse} />
        </div>

        {extra && <div className="mt-3">{extra}</div>}
      </div>
    </div>
  );
}
