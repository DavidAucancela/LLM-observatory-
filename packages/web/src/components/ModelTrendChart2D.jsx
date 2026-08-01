import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { readChartPalette, colorForModelIndex } from '../utils/chartColors';
import { buildGrid, formatMetricValue } from '../utils/metricGrid';

// Same live-theme-follow behavior as MetricSurface3D's useThemePalette — duplicated
// here (not exported from the 3D file) to keep that file untouched functionally.
function useThemePalette() {
  const [palette, setPalette] = useState(() => readChartPalette());

  useEffect(() => {
    const target = document.querySelector('.theme-dark, .theme-light') || document.documentElement;
    const observer = new MutationObserver(() => setPalette(readChartPalette()));
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return palette;
}

function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="chart2d-tooltip">
      <div className="chart2d-tooltip-label">{label}</div>
      {sorted.map(entry => (
        <div key={entry.dataKey} className="chart2d-tooltip-row">
          <span className="chart2d-tooltip-dot" style={{ background: entry.color }} />
          <span className="chart2d-tooltip-name">{entry.name || entry.dataKey}</span>
          <span className="chart2d-tooltip-value">{formatMetricValue(entry.value, metric)}</span>
        </div>
      ))}
    </div>
  );
}

// `prevSeries`, when given, must already be aligned index-for-index with the
// trimmed grid (see Dashboard.jsx — it slices by grid.labelOffset/hours.length
// before passing down), so this component never needs to know about trimming.
export default function ModelTrendChart2D({ modelTimeSeries, metric, xLabels, loading, hiddenModels = new Set(), prevSeries = null }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const grid = useMemo(() => buildGrid(modelTimeSeries || [], metric), [modelTimeSeries, metric]);

  const totalActivity = grid.values.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  // >= 1, not > 1: buildGrid trims leading/trailing empty buckets, so a range
  // with a single real day of activity legitimately collapses to one column.
  const hasEnoughData = grid.hours.length >= 1 && totalActivity > 0;

  // xLabels is indexed by the same position as the untrimmed bucket list —
  // see MetricSurface3D's buildGrid for why the alignment is safe, and why
  // grid.labelOffset must be added back to hi after trimming.
  const data = grid.hours.map((hour, hi) => {
    const row = { name: xLabels[grid.labelOffset + hi] ?? '' };
    grid.models.forEach((model, mi) => { row[model] = grid.values[mi][hi]; });
    if (prevSeries) row.__prev = prevSeries[hi] ?? null;
    return row;
  });

  if (loading) {
    return <div className="obs-skeleton" style={{ height: '100%', borderRadius: 4 }} />;
  }

  if (!hasEnoughData) {
    return (
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dashboard.notEnoughData')}</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
        <XAxis dataKey="name" stroke={palette.muted} tick={{ fontSize: 11, fill: palette.muted }} tickLine={false} axisLine={{ stroke: palette.border }} />
        <YAxis
          stroke={palette.muted}
          tick={{ fontSize: 11, fill: palette.muted }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => formatMetricValue(v, metric)}
        />
        <Tooltip content={<CustomTooltip metric={metric} />} cursor={{ stroke: palette.border }} />
        {grid.models.map((model, mi) => (
          <Line
            key={model}
            dataKey={model}
            type="monotone"
            stroke={colorForModelIndex(model === 'Other' ? -1 : mi)}
            strokeWidth={2}
            dot={false}
            hide={hiddenModels.has(model)}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        ))}
        {prevSeries && (
          <Line
            dataKey="__prev"
            name={t('dashboard.prevPeriodLabel')}
            type="monotone"
            stroke={palette.muted}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
