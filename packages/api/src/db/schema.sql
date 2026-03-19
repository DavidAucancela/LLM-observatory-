CREATE TABLE IF NOT EXISTS api_calls (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider VARCHAR(50) NOT NULL DEFAULT 'anthropic',
  model VARCHAR(100) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status_code INTEGER NOT NULL DEFAULT 200,
  tools_used JSONB DEFAULT '[]'::jsonb,
  prompt_preview VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS idx_api_calls_timestamp ON api_calls(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_calls_model ON api_calls(model);
CREATE INDEX IF NOT EXISTS idx_api_calls_provider ON api_calls(provider);

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  limit_usd DECIMAL(10, 2) NOT NULL,
  period VARCHAR(20) NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_balances (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  amount_usd DECIMAL(10, 2) NOT NULL,
  note VARCHAR(200),
  recharged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_credentials (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) UNIQUE NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  key_hint VARCHAR(30),
  is_valid BOOLEAN,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature 4: prompt_full column
ALTER TABLE api_calls ADD COLUMN IF NOT EXISTS prompt_full TEXT;

-- Feature 1: Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL DEFAULT 'all',
  metric VARCHAR(50) NOT NULL DEFAULT 'daily_spend',
  threshold_usd DECIMAL(10,2) NOT NULL,
  discord_webhook_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_history (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER REFERENCES alert_rules(id) ON DELETE CASCADE,
  provider VARCHAR(50),
  current_value DECIMAL(10,4),
  threshold_usd DECIMAL(10,2),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN
);

-- Feature 2: Sync logs
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_imported INTEGER DEFAULT 0,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  error_message TEXT
);
