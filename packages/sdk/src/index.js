const Anthropic = require('@anthropic-ai/sdk');

// Cost per million tokens (USD) — April 2026
const ANTHROPIC_PRICING = {
  'claude-opus-4-6':             { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':           { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001':   { input:  0.80, output:  4.00 },
  'claude-3-5-sonnet-20241022':  { input:  3.00, output: 15.00 },
  'claude-3-5-haiku-20241022':   { input:  0.80, output:  4.00 },
  'claude-3-opus-20240229':      { input: 15.00, output: 75.00 },
  'claude-3-haiku-20240307':     { input:  0.25, output:  1.25 },
};

const OPENAI_PRICING = {
  'gpt-4o':        { input:  2.50, output: 10.00 },
  'gpt-4o-mini':   { input:  0.15, output:  0.60 },
  'gpt-4-turbo':   { input: 10.00, output: 30.00 },
  'gpt-4':         { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input:  0.50, output:  1.50 },
  'o1':            { input: 15.00, output: 60.00 },
  'o1-mini':       { input:  3.00, output: 12.00 },
  'o3-mini':       { input:  1.10, output:  4.40 },
  'o3':            { input: 10.00, output: 40.00 },
};

function maskKey(key) {
  if (!key || key.length < 12) return null;
  return key.substring(0, 8) + '…' + key.slice(-4);
}

function calculateCost(model, inputTokens, outputTokens) {
  const pricing = ANTHROPIC_PRICING[model];
  if (!pricing) {
    console.warn(`[LLM Observatory] Unknown Anthropic model pricing: "${model}" — cost recorded as $0`);
    return 0;
  }
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

function calculateOpenAICost(model, inputTokens, outputTokens) {
  const pricing = OPENAI_PRICING[model];
  if (!pricing) {
    console.warn(`[LLM Observatory] Unknown OpenAI model pricing: "${model}" — cost recorded as $0`);
    return 0;
  }
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

class MonitoredAnthropic {
  constructor(options = {}) {
    const { observatoryUrl = 'http://localhost:3001', apiKey, tags = {}, ...anthropicOptions } = options;
    this.observatoryUrl = observatoryUrl;
    this.tags = tags;
    this.apiKeyHint = maskKey(apiKey || anthropicOptions.apiKey || process.env.ANTHROPIC_API_KEY);
    this.client = new Anthropic({ apiKey, ...anthropicOptions });
    this.messages = this._buildMessagesProxy();
  }

  _buildMessagesProxy() {
    const self = this;
    return {
      create: async (params) => {
        const startTime = Date.now();
        const promptPreview = typeof params.messages?.[0]?.content === 'string'
          ? params.messages[0].content.substring(0, 200)
          : JSON.stringify(params.messages?.[0]?.content || '').substring(0, 200);
        const tools = params.tools?.map(t => t.name) || [];

        // Streaming path — capture usage from finalMessage() after caller consumes stream
        if (params.stream) {
          let stream;
          try {
            stream = await self.client.messages.create(params);
          } catch (err) {
            self._sendMetric({
              model: params.model, input_tokens: 0, output_tokens: 0, total_tokens: 0,
              cost_usd: 0, latency_ms: Date.now() - startTime, status_code: err.status || 500,
              tools_used: tools, prompt_preview: promptPreview, tags: self.tags,
              api_key_hint: self.apiKeyHint,
            }).catch(() => {});
            throw err;
          }

          stream.finalMessage().then(finalMsg => {
            const inputTokens  = finalMsg.usage?.input_tokens  || 0;
            const outputTokens = finalMsg.usage?.output_tokens || 0;
            self._sendMetric({
              model: params.model,
              input_tokens: inputTokens, output_tokens: outputTokens,
              total_tokens: inputTokens + outputTokens,
              cost_usd: calculateCost(params.model, inputTokens, outputTokens),
              latency_ms: Date.now() - startTime, status_code: 200,
              tools_used: tools, prompt_preview: promptPreview, tags: self.tags,
              api_key_hint: self.apiKeyHint,
            }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));
          }).catch(err => console.warn('[LLM Observatory] Streaming metric capture failed:', err.message));

          return stream;
        }

        // Non-streaming path
        let response;
        let statusCode = 200;
        let error = null;

        try {
          response = await self.client.messages.create(params);
        } catch (err) {
          statusCode = err.status || 500;
          error = err;
        }

        const inputTokens  = response?.usage?.input_tokens  || 0;
        const outputTokens = response?.usage?.output_tokens || 0;

        self._sendMetric({
          model: params.model,
          input_tokens: inputTokens, output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
          cost_usd: calculateCost(params.model, inputTokens, outputTokens),
          latency_ms: Date.now() - startTime, status_code: statusCode,
          tools_used: tools, prompt_preview: promptPreview, tags: self.tags,
          api_key_hint: self.apiKeyHint,
        }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));

        if (error) throw error;
        return response;
      }
    };
  }

  async _sendMetric(data) {
    await fetch(`${this.observatoryUrl}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000)
    });
  }
}

class MonitoredOpenAI {
  constructor(options = {}) {
    const { observatoryUrl = 'http://localhost:3001', apiKey, tags = {}, ...openaiOptions } = options;
    this.observatoryUrl = observatoryUrl;
    this.tags = tags;
    this.apiKeyHint = maskKey(apiKey || openaiOptions.apiKey || process.env.OPENAI_API_KEY);
    const OpenAI = require('openai');
    this.client = new OpenAI({ apiKey, ...openaiOptions });
    this.chat = { completions: { create: this._createCompletion.bind(this) } };
  }

  async _createCompletion(params) {
    const startTime = Date.now();
    const firstMsg = params.messages?.[0];
    const promptPreview = typeof firstMsg?.content === 'string'
      ? firstMsg.content.substring(0, 200)
      : JSON.stringify(firstMsg?.content || '').substring(0, 200);
    const tools = params.tools?.map(t => t.function?.name || t.name) || [];

    // Streaming path — wrap the async iterable to capture the final usage chunk
    if (params.stream) {
      let stream;
      try {
        // include_usage ensures the final chunk carries token counts
        const streamParams = { ...params, stream_options: { include_usage: true, ...params.stream_options } };
        stream = await this.client.chat.completions.create(streamParams);
      } catch (err) {
        this._sendMetric({
          provider: 'openai', model: params.model, input_tokens: 0, output_tokens: 0,
          total_tokens: 0, cost_usd: 0, latency_ms: Date.now() - startTime,
          status_code: err.status || 500, tools_used: tools, prompt_preview: promptPreview, tags: this.tags,
          api_key_hint: this.apiKeyHint,
        }).catch(() => {});
        throw err;
      }

      return this._wrapOpenAIStream(stream, startTime, params, tools, promptPreview);
    }

    // Non-streaming path
    let response;
    let statusCode = 200;
    let error = null;

    try {
      response = await this.client.chat.completions.create(params);
    } catch (err) {
      statusCode = err.status || 500;
      error = err;
    }

    const inputTokens  = response?.usage?.prompt_tokens     || 0;
    const outputTokens = response?.usage?.completion_tokens || 0;

    this._sendMetric({
      provider: 'openai', model: params.model,
      input_tokens: inputTokens, output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost_usd: calculateOpenAICost(params.model, inputTokens, outputTokens),
      latency_ms: Date.now() - startTime, status_code: statusCode,
      tools_used: tools, prompt_preview: promptPreview, tags: this.tags,
      api_key_hint: this.apiKeyHint,
    }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));

    if (error) throw error;
    return response;
  }

  async* _wrapOpenAIStream(stream, startTime, params, tools, promptPreview) {
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      for await (const chunk of stream) {
        if (chunk.usage) {
          inputTokens  = chunk.usage.prompt_tokens     || 0;
          outputTokens = chunk.usage.completion_tokens || 0;
        }
        yield chunk;
      }
    } finally {
      this._sendMetric({
        provider: 'openai', model: params.model,
        input_tokens: inputTokens, output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        cost_usd: calculateOpenAICost(params.model, inputTokens, outputTokens),
        latency_ms: Date.now() - startTime, status_code: 200,
        tools_used: tools, prompt_preview: promptPreview, tags: this.tags,
        api_key_hint: this.apiKeyHint,
      }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));
    }
  }

  async _sendMetric(data) {
    await fetch(`${this.observatoryUrl}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000)
    });
  }
}

module.exports = {
  MonitoredAnthropic,
  MonitoredOpenAI,
  calculateCost,
  calculateOpenAICost,
  ANTHROPIC_PRICING,
  OPENAI_PRICING
};
