const crypto = require('crypto');
const pool   = require('../db/pool');

async function deliverWebhooks(orgId, event, data) {
  let rows;
  try {
    ({ rows } = await pool.query(
      `SELECT id, url, secret FROM webhook_endpoints
       WHERE org_id = $1 AND is_active = true`,
      [orgId]
    ));
  } catch {
    return;
  }

  for (const wh of rows) {
    const payload = JSON.stringify({ event, timestamp: new Date().toISOString(), data });
    const sig     = 'sha256=' + crypto.createHmac('sha256', wh.secret).update(payload).digest('hex');

    const send = () => fetch(wh.url, {
      method: 'POST',
      headers: {
        'Content-Type':            'application/json',
        'X-Observatory-Signature': sig,
        'X-Observatory-Event':     event,
      },
      body:   payload,
      signal: AbortSignal.timeout(5000),
    });

    send().catch(() =>
      new Promise(r => setTimeout(r, 1000)).then(send).catch(() => {})
    );
  }
}

module.exports = { deliverWebhooks };
