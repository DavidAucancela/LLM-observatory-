const pool = require('../db/pool');

async function sendDiscordAlert(webhookUrl, provider, currentValue, thresholdUsd, isTest = false) {
  const providerLabel = provider === 'all' ? 'Total' : provider.charAt(0).toUpperCase() + provider.slice(1);
  const pct = ((currentValue / thresholdUsd) * 100).toFixed(1);
  const color = isTest ? 3447003 : (currentValue >= thresholdUsd * 1.1 ? 15158332 : 16744272);

  const payload = {
    embeds: [{
      title: isTest ? '🧪 Alerta de prueba — LLM Observatory' : `⚠️ Alerta de gasto — ${providerLabel}`,
      description: isTest
        ? 'Esta es una alerta de prueba. Tu webhook de Discord funciona correctamente.'
        : `El gasto diario de **${providerLabel}** superó el límite configurado.`,
      color,
      fields: [
        { name: 'Gasto actual', value: `$${currentValue.toFixed(4)}`, inline: true },
        { name: 'Límite', value: `$${thresholdUsd.toFixed(2)}`, inline: true },
        { name: '% usado', value: `${pct}%`, inline: true }
      ],
      footer: { text: 'LLM Observatory' },
      timestamp: new Date().toISOString()
    }]
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    console.error('Discord webhook error:', err.message);
    return false;
  }
}

function getSpendInterval(metric) {
  switch (metric) {
    case 'weekly_spend':  return `timestamp > NOW() - INTERVAL '7 days'`;
    case 'monthly_spend': return `DATE_TRUNC('month', timestamp) = DATE_TRUNC('month', NOW())`;
    default:              return `timestamp >= CURRENT_DATE`; // daily_spend
  }
}

async function checkAlerts() {
  try {
    const rules = await pool.query('SELECT * FROM alert_rules WHERE enabled = true');
    if (!rules.rows.length) return;

    // Group rules by metric type to batch DB queries
    const metricTypes = [...new Set(rules.rows.map(r => r.metric || 'daily_spend'))];

    // For each metric type, fetch spend per provider
    const spendByMetric = {};
    for (const metric of metricTypes) {
      const interval = getSpendInterval(metric);
      const result = await pool.query(
        `SELECT provider, COALESCE(SUM(cost_usd), 0) as spend
         FROM api_calls WHERE ${interval} GROUP BY provider`
      );
      const map = {};
      for (const row of result.rows) map[row.provider] = parseFloat(row.spend);
      map._total = Object.values(map).reduce((a, b) => a + b, 0);
      spendByMetric[metric] = map;
    }

    for (const rule of rules.rows) {
      const metric  = rule.metric || 'daily_spend';
      const spendMap = spendByMetric[metric] || {};
      const current  = rule.provider === 'all' ? (spendMap._total || 0) : (spendMap[rule.provider] || 0);
      const threshold = parseFloat(rule.threshold_usd);

      if (current < threshold) continue;

      // Don't re-trigger within debounce window (configurable per rule, default 6h)
      if (rule.last_triggered_at) {
        const hoursSince = (Date.now() - new Date(rule.last_triggered_at).getTime()) / 3600000;
        const debounce = parseInt(rule.debounce_hours, 10) || 6;
        if (hoursSince < debounce) continue;
      }

      const success = await sendDiscordAlert(rule.discord_webhook_url, rule.provider, current, threshold);

      await pool.query(
        `INSERT INTO alert_history (rule_id, provider, current_value, threshold_usd, success) VALUES ($1, $2, $3, $4, $5)`,
        [rule.id, rule.provider, current, threshold, success]
      );
      await pool.query(`UPDATE alert_rules SET last_triggered_at = NOW() WHERE id = $1`, [rule.id]);

      console.log(`Alert fired for rule ${rule.id} (${rule.provider}, ${metric}): $${current.toFixed(4)} > $${threshold}`);
    }
  } catch (err) {
    console.error('Alert checker error:', err.message);
  }
}

module.exports = { checkAlerts, sendDiscordAlert };
