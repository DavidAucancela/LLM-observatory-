import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { readChartPalette, colorForModel } from '../utils/chartColors';
import { modelProviderIndices } from '../utils/providerColors';
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

// Custom dot: only draws a marker where the bucket has real requests, not on
// every zero-filled bucket the line passes through — otherwise a sparse,
// bursty series (a couple of real hours in a mostly-empty 24h window) reads
// as a smooth "spike then decay" curve with no way to tell which points are
// actual data vs. interpolated zero.
function RealDataDot({ cx, cy, payload, dataKey, color }) {
  const requests = payload?.[`${dataKey}__reqs`] || 0;
  if (!requests || cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={3} fill="var(--surface, #fff)" stroke={color} strokeWidth={2} />;
}

function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="chart2d-tooltip">
      <div className="chart2d-tooltip-label">{label}</div>
      {sorted.map(entry => {
        const requests = entry.payload?.[`${entry.dataKey}__reqs`] || 0;
        return (
          <div key={entry.dataKey} className="chart2d-tooltip-row">
            <span className="chart2d-tooltip-dot" style={{ background: entry.color }} />
            <span className="chart2d-tooltip-name">{entry.name || entry.dataKey}</span>
            <span className="chart2d-tooltip-value">{formatMetricValue(entry.value, metric)}</span>
            {entry.dataKey !== '__prev' && (
              <span className="chart2d-tooltip-reqs">
                {requests > 0 ? `${requests}×` : '—'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// `prevSeries`, when given, must already be aligned index-for-index with the
// trimmed grid (see Dashboard.jsx — it slices by grid.labelOffset/hours.length
// before passing down), so this component never needs to know about trimming.
export default function ModelTrendChart2D({ modelTimeSeries, metric, xLabels, loading, hiddenModels = new Set(), prevSeries = null, modelToProvider = {} }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const grid = useMemo(() => buildGrid(modelTimeSeries || [], metric), [modelTimeSeries, metric]);
  const providerIndices = useMemo(() => modelProviderIndices(grid.models, modelToProvider), [grid.models, modelToProvider]);

  // Real request counts per (hour, model), independent of the selected
  // metric — a metric value can legitimately be 0 on a real datapoint (e.g.
  // errorRate), so "was this bucket real" has to come from requests, not
  // from grid.values. Keyed the same way buildGrid's own cellMap is.
  const requestsByCell = useMemo(() => {
    const map = new Map();
    for (const row of modelTimeSeries || []) map.set(`${row.hour}|${row.model}`, parseInt(row.requests || 0, 10));
    return map;
  }, [modelTimeSeries]);

  const totalActivity = grid.values.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  // >= 1, not > 1: buildGrid trims leading/trailing empty buckets, so a range
  // with a single real day of activity legitimately collapses to one column.
  const hasEnoughData = grid.hours.length >= 1 && totalActivity > 0;

  // xLabels is indexed by the same position as the untrimmed bucket list —
  // see MetricSurface3D's buildGrid for why the alignment is safe, and why
  // grid.labelOffset must be added back to hi after trimming.
  const data = grid.hours.map((hour, hi) => {
    const row = { name: xLabels[grid.labelOffset + hi] ?? '' };
    grid.models.forEach((model, mi) => {
      row[model] = grid.values[mi][hi];
      row[`${model}__reqs`] = requestsByCell.get(`${hour}|${model}`) || 0;
    });
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
        {grid.models.map((model, mi) => {
          const { provider, index } = providerIndices[mi];
          const color = colorForModel(provider, index);
          return (
            <Line
              key={model}
              dataKey={model}
              // linear, not monotone: monotone smoothing can overshoot between
              // two very different consecutive bucket values (e.g. a burst hour
              // next to an empty one), exaggerating the shape of what's really
              // just a couple of isolated datapoints — linear draws exactly
              // what the buckets say, no more.
              type="linear"
              stroke={color}
              strokeWidth={2}
              dot={(props) => <RealDataDot key={`${model}-${props.payload?.name}`} {...props} color={color} />}
              hide={hiddenModels.has(model)}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          );
        })}
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
