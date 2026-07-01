const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { deliverWebhooks } = require('../services/webhooks');

const router = express.Router();

const MetricSchema = z.object({
  provider:           z.enum(['anthropic', 'openai']).default('anthropic'),
  model:              z.string().min(1),
  input_tokens:       z.number().int().min(0),
  output_tokens:      z.number().int().min(0),
  total_tokens:       z.number().int().min(0),
  cost_usd:           z.number().min(0),
  latency_ms:         z.number().int().min(0),
  status_code:        z.number().int().min(100).max(599),
  tools_used:         z.array(z.string()).default([]),
  prompt_preview:     z.string().max(200).optional(),
  tags:               z.record(z.unknown()).optional().default({}),
  api_key_hint:       z.string().max(30).optional(),
  cache_read_tokens:  z.number().int().min(0).default(0),
  cache_write_tokens: z.number().int().min(0).default(0),
  error_type:         z.string().max(100).optional(),
  error_message:      z.string().max(500).nullable().optional(),
});

// ── POST / — SDK ingest (requires observatory token or JWT) ───────────────────
router.post('/', async (req, res) => {
  try {
    const { orgId } = req.user;
    const data = MetricSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO api_calls
         (org_id, provider, model, input_tokens, output_tokens, total_tokens,
          cost_usd, latency_ms, status_code, tools_used, prompt_preview, tags, api_key_hint,
          cache_read_tokens, cache_write_tokens, error_type, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        orgId,
        data.provider, data.model,
        data.input_tokens, data.output_tokens, data.total_tokens,
        data.cost_usd, data.latency_ms, data.status_code,
        JSON.stringify(data.tools_used),
        data.prompt_preview || null,
        JSON.stringify(data.tags || {}),
        data.api_key_hint || null,
        data.cache_read_tokens || 0,
        data.cache_write_tokens || 0,
        data.error_type || null,
        data.error_message || null,
      ]
    );
    if (req.app.get('io')) req.app.get('io').emit('new-metric', result.rows[0]);
    deliverWebhooks(req.user.orgId, 'metric.created', result.rows[0]).catch(() => {});
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
    console.error('POST /api/metrics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET / — paginated list ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { orgId } = req.user;
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset  = (page - 1) * limit;
    const model    = req.query.model;
    const provider = req.query.provider;
    const status   = req.query.status; // 'error' | 'success'
    const search   = req.query.search?.trim();
    const range   = req.query.range || '7d';
    const sortBy  = ['timestamp','cost_usd','latency_ms','total_tokens'].includes(req.query.sortBy) ? req.query.sortBy : 'timestamp';
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
    const rangeMap= { '24h':'24 hours', '7d':'7 days', '30d':'30 days', '60d':'60 days', '90d':'90 days' };
    const interval= rangeMap[range] || '7 days';
    const startDate = req.query.start;
    const endDate   = req.query.end;

    const tagKey   = req.query.tag_key?.trim();
    const tagValue = req.query.tag_value?.trim();

    const params = [orgId]; // $1 = org_id
    let where = 'WHERE org_id = $1';

    if (startDate && endDate) {
      params.push(startDate, endDate);
      where += ` AND timestamp >= $${params.length - 1} AND timestamp <= $${params.length}`;
    } else {
      where += ` AND timestamp > NOW() - INTERVAL '${interval}'`;
    }
    if (model)    { params.push(model);    where += ` AND model = $${params.length}`; }
    if (provider) { params.push(provider); where += ` AND provider = $${params.length}`; }
    if (status === 'error')   where += ` AND status_code >= 400`;
    if (status === 'success') where += ` AND status_code < 400`;
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (prompt_preview ILIKE $${params.length} OR model ILIKE $${params.length})`;
    }
    if (tagKey && tagValue) {
      params.push(tagKey, tagValue);
      where += ` AND tags->>$${params.length - 1} = $${params.length}`;
    } else if (tagKey) {
      params.push(tagKey);
      where += ` AND tags ? $${params.length}`;
    }

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM api_calls ${where}`, params),
      pool.query(
        `SELECT * FROM api_calls ${where} ORDER BY ${sortBy} ${sortDir}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      data: dataResult.rows,
      pagination: {
        page, limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error('GET /api/metrics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /summary — aggregated stats + time series + prev period ────────────────
router.get('/summary', async (req, res) => {
  try {
    const { orgId } = req.user;
    const range    = req.query.range || '7d';
    const rangeMap = { '24h':'24 hours', '7d':'7 days', '30d':'30 days', '60d':'60 days', '90d':'90 days' };
    const doubleMap= { '24h':'48 hours', '7d':'14 days', '30d':'60 days', '60d':'120 days', '90d':'180 days' };
    const interval    = rangeMap[range] || '7 days';
    const dblInterval = doubleMap[range] || '14 days';
    const startDate = req.query.start;
    const endDate   = req.query.end;
    const useDays   = ['30d','60d','90d'].includes(range) || (startDate && endDate);
    const timeBucket= useDays ? `DATE_TRUNC('day', timestamp)` : `DATE_TRUNC('hour', timestamp)`;

    const currParams = [orgId];
    let dateFilter;
    if (startDate && endDate) {
      currParams.push(startDate, endDate);
      dateFilter = `org_id = $1 AND timestamp >= $2 AND timestamp <= $3`;
    } else {
      dateFilter = `org_id = $1 AND timestamp > NOW() - INTERVAL '${interval}'`;
    }

    const prevParams = [orgId];
    let prevFilter;
    if (startDate && endDate) {
      const durationMs = new Date(endDate).getTime() - new Date(startDate).getTime();
      const prevEnd    = new Date(startDate).toISOString();
      const prevStart  = new Date(new Date(startDate).getTime() - durationMs).toISOString();
      prevParams.push(prevStart, prevEnd);
      prevFilter = `org_id = $1 AND timestamp >= $2 AND timestamp <= $3`;
    } else {
      prevFilter = `org_id = $1 AND timestamp > NOW() - INTERVAL '${dblInterval}' AND timestamp <= NOW() - INTERVAL '${interval}'`;
    }

    const [summary, byModel, byProvider, timeSeries, prevSummary, errorBreakdown] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total_requests,
                COALESCE(SUM(total_tokens),0)       as total_tokens,
                COALESCE(SUM(input_tokens),0)       as total_input_tokens,
                COALESCE(SUM(output_tokens),0)      as total_output_tokens,
                COALESCE(SUM(cost_usd),0)           as total_cost_usd,
                COALESCE(AVG(latency_ms),0)         as avg_latency_ms,
                COALESCE(AVG(cost_usd),0)           as avg_cost_usd,
                COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
                COALESCE(SUM(cache_read_tokens),0)  as total_cache_read_tokens,
                COALESCE(SUM(cache_write_tokens),0) as total_cache_write_tokens
         FROM api_calls WHERE ${dateFilter}`,
        currParams
      ),
      pool.query(
        `SELECT model, provider,
                COUNT(*) as requests,
                COALESCE(SUM(total_tokens),0) as total_tokens,
                COALESCE(SUM(cost_usd),0)     as total_cost,
                COALESCE(AVG(latency_ms),0)   as avg_latency
         FROM api_calls WHERE ${dateFilter}
         GROUP BY model, provider ORDER BY total_cost DESC`,
        currParams
      ),
      pool.query(
        `SELECT provider,
                COUNT(*) as requests,
                COALESCE(SUM(total_tokens),0) as total_tokens,
                COALESCE(SUM(cost_usd),0)     as total_cost,
                COALESCE(AVG(latency_ms),0)   as avg_latency
         FROM api_calls WHERE ${dateFilter}
         GROUP BY provider ORDER BY total_cost DESC`,
        currParams
      ),
      pool.query(
        `SELECT ${timeBucket} as hour, provider,
                COALESCE(SUM(input_tokens),0)  as input_tokens,
                COALESCE(SUM(output_tokens),0) as output_tokens,
                COALESCE(SUM(total_tokens),0)  as total_tokens,
                COALESCE(SUM(cost_usd),0)      as cost_usd,
                COUNT(*) as requests
         FROM api_calls WHERE ${dateFilter}
         GROUP BY ${timeBucket}, provider ORDER BY hour ASC`,
        currParams
      ),
      pool.query(
        `SELECT COUNT(*) as total_requests,
                COALESCE(SUM(total_tokens),0) as total_tokens,
                COALESCE(SUM(cost_usd),0)     as total_cost_usd,
                COALESCE(AVG(latency_ms),0)   as avg_latency_ms,
                COUNT(*) FILTER (WHERE status_code >= 400) as error_count
         FROM api_calls WHERE ${prevFilter}`,
        prevParams
      ),
      pool.query(
        `SELECT error_type, COUNT(*) as count
         FROM api_calls WHERE ${dateFilter} AND error_type IS NOT NULL
         GROUP BY error_type ORDER BY count DESC`,
        currParams
      ),
    ]);

    res.json({
      summary:         summary.rows[0],
      prev_summary:    prevSummary.rows[0],
      by_model:        byModel.rows,
      by_provider:     byProvider.rows,
      time_series:     timeSeries.rows,
      error_breakdown: errorBreakdown.rows,
    });
  } catch (err) {
    console.error('GET /api/metrics/summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /projection ───────────────────────────────────────────────────────────
router.get('/projection', async (req, res) => {
  try {
    const { orgId } = req.user;
    const now = new Date();
    const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth    = now.getDate();
    const daysRemaining = daysInMonth - dayOfMonth;

    const [monthSpend, weekAvg, credProviders] = await Promise.all([
      pool.query(
        `SELECT provider, COALESCE(SUM(cost_usd), 0) as spent
         FROM api_calls WHERE org_id = $1 AND timestamp >= $2 GROUP BY provider`,
        [orgId, startOfMonth.toISOString()]
      ),
      pool.query(
        `SELECT provider, COALESCE(SUM(cost_usd), 0) / 7.0 as avg_daily
         FROM api_calls WHERE org_id = $1 AND timestamp > NOW() - INTERVAL '7 days' GROUP BY provider`,
        [orgId]
      ),
      pool.query(
        `SELECT DISTINCT provider FROM provider_credentials WHERE org_id = $1`,
        [orgId]
      ),
    ]);

    const providers = credProviders.rows.map(r => r.provider);
    const projection = providers.map(p => {
      const spent    = parseFloat(monthSpend.rows.find(r => r.provider === p)?.spent || 0);
      const avgDaily = parseFloat(weekAvg.rows.find(r => r.provider === p)?.avg_daily || 0);
      return {
        provider: p, spent_this_month: spent, avg_daily: avgDaily,
        days_remaining: daysRemaining, projected_month_total: spent + avgDaily * daysRemaining,
      };
    });

    res.json({ projection, days_in_month: daysInMonth, day_of_month: dayOfMonth });
  } catch (err) {
    console.error('GET /api/metrics/projection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /export — CSV download ────────────────────────────────────────────────
router.get('/export', async (req, res) => {
  try {
    const { orgId } = req.user;
    const range    = req.query.range || '30d';
    const rangeMap = { '24h':'24 hours', '7d':'7 days', '30d':'30 days', '60d':'60 days', '90d':'90 days' };
    const interval = rangeMap[range] || '30 days';
    const startDate= req.query.start;
    const endDate  = req.query.end;
    const provider = req.query.provider;
    const status   = req.query.status;
    const search   = req.query.search?.trim();
    const tagKey   = req.query.tag_key?.trim();
    const tagValue = req.query.tag_value?.trim();

    const params = [orgId];
    let where = 'WHERE org_id = $1';
    if (startDate && endDate) {
      params.push(startDate, endDate);
      where += ` AND timestamp >= $${params.length - 1} AND timestamp <= $${params.length}`;
    } else {
      where += ` AND timestamp > NOW() - INTERVAL '${interval}'`;
    }
    if (provider) { params.push(provider); where += ` AND provider = $${params.length}`; }
    if (status === 'error')   where += ` AND status_code >= 400`;
    if (status === 'success') where += ` AND status_code < 400`;
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (prompt_preview ILIKE $${params.length} OR model ILIKE $${params.length})`;
    }
    if (tagKey && tagValue) {
      params.push(tagKey, tagValue);
      where += ` AND tags->>$${params.length - 1} = $${params.length}`;
    } else if (tagKey) {
      params.push(tagKey);
      where += ` AND tags ? $${params.length}`;
    }

    const result = await pool.query(
      `SELECT id, timestamp, provider, model, input_tokens, output_tokens,
              total_tokens, cost_usd, latency_ms, status_code,
              cache_read_tokens, cache_write_tokens, error_message,
              prompt_preview, tags
       FROM api_calls ${where} ORDER BY timestamp DESC`,
      params
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="llm-metrics-${range}.csv"`);
    const headers = ['id','timestamp','provider','model','input_tokens','output_tokens','total_tokens','cost_usd','latency_ms','status_code','cache_read_tokens','cache_write_tokens','error_message','prompt_preview','tags'];
    res.write(headers.join(',') + '\n');
    for (const row of result.rows) {
      const line = headers.map(h => {
        const val = row[h] ?? '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',');
      res.write(line + '\n');
    }
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /tag-keys — distinct tag keys used by org ─────────────────────────────
router.get('/tag-keys', async (req, res) => {
  try {
    const { orgId } = req.user;
    const range    = req.query.range || '7d';
    const rangeMap = { '24h':'24 hours', '7d':'7 days', '30d':'30 days', '60d':'60 days', '90d':'90 days' };
    const interval = rangeMap[range] || '7 days';
    const result = await pool.query(
      `SELECT DISTINCT jsonb_object_keys(tags) as key
       FROM api_calls
       WHERE org_id = $1 AND tags != '{}'::jsonb
         AND timestamp > NOW() - INTERVAL '${interval}'
       ORDER BY key LIMIT 50`,
      [orgId]
    );
    res.json({ keys: result.rows.map(r => r.key) });
  } catch (err) {
    console.error('GET /api/metrics/tag-keys error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /tag-values — distinct values for a tag key ───────────────────────────
router.get('/tag-values', async (req, res) => {
  try {
    const { orgId } = req.user;
    const key = req.query.key?.trim();
    if (!key) return res.status(400).json({ error: 'key is required' });
    const range    = req.query.range || '7d';
    const rangeMap = { '24h':'24 hours', '7d':'7 days', '30d':'30 days', '60d':'60 days', '90d':'90 days' };
    const interval = rangeMap[range] || '7 days';
    const result = await pool.query(
      `SELECT DISTINCT tags->>$2 as value
       FROM api_calls
       WHERE org_id = $1 AND tags ? $2
         AND timestamp > NOW() - INTERVAL '${interval}'
       ORDER BY value LIMIT 100`,
      [orgId, key]
    );
    res.json({ values: result.rows.map(r => r.value).filter(v => v !== null) });
  } catch (err) {
    console.error('GET /api/metrics/tag-values error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /tag-breakdown — cost/requests grouped by tag value ───────────────────
router.get('/tag-breakdown', async (req, res) => {
  try {
    const { orgId } = req.user;
    const key = req.query.key?.trim();
    if (!key) return res.status(400).json({ error: 'key is required' });
    const range    = req.query.range || '7d';
    const rangeMap = { '24h':'24 hours', '7d':'7 days', '30d':'30 days', '60d':'60 days', '90d':'90 days' };
    const interval = rangeMap[range] || '7 days';
    const result = await pool.query(
      `SELECT tags->>$2 as value,
              COUNT(*) as requests,
              COALESCE(SUM(cost_usd), 0) as total_cost,
              COALESCE(SUM(total_tokens), 0) as total_tokens
       FROM api_calls
       WHERE org_id = $1 AND tags ? $2
         AND timestamp > NOW() - INTERVAL '${interval}'
       GROUP BY value ORDER BY total_cost DESC LIMIT 20`,
      [orgId, key]
    );
    res.json({ key, data: result.rows });
  } catch (err) {
    console.error('GET /api/metrics/tag-breakdown error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /:id — single record ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { orgId } = req.user;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await pool.query(
      'SELECT * FROM api_calls WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
