const Anthropic = require('@anthropic-ai/sdk');

// Cost per million tokens (USD) - as of 2025
const MODEL_PRICING = {
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'default': { input: 3.0, output: 15.0 }
};

function calculateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

class MonitoredAnthropic {
  constructor(options = {}) {
    const { observatoryUrl = 'http://localhost:3001', apiKey, ...anthropicOptions } = options;
    this.observatoryUrl = observatoryUrl;
    this.client = new Anthropic({ apiKey, ...anthropicOptions });
    this.messages = this._buildMessagesProxy();
  }

  _buildMessagesProxy() {
    const self = this;
    return {
      create: async (params) => {
        const startTime = Date.now();
        let response;
        let statusCode = 200;
        let error = null;

        try {
          response = await self.client.messages.create(params);
        } catch (err) {
          statusCode = err.status || 500;
          error = err;
        }

        const latencyMs = Date.now() - startTime;

        const inputTokens = response?.usage?.input_tokens || 0;
        const outputTokens = response?.usage?.output_tokens || 0;
        const totalTokens = inputTokens + outputTokens;
        const costUsd = calculateCost(params.model, inputTokens, outputTokens);

        const tools = params.tools?.map(t => t.name) || [];
        const promptPreview = typeof params.messages?.[0]?.content === 'string'
          ? params.messages[0].content.substring(0, 200)
          : JSON.stringify(params.messages?.[0]?.content || '').substring(0, 200);

        // Fire and forget - don't block caller
        self._sendMetric({
          model: params.model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          cost_usd: costUsd,
          latency_ms: latencyMs,
          status_code: statusCode,
          tools_used: tools,
          prompt_preview: promptPreview
        }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));

        if (error) throw error;
        return response;
      }
    };
  }

  async _sendMetric(data) {
    const fetch = (await import('node-fetch')).default;
    await fetch(`${this.observatoryUrl}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000)
    });
  }
}

const OPENAI_PRICING = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'o1': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 1.1, output: 4.4 },
  'o3-mini': { input: 1.1, output: 4.4 },
  'default': { input: 2.5, output: 10.0 }
};

function calculateOpenAICost(model, inputTokens, outputTokens) {
  const pricing = OPENAI_PRICING[model] || OPENAI_PRICING['default'];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

class MonitoredOpenAI {
  constructor(options = {}) {
    const { observatoryUrl = 'http://localhost:3001', apiKey, ...openaiOptions } = options;
    this.observatoryUrl = observatoryUrl;
    // Lazy-load openai to avoid hard dependency
    const OpenAI = require('openai');
    this.client = new OpenAI({ apiKey, ...openaiOptions });
    this.chat = { completions: { create: this._createCompletion.bind(this) } };
  }

  async _createCompletion(params) {
    const startTime = Date.now();
    let response;
    let statusCode = 200;
    let error = null;

    try {
      response = await this.client.chat.completions.create(params);
    } catch (err) {
      statusCode = err.status || 500;
      error = err;
    }

    const latencyMs = Date.now() - startTime;
    const inputTokens = response?.usage?.prompt_tokens || 0;
    const outputTokens = response?.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const costUsd = calculateOpenAICost(params.model, inputTokens, outputTokens);

    const firstMsg = params.messages?.[0];
    const promptPreview = typeof firstMsg?.content === 'string'
      ? firstMsg.content.substring(0, 200)
      : JSON.stringify(firstMsg?.content || '').substring(0, 200);

    this._sendMetric({
      provider: 'openai',
      model: params.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      status_code: statusCode,
      tools_used: params.tools?.map(t => t.function?.name || t.name) || [],
      prompt_preview: promptPreview
    }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));

    if (error) throw error;
    return response;
  }

  async _sendMetric(data) {
    const fetch = (await import('node-fetch')).default;
    await fetch(`${this.observatoryUrl}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000)
    });
  }
}

module.exports = { MonitoredAnthropic, MonitoredOpenAI, calculateCost, calculateOpenAICost, MODEL_PRICING, OPENAI_PRICING };
