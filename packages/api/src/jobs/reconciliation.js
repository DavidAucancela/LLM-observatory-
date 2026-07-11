const pool = require('../db/pool');
const { decrypt } = require('../db/crypto');
const { fetchAnthropicUsage, fetchOpenAIUsage, summarizeBuckets } = require('../services/providerUsage');

// Fallback deviation threshold (%) used when an org has reconciliation alerting
// enabled (alert_rules.metric = 'reconciliation_deviation') but didn't set an
// explicit threshold_pct.
const DEFAULT_DEVIATION_THRESHOLD_PCT = 10;

// Scope note: this recomputes cost from the provider's token-USAGE API (same
// endpoints sync.js already uses) + the same local PRICING table the client
// SDKs use — it is NOT a call to a real dollar-denominated billing/costs
// endpoint (neither provider integration in this codebase calls one; see
// services/providerUsage.js). This catches SDK-side cost bugs (bad retry
// accounting, missed error-cost tracking, stale local pricing) — it does NOT
// verify against actual provider billing (promotional credits, cache-discount
// rules, etc. can still diverge). Upgrading to a true billing-API source is a
// separate, larger change (per-provider Costs API integration).
async function sendReconciliationAlert(webhookUrl, provider, providerComputedUsd, clientReportedUsd, deviationPct) {
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
  const payload = {
    embeds: [{
      title: `🔍 Desviación de costo detectada — ${providerLabel}`,
      description: 'El costo reportado por los clientes se desvía del recalculado por Observatory a partir del uso reportado por el proveedor.',
      color: 16744272,
      fields: [
        { name: 'Reportado por clientes',        value: `$${clientReportedUsd.toFixed(4)}`, inline: true },
        { name: 'Recalculado (Observatory)',      value: `$${providerComputedUsd.toFixed(4)}`, inline: true },
        { name: 'Desviación',                     value: `${deviationPct.toFixed(1)}%`, inline: true },
      ],
      footer:    { text: 'LLM Observatory — Reconciliación diaria' },
      timestamp: new Date().toISOString(),
    }],
  };
  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error('[reconciliation] Discord webhook error:', err.message);
    return false;
  }
}

async function reconcileOrgProvider(orgId, provider, apiKey, periodStart, periodEnd) {
  const buckets = provider === 'anthropic'
    ? await fetchAnthropicUsage(apiKey, periodStart, periodEnd)
    : await fetchOpenAIUsage(apiKey, periodStart, periodEnd);

  const { costUsd: providerComputedUsd } = summarizeBuckets(buckets, provider);

  const clientRes = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0) as total FROM api_calls
     WHERE org_id = $1 AND provider = $2 AND timestamp >= $3 AND timestamp < $4`,
    [orgId, provider, periodStart.toISOString(), periodEnd.toISOString()]
  );
  const clientReportedUsd = parseFloat(clientRes.rows[0].total);

  // Guard the denominator so a near-zero-spend day doesn't produce a
  // meaningless triple-digit deviation % from noise (e.g. $0.0001 vs $0.0003).
  const base = Math.max(providerComputedUsd, 0.01);
  const deviationPct = Math.abs(providerComputedUsd - clientReportedUsd) / base * 100;

  return { providerComputedUsd, clientReportedUsd, deviationPct };
}

// Runs daily. Reconciles the trailing 24h for every (org, provider) pair that
// has an admin-level provider credential configured — reconciliation itself
// isn't opt-in (it just records a row), but Discord alerting on top of it is,
// same UX as spend alerts: configure an alert_rules row with
// metric='reconciliation_deviation' to get notified.
async function runReconciliation() {
  try {
    const periodEnd   = new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 1);

    const creds = await pool.query(
      `SELECT DISTINCT ON (org_id, provider) org_id, provider, api_key_encrypted
       FROM provider_credentials WHERE key_type = 'admin'
       ORDER BY org_id, provider, created_at DESC`
    );

    for (const cred of creds.rows) {
      const { org_id: orgId, provider } = cred;
      let result = { providerComputedUsd: 0, clientReportedUsd: 0, deviationPct: 0 };
      let status = 'ok', errorMessage = null;

      try {
        const apiKey = decrypt(cred.api_key_encrypted);
        result = await reconcileOrgProvider(orgId, provider, apiKey, periodStart, periodEnd);
      } catch (err) {
        status = 'error';
        errorMessage = err.message;
        console.error(`[reconciliation] ${provider} org ${orgId} failed:`, err.message);
      }

      if (status === 'ok') {
        const ruleRes = await pool.query(
          `SELECT * FROM alert_rules
           WHERE org_id = $1 AND metric = 'reconciliation_deviation' AND enabled = true
             AND (provider = $2 OR provider = 'all')
           ORDER BY (provider = $2) DESC LIMIT 1`,
          [orgId, provider]
        );
        const rule = ruleRes.rows[0];

        if (rule) {
          const thresholdPct = parseFloat(rule.threshold_pct ?? DEFAULT_DEVIATION_THRESHOLD_PCT);
          if (result.deviationPct > thresholdPct) {
            status = 'alert';
            const debounceOk = !rule.last_triggered_at ||
              (Date.now() - new Date(rule.last_triggered_at).getTime()) / 3600000 >= (parseInt(rule.debounce_hours, 10) || 6);
            if (debounceOk) {
              const success = await sendReconciliationAlert(
                rule.discord_webhook_url, provider,
                result.providerComputedUsd, result.clientReportedUsd, result.deviationPct
              );
              await pool.query(
                `INSERT INTO alert_history (org_id, rule_id, provider, current_value, threshold_usd, success)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [orgId, rule.id, provider, result.deviationPct, thresholdPct, success]
              );
              await pool.query(`UPDATE alert_rules SET last_triggered_at = NOW() WHERE id = $1`, [rule.id]);
            }
          }
        }
      }

      await pool.query(
        `INSERT INTO reconciliation_runs
           (org_id, provider, period_start, period_end, provider_computed_usd, client_reported_usd, deviation_pct, status, error_message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [orgId, provider, periodStart.toISOString(), periodEnd.toISOString(),
         result.providerComputedUsd, result.clientReportedUsd, result.deviationPct, status, errorMessage]
      );

      console.log(`[reconciliation] org ${orgId} ${provider}: client=$${result.clientReportedUsd.toFixed(4)} provider=$${result.providerComputedUsd.toFixed(4)} deviation=${result.deviationPct.toFixed(1)}% status=${status}`);
    }
  } catch (err) {
    console.error('[reconciliation] job error:', err.message);
  }
}

module.exports = { runReconciliation, reconcileOrgProvider };
