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
  'gpt-4.1':       { input:  2.00, output:  8.00 },
  'gpt-4.1-mini':  { input:  0.40, output:  1.60 },
  'gpt-4.1-nano':  { input:  0.10, output:  0.40 },
};

// Embeddings: price per million input tokens
const OPENAI_EMBEDDINGS_PRICING = {
  'text-embedding-3-small': 0.02,
  'text-embedding-3-large': 0.13,
  'text-embedding-ada-002': 0.10,
};

// Whisper: price per minute of audio
const OPENAI_WHISPER_PRICE_PER_MINUTE = 0.006;

// TTS: price per million characters
const OPENAI_TTS_PRICING = {
  'tts-1':          15.00,
  'tts-1-hd':       30.00,
  'gpt-4o-mini-tts': 15.00,
};

async function _postMetric(url, data, token) {
  const body    = JSON.stringify(data);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) });
  } catch (firstErr) {
    // One retry after 1 s — still inside fire-and-forget, never blocks the caller
    await new Promise(r => setTimeout(r, 1000));
    await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) });
  }
}

function maskKey(key) {
  if (!key || key.length < 12) return null;
  return key.substring(0, 8) + '…' + key.slice(-4);
}

function classifyError(err) {
  if (!err) return {};
  const status = err.status || err.statusCode || 500;
  let error_type;
  if (status === 401 || status === 403)    error_type = 'auth_error';
  else if (status === 429)                 error_type = 'rate_limit';
  else if (status === 400)                 error_type = 'invalid_request';
  else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') error_type = 'network_error';
  else if (err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT') error_type = 'timeout';
  else if (status >= 500)                  error_type = 'server_error';
  else                                     error_type = 'unknown_error';
  return {
    error_type,
    error_message: (err.message || String(err)).substring(0, 500),
  };
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

function calculateOpenAIEmbeddingCost(model, inputTokens) {
  const price = OPENAI_EMBEDDINGS_PRICING[model];
  if (!price) {
    console.warn(`[LLM Observatory] Unknown embedding model pricing: "${model}" — cost recorded as $0`);
    return 0;
  }
  return (inputTokens / 1_000_000) * price;
}

function calculateWhisperCost(durationSeconds) {
  return (durationSeconds / 60) * OPENAI_WHISPER_PRICE_PER_MINUTE;
}

function calculateTTSCost(model, characterCount) {
  const price = OPENAI_TTS_PRICING[model];
  if (!price) {
    console.warn(`[LLM Observatory] Unknown TTS model pricing: "${model}" — cost recorded as $0`);
    return 0;
  }
  return (characterCount / 1_000_000) * price;
}

class MonitoredAnthropic {
  constructor(options = {}) {
    const { observatoryUrl = 'http://localhost:3001', observatoryToken, apiKey, tags = {}, ...anthropicOptions } = options;
    this.observatoryUrl   = observatoryUrl;
    this.observatoryToken = observatoryToken;
    this.tags      = tags;
    this.apiKeyHint = maskKey(apiKey || anthropicOptions.apiKey || process.env.ANTHROPIC_API_KEY);
    this.client    = new Anthropic({ apiKey, ...anthropicOptions });
    this.messages  = this._buildMessagesProxy();
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
              cache_read_tokens: 0, cache_write_tokens: 0, error_message: err.message || null,
              tools_used: tools, prompt_preview: promptPreview, tags: self.tags,
              api_key_hint: self.apiKeyHint, ...classifyError(err),
            }).catch(() => {});
            throw err;
          }

          stream.finalMessage().then(finalMsg => {
            const inputTokens  = finalMsg.usage?.input_tokens  || 0;
            const outputTokens = finalMsg.usage?.output_tokens || 0;
            const cacheReadTokens  = finalMsg.usage?.cache_read_input_tokens    || 0;
            const cacheWriteTokens = finalMsg.usage?.cache_creation_input_tokens || 0;
            self._sendMetric({
              model: params.model,
              input_tokens: inputTokens, output_tokens: outputTokens,
              total_tokens: inputTokens + outputTokens,
              cost_usd: calculateCost(params.model, inputTokens, outputTokens),
              latency_ms: Date.now() - startTime, status_code: 200,
              cache_read_tokens: cacheReadTokens, cache_write_tokens: cacheWriteTokens,
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

        const inputTokens      = response?.usage?.input_tokens               || 0;
        const outputTokens     = response?.usage?.output_tokens              || 0;
        const cacheReadTokens  = response?.usage?.cache_read_input_tokens    || 0;
        const cacheWriteTokens = response?.usage?.cache_creation_input_tokens || 0;

        self._sendMetric({
          model: params.model,
          input_tokens: inputTokens, output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
          cost_usd: calculateCost(params.model, inputTokens, outputTokens),
          latency_ms: Date.now() - startTime, status_code: statusCode,
          cache_read_tokens: cacheReadTokens, cache_write_tokens: cacheWriteTokens,
          error_message: error ? (error.message || null) : null,
          tools_used: tools, prompt_preview: promptPreview, tags: self.tags,
          api_key_hint: self.apiKeyHint, ...(error ? classifyError(error) : {}),
        }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));

        if (error) throw error;
        return response;
      }
    };
  }

  async _sendMetric(data) {
    await _postMetric(`${this.observatoryUrl}/api/metrics`, data, this.observatoryToken);
  }
}

class MonitoredOpenAI {
  constructor(options = {}) {
    const { observatoryUrl = 'http://localhost:3001', observatoryToken, apiKey, tags = {}, ...openaiOptions } = options;
    this.observatoryUrl   = observatoryUrl;
    this.observatoryToken = observatoryToken;
    this.tags      = tags;
    this.apiKeyHint = maskKey(apiKey || openaiOptions.apiKey || process.env.OPENAI_API_KEY);
    const OpenAI = require('openai');
    this.client = new OpenAI({ apiKey, ...openaiOptions });
    this.chat = { completions: { create: this._createCompletion.bind(this) } };
    this.embeddings = { create: this._createEmbedding.bind(this) };
    this.audio = {
      transcriptions: { create: this._createTranscription.bind(this) },
      speech:         { create: this._createSpeech.bind(this) },
    };
    this.responses = { create: this._createResponse.bind(this) };
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
          api_key_hint: this.apiKeyHint, ...classifyError(err),
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

    const inputTokens      = response?.usage?.prompt_tokens                          || 0;
    const outputTokens     = response?.usage?.completion_tokens                      || 0;
    const cacheReadTokens  = response?.usage?.prompt_tokens_details?.cached_tokens   || 0;

    this._sendMetric({
      provider: 'openai', model: params.model,
      input_tokens: inputTokens, output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost_usd: calculateOpenAICost(params.model, inputTokens, outputTokens),
      latency_ms: Date.now() - startTime, status_code: statusCode,
      cache_read_tokens: cacheReadTokens, cache_write_tokens: 0,
      error_message: error ? (error.message || null) : null,
      tools_used: tools, prompt_preview: promptPreview, tags: this.tags,
      api_key_hint: this.apiKeyHint, ...(error ? classifyError(error) : {}),
    }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));

    if (error) throw error;
    return response;
  }

  async* _wrapOpenAIStream(stream, startTime, params, tools, promptPreview) {
    let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0;
    try {
      for await (const chunk of stream) {
        if (chunk.usage) {
          inputTokens     = chunk.usage.prompt_tokens                        || 0;
          outputTokens    = chunk.usage.completion_tokens                    || 0;
          cacheReadTokens = chunk.usage.prompt_tokens_details?.cached_tokens || 0;
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
        cache_read_tokens: cacheReadTokens, cache_write_tokens: 0,
        tools_used: tools, prompt_preview: promptPreview, tags: this.tags,
        api_key_hint: this.apiKeyHint,
      }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));
    }
  }

  async _createEmbedding(params) {
    const startTime = Date.now();
    const inputPreview = Array.isArray(params.input)
      ? `[${params.input.length} input(s)] ${String(params.input[0]).substring(0, 150)}`
      : String(params.input).substring(0, 200);

    let response, statusCode = 200, error = null;
    try {
      response = await this.client.embeddings.create(params);
    } catch (err) {
      statusCode = err.status || 500;
      error = err;
    }

    const inputTokens = response?.usage?.prompt_tokens || 0;
    this._sendMetric({
      provider: 'openai', model: params.model,
      input_tokens: inputTokens, output_tokens: 0, total_tokens: inputTokens,
      cost_usd: calculateOpenAIEmbeddingCost(params.model, inputTokens),
      latency_ms: Date.now() - startTime, status_code: statusCode,
      tools_used: [], prompt_preview: inputPreview,
      tags: this.tags, api_key_hint: this.apiKeyHint, ...(error ? classifyError(error) : {}),
    }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));

    if (error) throw error;
    return response;
  }

  async _createTranscription(params) {
    const startTime = Date.now();
    const originalFormat = params.response_format;
    const canGetDuration = !originalFormat || ['json', 'verbose_json', 'text'].includes(originalFormat);

    let response, statusCode = 200, error = null;
    try {
      // Force verbose_json internally to capture duration for accurate cost tracking.
      // srt/vtt formats can't be reconstructed from verbose_json, so they skip duration.
      const callParams = canGetDuration ? { ...params, response_format: 'verbose_json' } : params;
      response = await this.client.audio.transcriptions.create(callParams);
    } catch (err) {
      statusCode = err.status || 500;
      error = err;
    }

    const durationSeconds = response?.duration || 0;
    const transcribedText = typeof response === 'string' ? response : (response?.text || '');
    const preview = durationSeconds
      ? `audio transcription · ${Math.floor(durationSeconds / 60)}m ${Math.round(durationSeconds % 60)}s`
      : 'audio transcription';

    this._sendMetric({
      provider: 'openai', model: params.model || 'whisper-1',
      input_tokens: Math.round(durationSeconds), output_tokens: transcribedText.length,
      total_tokens: Math.round(durationSeconds),
      cost_usd: calculateWhisperCost(durationSeconds),
      latency_ms: Date.now() - startTime, status_code: statusCode,
      tools_used: [], prompt_preview: preview,
      tags: this.tags, api_key_hint: this.apiKeyHint, ...(error ? classifyError(error) : {}),
    }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));

    if (error) throw error;

    // Return in the format the user originally requested
    if (!canGetDuration) return response; // srt / vtt — already in correct format
    if (!originalFormat || originalFormat === 'json') return { text: response.text };
    if (originalFormat === 'text') return response.text;
    return response; // verbose_json
  }

  async _createSpeech(params) {
    const startTime = Date.now();
    const charCount = (params.input || '').length;

    let response, statusCode = 200, error = null;
    try {
      response = await this.client.audio.speech.create(params);
    } catch (err) {
      statusCode = err.status || 500;
      error = err;
    }

    this._sendMetric({
      provider: 'openai', model: params.model || 'tts-1',
      input_tokens: charCount, output_tokens: 0, total_tokens: charCount,
      cost_usd: calculateTTSCost(params.model || 'tts-1', charCount),
      latency_ms: Date.now() - startTime, status_code: statusCode,
      tools_used: [],
      prompt_preview: `[TTS ${params.voice || ''}] ${(params.input || '').substring(0, 170)}`,
      tags: this.tags, api_key_hint: this.apiKeyHint, ...(error ? classifyError(error) : {}),
    }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));

    if (error) throw error;
    return response;
  }

  async _createResponse(params) {
    const startTime = Date.now();
    const inputPreview = typeof params.input === 'string'
      ? params.input.substring(0, 200)
      : JSON.stringify(params.input?.[0] || '').substring(0, 200);

    if (params.stream) {
      let stream;
      try {
        stream = await this.client.responses.create(params);
      } catch (err) {
        this._sendMetric({
          provider: 'openai', model: params.model, input_tokens: 0, output_tokens: 0,
          total_tokens: 0, cost_usd: 0, latency_ms: Date.now() - startTime,
          status_code: err.status || 500, tools_used: [], prompt_preview: inputPreview,
          tags: this.tags, api_key_hint: this.apiKeyHint, ...classifyError(err),
        }).catch(() => {});
        throw err;
      }
      return this._wrapResponsesStream(stream, startTime, params, inputPreview);
    }

    let response, statusCode = 200, error = null;
    try {
      response = await this.client.responses.create(params);
    } catch (err) {
      statusCode = err.status || 500;
      error = err;
    }

    const inputTokens  = response?.usage?.input_tokens  || 0;
    const outputTokens = response?.usage?.output_tokens || 0;
    this._sendMetric({
      provider: 'openai', model: params.model,
      input_tokens: inputTokens, output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost_usd: calculateOpenAICost(params.model, inputTokens, outputTokens),
      latency_ms: Date.now() - startTime, status_code: statusCode,
      tools_used: [], prompt_preview: inputPreview,
      tags: this.tags, api_key_hint: this.apiKeyHint, ...(error ? classifyError(error) : {}),
    }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));

    if (error) throw error;
    return response;
  }

  async* _wrapResponsesStream(stream, startTime, params, inputPreview) {
    let inputTokens = 0, outputTokens = 0;
    try {
      for await (const event of stream) {
        if (event.type === 'response.completed') {
          inputTokens  = event.response?.usage?.input_tokens  || 0;
          outputTokens = event.response?.usage?.output_tokens || 0;
        }
        yield event;
      }
    } finally {
      this._sendMetric({
        provider: 'openai', model: params.model,
        input_tokens: inputTokens, output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        cost_usd: calculateOpenAICost(params.model, inputTokens, outputTokens),
        latency_ms: Date.now() - startTime, status_code: 200,
        tools_used: [], prompt_preview: inputPreview,
        tags: this.tags, api_key_hint: this.apiKeyHint,
      }).catch(err => console.warn('[LLM Observatory] Failed to send metric:', err.message));
    }
  }

  async _sendMetric(data) {
    await _postMetric(`${this.observatoryUrl}/api/metrics`, data, this.observatoryToken);
  }
}

module.exports = {
  MonitoredAnthropic,
  MonitoredOpenAI,
  maskKey,
  classifyError,
  calculateCost,
  calculateOpenAICost,
  calculateOpenAIEmbeddingCost,
  calculateWhisperCost,
  calculateTTSCost,
  ANTHROPIC_PRICING,
  OPENAI_PRICING,
  OPENAI_EMBEDDINGS_PRICING,
  OPENAI_WHISPER_PRICE_PER_MINUTE,
  OPENAI_TTS_PRICING,
};
