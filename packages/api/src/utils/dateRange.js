// Shared range → SQL INTERVAL mapping used by both /api/metrics/summary and
// the insights service, so "current period" and "previous period" (double
// the interval, ending where the current one starts) never drift apart.
const RANGE_MAP  = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', '60d': '60 days', '90d': '90 days' };
const DOUBLE_MAP = { '24h': '48 hours', '7d': '14 days', '30d': '60 days', '60d': '120 days', '90d': '180 days' };

function getRangeIntervals(range) {
  return {
    interval:    RANGE_MAP[range]  || RANGE_MAP['7d'],
    dblInterval: DOUBLE_MAP[range] || DOUBLE_MAP['7d'],
  };
}

module.exports = { getRangeIntervals };
