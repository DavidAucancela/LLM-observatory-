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

async function checkAlerts() {
  try {
    const rules = await pool.query('SELECT * FROM alert_rules WHERE enabled = true');
    if (!rules.rows.length) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const spending = await pool.query(
      `SELECT provider, COALESCE(SUM(cost_usd), 0) as daily_spend
       FROM api_calls WHERE timestamp >= $1 GROUP BY provider`,
      [today.toISOString()]
    );

    const spendMap = {};
    for (const row of spending.rows) spendMap[row.provider] = parseFloat(row.daily_spend);
    const totalSpend = Object.values(spendMap).reduce((a, b) => a + b, 0);

    for (const rule of rules.rows) {
      const current = rule.provider === 'all' ? totalSpend : (spendMap[rule.provider] || 0);
      const threshold = parseFloat(rule.threshold_usd);

      if (current < threshold) continue;

      // Don't re-trigger within debounce window (configurable per rule, default 6h)
      if (rule.last_triggered_at) {
        const lastTriggered = new Date(rule.last_triggered_at);
        const hoursSince = (Date.now() - lastTriggered.getTime()) / 3600000;
        const debounce = parseInt(rule.debounce_hours, 10) || 6;
        if (hoursSince < debounce) continue;
      }

      const success = await sendDiscordAlert(rule.discord_webhook_url, rule.provider, current, threshold);

      await pool.query(
        `INSERT INTO alert_history (rule_id, provider, current_value, threshold_usd, success) VALUES ($1, $2, $3, $4, $5)`,
        [rule.id, rule.provider, current, threshold, success]
      );
      await pool.query(`UPDATE alert_rules SET last_triggered_at = NOW() WHERE id = $1`, [rule.id]);

      console.log(`Alert fired for rule ${rule.id} (${rule.provider}): $${current.toFixed(4)} > $${threshold}`);
    }
  } catch (err) {
    console.error('Alert checker error:', err.message);
  }
}

module.exports = { checkAlerts, sendDiscordAlert };
