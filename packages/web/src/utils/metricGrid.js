import { formatCost, fmtLatency } from './fmt';

// Pulled out of MetricSurface3D.jsx (no three.js import here on purpose) so
// Dashboard.jsx — the eagerly-loaded main route — can compute the shared
// model list for the chart toolbar's legend without statically pulling in
// @react-three/fiber/drei/three (~800KB) into its own bundle chunk.

function fmtCompact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

export function formatMetricValue(value, metric) {
  switch (metric) {
    case 'cost':      return formatCost(value);
    case 'latency':   return fmtLatency(value);
    case 'errorRate': return `${(value * 100).toFixed(1)}%`;
    default:          return fmtCompact(value);
  }
}

export function extractMetric(row, metric) {
  if (!row) return 0;
  const requests = parseInt(row.requests || 0, 10);
  switch (metric) {
    case 'requests':  return requests;
    case 'tokens':    return parseFloat(row.total_tokens || 0);
    case 'cost':      return parseFloat(row.cost_usd || 0);
    case 'latency':   return parseFloat(row.avg_latency_ms || 0);
    case 'errorRate': return requests > 0 ? parseInt(row.error_count || 0, 10) / requests : 0;
    default:          return 0;
  }
}

export function buildGrid(modelTimeSeries, metric) {
  const hours = [...new Set(modelTimeSeries.map(r => r.hour))].sort((a, b) => new Date(a) - new Date(b));
  // Zero-fill (generate_series in metrics.js) emits one row per hour for
  // every model regardless of activity — drop models with no requests in
  // any bucket so the grid only shows models that actually have data.
  const modelsWithActivity = new Set(
    modelTimeSeries.filter(r => parseInt(r.requests || 0, 10) > 0).map(r => r.model)
  );
  const models = [...modelsWithActivity]
    .sort((a, b) => (a === 'Other' ? 1 : 0) - (b === 'Other' ? 1 : 0));

  const cellMap = new Map();
  for (const row of modelTimeSeries) cellMap.set(`${row.hour}|${row.model}`, row);

  let max = 0;
  const values = models.map(model =>
    hours.map(hour => {
      const v = extractMetric(cellMap.get(`${hour}|${model}`), metric);
      if (v > max) max = v;
      return v;
    })
  );

  // Trim leading/trailing buckets where every model is zero. The backend
  // zero-fills the *entire* selected range (e.g. all 91 buckets for 90d)
  // even when real activity only spans a narrower window inside it (a new
  // account, or a demo dataset that only has ~30 days of history) — left
  // untrimmed, that padding inflates gridSpan/cameraDistance for the whole
  // scene and the real bars end up crammed into a small corner. Only the
  // outer edges are trimmed (not gaps in the middle) so a genuine "quiet
  // day" between active ones still renders as an empty column, not a jump
  // cut. `labelOffset` lets consumers keep indexing the original xLabels
  // array, which is built from the untrimmed bucket list.
  let trimStart = 0;
  let trimEnd = hours.length;
  const columnHasActivity = (hi) => values.some(row => row[hi] > 0);
  while (trimStart < trimEnd && !columnHasActivity(trimStart)) trimStart++;
  while (trimEnd > trimStart && !columnHasActivity(trimEnd - 1)) trimEnd--;

  const trimmedHours  = hours.slice(trimStart, trimEnd);
  const trimmedValues = values.map(row => row.slice(trimStart, trimEnd));

  return { hours: trimmedHours, models, values: trimmedValues, max: max || 1, labelOffset: trimStart };
}
