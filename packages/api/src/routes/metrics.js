const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');

const router = express.Router();

const MetricSchema = z.object({
  provider:      z.enum(['anthropic', 'openai']).default('anthropic'),
  model:         z.string().min(1),
  input_tokens:  z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  total_tokens:  z.number().int().min(0),
  cost_usd:      z.number().min(0),
  latency_ms:    z.number().int().min(0),
  status_code:   z.number().int().min(100).max(599),
  tools_used:    z.array(z.string()).default([]),
  prompt_preview:z.string().max(200).optional(),
  tags:          z.record(z.unknown()).optional().default({}),
});

// ── POST / — SDK ingest (public, no auth) ─────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const data = MetricSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO api_calls
         (provider, model, input_tokens, output_tokens, total_tokens,
          cost_usd, latency_ms, status_code, tools_used, prompt_preview, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        data.provider, data.model,
        data.input_tokens, data.output_tokens, data.total_tokens,
        data.cost_usd, data.latency_ms, data.status_code,
        JSON.stringify(data.tools_used),
        data.prompt_preview || null,
        JSON.stringify(data.tags || {}),
      ]
    );
    if (req.app.get('io')) req.app.get('io').emit('new-metric', result.rows[0]);
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
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset  = (page - 1) * limit;
    const model   = req.query.model;
    const provider= req.query.provider;
    const search  = req.query.search?.trim();
    const range   = req.query.range || '7d';
    const sortBy  = ['timestamp','cost_usd','latency_ms','total_tokens'].includes(req.query.sortBy) ? req.query.sortBy : 'timestamp';
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
    const rangeMap= { '24h':'24 hours', '7d':'7 days', '30d':'30 days', '60d':'60 days', '90d':'90 days' };
    const interval= rangeMap[range] || '7 days';
    const startDate = req.query.start;
    const endDate   = req.query.end;

    // Build parameterized WHERE clause
    const params = [];
    let whereClause;
    if (startDate && endDate) {
      params.push(startDate, endDate);
      whereClause = `WHERE timestamp >= $1 AND timestamp <= $2`;
    } else {
      whereClause = `WHERE timestamp > NOW() - INTERVAL '${interval}'`;
    }
    if (model)    { params.push(model);    whereClause += ` AND model = $${params.length}`; }
    if (provider) { params.push(provider); whereClause += ` AND provider = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      whereClause += ` AND (prompt_preview ILIKE $${idx} OR model ILIKE $${idx})`;
    }

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM api_calls ${whereClause}`, params),
      pool.query(
        `SELECT * FROM api_calls ${whereClause} ORDER BY ${sortBy} ${sortDir}
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

// ── GET /summary — aggregated stats + time series + prev period comparison ─────
router.get('/summary', async (req, res) => {
  try {
    const range    = req.query.range || '7d';
    const rangeMap = { '24h':'24 hours', '7d':'7 days', '30d':'30 days', '60d':'60 days', '90d':'90 days' };
    // For doubling the interval to get prev period bounds (server-side, safe)
    const doubleMap= { '24h':'48 hours', '7d':'14 days', '30d':'60 days', '60d':'120 days', '90d':'180 days' };
    const interval  = rangeMap[range] || '7 days';
    const dblInterval = doubleMap[range] || '14 days';
    const startDate = req.query.start;
    const endDate   = req.query.end;
    const useDays   = ['30d','60d','90d'].includes(range) || (startDate && endDate);
    const timeBucket= useDays ? `DATE_TRUNC('day', timestamp)` : `DATE_TRUNC('hour', timestamp)`;

    // Current period — parameterized when using custom dates
    const currParams = [];
    let dateFilter;
    if (startDate && endDate) {
      currParams.push(startDate, endDate);
      dateFilter = `timestamp >= $1 AND timestamp <= $2`;
    } else {
      dateFilter = `timestamp > NOW() - INTERVAL '${interval}'`;
    }

    // Previous period — same duration shifted back
    const prevParams = [];
    let prevFilter;
    if (startDate && endDate) {
      const durationMs = new Date(endDate).getTime() - new Date(startDate).getTime();
      const prevEnd   = new Date(startDate).toISOString();
      const prevStart = new Date(new Date(startDate).getTime() - durationMs).toISOString();
      prevParams.push(prevStart, prevEnd);
      prevFilter = `timestamp >= $1 AND timestamp <= $2`;
    } else {
      prevFilter = `timestamp > NOW() - INTERVAL '${dblInterval}' AND timestamp <= NOW() - INTERVAL '${interval}'`;
    }

    const [summary, byModel, byProvider, timeSeries, prevSummary] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total_requests,
                COALESCE(SUM(total_tokens),0)  as total_tokens,
                COALESCE(SUM(input_tokens),0)  as total_input_tokens,
                COALESCE(SUM(output_tokens),0) as total_output_tokens,
                COALESCE(SUM(cost_usd),0)      as total_cost_usd,
                COALESCE(AVG(latency_ms),0)    as avg_latency_ms,
                COALESCE(AVG(cost_usd),0)      as avg_cost_usd,
                COUNT(*) FILTER (WHERE status_code >= 400) as error_count
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
                COALESCE(AVG(latency_ms),0)   as avg_latency_ms
         FROM api_calls WHERE ${prevFilter}`,
        prevParams
      ),
    ]);

    res.json({
      summary:      summary.rows[0],
      prev_summary: prevSummary.rows[0],
      by_model:     byModel.rows,
      by_provider:  byProvider.rows,
      time_series:  timeSeries.rows,
    });
  } catch (err) {
    console.error('GET /api/metrics/summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /projection ───────────────────────────────────────────────────────────
router.get('/projection', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth   = now.getDate();
    const daysRemaining= daysInMonth - dayOfMonth;

    const [monthSpend, weekAvg] = await Promise.all([
      pool.query(
        `SELECT provider, COALESCE(SUM(cost_usd), 0) as spent
         FROM api_calls WHERE timestamp >= $1 GROUP BY provider`,
        [startOfMonth.toISOString()]
      ),
      pool.query(
        `SELECT provider, COALESCE(SUM(cost_usd), 0) / 7.0 as avg_daily
         FROM api_calls WHERE timestamp > NOW() - INTERVAL '7 days' GROUP BY provider`
      ),
    ]);

    const providers  = ['anthropic', 'openai'];
    const projection = providers.map(p => {
      const spent    = parseFloat(monthSpend.rows.find(r => r.provider === p)?.spent || 0);
      const avgDaily = parseFloat(weekAvg.rows.find(r => r.provider === p)?.avg_daily || 0);
      return { provider: p, spent_this_month: spent, avg_daily: avgDaily, days_remaining: daysRemaining, projected_month_total: spent + avgDaily * daysRemaining };
    });

    res.json({ projection, days_in_month: daysInMonth, day_of_month: dayOfMonth });
  } catch (err) {
    console.error('GET /api/metrics/projection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /export — CSV download (must be before /:id) ─────────────────────────
router.get('/export', async (req, res) => {
  try {
    const range    = req.query.range || '30d';
    const rangeMap = { '24h':'24 hours', '7d':'7 days', '30d':'30 days', '60d':'60 days', '90d':'90 days' };
    const interval = rangeMap[range] || '30 days';
    const startDate= req.query.start;
    const endDate  = req.query.end;

    const params = [];
    let whereClause;
    if (startDate && endDate) {
      params.push(startDate, endDate);
      whereClause = `WHERE timestamp >= $1 AND timestamp <= $2`;
    } else {
      whereClause = `WHERE timestamp > NOW() - INTERVAL '${interval}'`;
    }

    const result = await pool.query(
      `SELECT id, timestamp, provider, model, input_tokens, output_tokens,
              total_tokens, cost_usd, latency_ms, status_code, prompt_preview, tags
       FROM api_calls ${whereClause} ORDER BY timestamp DESC`,
      params
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="llm-metrics-${range}.csv"`);
    const headers = ['id','timestamp','provider','model','input_tokens','output_tokens','total_tokens','cost_usd','latency_ms','status_code','prompt_preview','tags'];
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

// ── GET /:id — single record (must be after named routes) ────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await pool.query('SELECT * FROM api_calls WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
