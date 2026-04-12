-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  SERIAL PRIMARY KEY,
  email               VARCHAR(255) NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  role                VARCHAR(20)  NOT NULL DEFAULT 'admin',
  is_active           BOOLEAN      NOT NULL DEFAULT false,
  activation_token    TEXT,
  reset_token         TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_reset      ON users(reset_token)        WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_activation ON users(activation_token)   WHERE activation_token IS NOT NULL;

-- ── api_calls ──────────────────────────────────────────────────────────────────
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
  prompt_preview VARCHAR(200),
  prompt_full TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_calls_timestamp ON api_calls(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_calls_model ON api_calls(model);
CREATE INDEX IF NOT EXISTS idx_api_calls_provider ON api_calls(provider);
-- Composite index for the summary/filter queries (timestamp + provider + model)
CREATE INDEX IF NOT EXISTS idx_api_calls_filter ON api_calls(timestamp DESC, provider, model);

-- ── budgets ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  limit_usd DECIMAL(10, 2) NOT NULL,
  period VARCHAR(20) NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_balances ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_balances (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  amount_usd DECIMAL(10, 2) NOT NULL,
  note VARCHAR(200),
  recharged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── provider_credentials ───────────────────────────────────────────────────────
-- Supports multiple keys per provider, separated by key_type: 'sdk' or 'admin'
CREATE TABLE IF NOT EXISTS provider_credentials (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  key_type VARCHAR(10) NOT NULL DEFAULT 'sdk',
  label VARCHAR(100),
  api_key_encrypted TEXT NOT NULL,
  key_hint VARCHAR(30),
  is_valid BOOLEAN,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop the old single-provider unique constraint if it exists (migration from v1)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provider_credentials_provider_key'
    AND conrelid = 'provider_credentials'::regclass
  ) THEN
    ALTER TABLE provider_credentials DROP CONSTRAINT provider_credentials_provider_key;
  END IF;
END $$;

-- Add new columns to existing tables (idempotent migrations)
ALTER TABLE provider_credentials ADD COLUMN IF NOT EXISTS key_type VARCHAR(10) NOT NULL DEFAULT 'sdk';
ALTER TABLE provider_credentials ADD COLUMN IF NOT EXISTS label VARCHAR(100);

-- ── alert_rules ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_rules (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL DEFAULT 'all',
  metric VARCHAR(50) NOT NULL DEFAULT 'daily_spend',
  threshold_usd DECIMAL(10,2) NOT NULL,
  discord_webhook_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  debounce_hours INTEGER NOT NULL DEFAULT 6,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add debounce_hours to existing installations
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS debounce_hours INTEGER NOT NULL DEFAULT 6;

CREATE TABLE IF NOT EXISTS alert_history (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER REFERENCES alert_rules(id) ON DELETE CASCADE,
  provider VARCHAR(50),
  current_value DECIMAL(10,4),
  threshold_usd DECIMAL(10,2),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN
);

-- ── sync_logs ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Add missing columns to sync_logs if upgrading from older schema
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS records_synced INTEGER DEFAULT 0;
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS date_range_start TIMESTAMPTZ;
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS date_range_end TIMESTAMPTZ;

-- ── tags on api_calls (project/env metadata from SDK) ─────────────────────────
ALTER TABLE api_calls ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '{}'::jsonb;
