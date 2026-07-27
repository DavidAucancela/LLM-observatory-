const pool = require('../db/pool');
const { getRangeIntervals } = require('../utils/dateRange');

// Insights are computed on-demand from api_calls on every call — no snapshot
// is ever stored (see schema.sql's insight_dismissals comment for why: only
// what's muted, and until when, is persisted). Thresholds below are simple
// rule-based detectors, not statistical anomaly detection — tuned to avoid
// flagging low-volume/low-cost noise (see the MIN_* floors on each detector).

const COST_SPIKE_MIN_ABS_USD = 0.5;   // ignore spikes under this — noise on trivial spend
const COST_SPIKE_WARN_PCT    = 75;
const COST_SPIKE_CRIT_PCT    = 200;

const ERROR_MIN_REQUESTS = 15;        // need enough samples for an error rate to mean anything
const ERROR_WARN_PCT     = 5;
const ERROR_CRIT_PCT     = 15;

const LATENCY_MIN_PREV_MS   = 200;    // skip already-fast/trivial calls (rounding noise)
const LATENCY_MIN_REQUESTS  = 5;
const LATENCY_WARN_PCT      = 50;
const LATENCY_CRIT_PCT      = 120;

const IMPROVEMENT_MIN_REQUESTS = 10;
const IMPROVEMENT_MIN_PCT      = 15;

const MAX_INSIGHTS = 5;
const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };

function pctChange(curr, prev) {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

async function computeInsights(orgId, range) {
  const { interval, dblInterval } = getRangeIntervals(range);

  const { rows } = await pool.query(
    `SELECT model, provider,
            COUNT(*)      FILTER (WHERE timestamp > NOW() - INTERVAL '${interval}')                          AS curr_requests,
            COALESCE(SUM(cost_usd) FILTER (WHERE timestamp > NOW() - INTERVAL '${interval}'), 0)              AS curr_cost,
            COUNT(*)      FILTER (WHERE timestamp > NOW() - INTERVAL '${interval}' AND status_code >= 400)    AS curr_errors,
            COALESCE(AVG(latency_ms) FILTER (WHERE timestamp > NOW() - INTERVAL '${interval}'), 0)            AS curr_latency,
            COUNT(*)      FILTER (WHERE timestamp <= NOW() - INTERVAL '${interval}')                          AS prev_requests,
            COALESCE(SUM(cost_usd) FILTER (WHERE timestamp <= NOW() - INTERVAL '${interval}'), 0)             AS prev_cost,
            COUNT(*)      FILTER (WHERE timestamp <= NOW() - INTERVAL '${interval}' AND status_code >= 400)   AS prev_errors,
            COALESCE(AVG(latency_ms) FILTER (WHERE timestamp <= NOW() - INTERVAL '${interval}'), 0)           AS prev_latency
     FROM api_calls
     WHERE org_id = $1 AND timestamp > NOW() - INTERVAL '${dblInterval}'
     GROUP BY model, provider`,
    [orgId]
  );

  const models = rows.map(r => ({
    model: r.model, provider: r.provider,
    currRequests: parseInt(r.curr_requests, 10), currCost: parseFloat(r.curr_cost),
    currErrors:   parseInt(r.curr_errors, 10),   currLatency: parseFloat(r.curr_latency),
    prevRequests: parseInt(r.prev_requests, 10), prevCost: parseFloat(r.prev_cost),
    prevErrors:   parseInt(r.prev_errors, 10),   prevLatency: parseFloat(r.prev_latency),
  }));

  const candidates = [];

  for (const m of models) {
    // Cost spike
    if (m.prevCost > 0 && m.currCost >= COST_SPIKE_MIN_ABS_USD) {
      const pct = pctChange(m.currCost, m.prevCost);
      if (pct >= COST_SPIKE_WARN_PCT) {
        candidates.push({
          insight_key: `cost_spike:${m.provider}:${m.model}`,
          type: 'cost_spike',
          severity: pct >= COST_SPIKE_CRIT_PCT ? 'critical' : 'warning',
          provider: m.provider, model: m.model,
          magnitude: pct,
          metrics: { currCost: m.currCost, prevCost: m.prevCost, pctChange: pct },
        });
      }
    }

    // Error rate breach
    if (m.currRequests >= ERROR_MIN_REQUESTS) {
      const errorPct = (m.currErrors / m.currRequests) * 100;
      if (errorPct >= ERROR_WARN_PCT) {
        candidates.push({
          insight_key: `error_rate:${m.provider}:${m.model}`,
          type: 'error_rate',
          severity: errorPct >= ERROR_CRIT_PCT ? 'critical' : 'warning',
          provider: m.provider, model: m.model,
          magnitude: errorPct,
          metrics: { currErrors: m.currErrors, currRequests: m.currRequests, errorPct },
        });
      }
    }

    // Latency regression
    if (m.prevLatency >= LATENCY_MIN_PREV_MS && m.currRequests >= LATENCY_MIN_REQUESTS) {
      const pct = pctChange(m.currLatency, m.prevLatency);
      if (pct >= LATENCY_WARN_PCT) {
        candidates.push({
          insight_key: `latency_regression:${m.provider}:${m.model}`,
          type: 'latency_regression',
          severity: pct >= LATENCY_CRIT_PCT ? 'critical' : 'warning',
          provider: m.provider, model: m.model,
          magnitude: pct,
          metrics: { currLatency: m.currLatency, prevLatency: m.prevLatency, pctChange: pct },
        });
      }
    }
  }

  // Improvement — org-level cost-per-request, current vs previous
  const totals = models.reduce((acc, m) => ({
    currRequests: acc.currRequests + m.currRequests,
    currCost:     acc.currCost + m.currCost,
    prevRequests: acc.prevRequests + m.prevRequests,
    prevCost:     acc.prevCost + m.prevCost,
  }), { currRequests: 0, currCost: 0, prevRequests: 0, prevCost: 0 });

  if (totals.currRequests >= IMPROVEMENT_MIN_REQUESTS && totals.prevRequests > 0 && totals.prevCost > 0) {
    const currAvg = totals.currCost / totals.currRequests;
    const prevAvg = totals.prevCost / totals.prevRequests;
    // % drop relative to the previous baseline (not the new, smaller value) —
    // i.e. -pctChange(curr, prev), so it matches how a "cost fell X%" claim reads.
    const pctDrop = -pctChange(currAvg, prevAvg);
    if (pctDrop >= IMPROVEMENT_MIN_PCT) {
      candidates.push({
        insight_key: 'improvement:org',
        type: 'improvement',
        severity: 'info',
        provider: null, model: null,
        magnitude: pctDrop,
        metrics: { currAvgCost: currAvg, prevAvgCost: prevAvg, pctChange: pctDrop },
        spark: [prevAvg, currAvg],
      });
    }
  }

  candidates.sort((a, b) => (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || (b.magnitude - a.magnitude));
  const top = candidates.slice(0, MAX_INSIGHTS);

  // Sparkline: one extra query, scoped only to the models that actually
  // triggered a per-model insight (never the whole model list).
  const flaggedModels = [...new Set(top.filter(c => c.model).map(c => c.model))];
  if (flaggedModels.length) {
    const useDays = range !== '24h';
    const bucketUnit = useDays ? 'day' : 'hour';
    const { rows: buckets } = await pool.query(
      `SELECT date_trunc('${bucketUnit}', timestamp) AS bucket, model,
              COALESCE(SUM(cost_usd), 0) AS cost,
              COUNT(*) AS requests,
              COUNT(*) FILTER (WHERE status_code >= 400) AS errors,
              COALESCE(AVG(latency_ms), 0) AS latency
       FROM api_calls
       WHERE org_id = $1 AND timestamp > NOW() - INTERVAL '${dblInterval}' AND model = ANY($2)
       GROUP BY bucket, model ORDER BY bucket ASC`,
      [orgId, flaggedModels]
    );

    for (const insight of top) {
      if (!insight.model) continue; // improvement already has its own 2-point spark
      const rowsForModel = buckets.filter(b => b.model === insight.model);
      if (insight.type === 'cost_spike') {
        insight.spark = rowsForModel.map(b => parseFloat(b.cost));
      } else if (insight.type === 'error_rate') {
        insight.spark = rowsForModel.map(b => {
          const reqs = parseInt(b.requests, 10);
          return reqs > 0 ? (parseInt(b.errors, 10) / reqs) * 100 : 0;
        });
      } else if (insight.type === 'latency_regression') {
        insight.spark = rowsForModel.map(b => parseFloat(b.latency));
      }
    }
  }

  return top.map(({ magnitude, ...insight }) => insight);
}

module.exports = { computeInsights };
