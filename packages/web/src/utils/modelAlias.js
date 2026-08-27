// Best-effort shortener for raw model IDs (e.g. "claude-3-5-sonnet-20241022"
// -> "sonnet-3.5") so they fit in the compact spaces of the dashboard's
// legend and "Modelos principales" list without CSS ellipsis eating the
// meaningful part of the name. Not a full parser — unmatched/unknown model
// IDs pass through unchanged, degrading safely for future model names.
const ALIAS_RULES = [
  // Anthropic: claude-{family}-{version}-YYYYMMDD -> {family}-{version}
  [/^claude-3-5-sonnet(-.*)?$/i, 'sonnet-3.5'],
  [/^claude-3-5-haiku(-.*)?$/i, 'haiku-3.5'],
  [/^claude-3-opus(-.*)?$/i, 'opus-3'],
  [/^claude-3-sonnet(-.*)?$/i, 'sonnet-3'],
  [/^claude-3-haiku(-.*)?$/i, 'haiku-3'],
  [/^claude-sonnet-4(-.*)?$/i, 'sonnet-4'],
  [/^claude-opus-4(-.*)?$/i, 'opus-4'],
  [/^claude-haiku-4(-.*)?$/i, 'haiku-4'],
  // OpenAI
  [/^gpt-4o-mini(-.*)?$/i, 'gpt-4o-mini'],
  [/^gpt-4o(-.*)?$/i, 'gpt-4o'],
  [/^gpt-4-turbo(-.*)?$/i, 'gpt-4-turbo'],
  [/^gpt-4(-.*)?$/i, 'gpt-4'],
  [/^gpt-3\.5-turbo(-.*)?$/i, 'gpt-3.5-turbo'],
  [/^o1-mini(-.*)?$/i, 'o1-mini'],
  [/^o1(-.*)?$/i, 'o1'],
  [/^o3-mini(-.*)?$/i, 'o3-mini'],
  [/^o3(-.*)?$/i, 'o3'],
  // Gemini
  [/^gemini-3\.1-pro-preview(-.*)?$/i, 'gemini-3.1-pro'],
  [/^gemini-3\.5-flash(-.*)?$/i, 'gemini-3.5-flash'],
  [/^gemini-3-flash-preview(-.*)?$/i, 'gemini-3-flash'],
  [/^gemini-3\.1-flash-lite(-.*)?$/i, 'gemini-3.1-flash-lite'],
  [/^gemini-2\.5-pro(-.*)?$/i, 'gemini-2.5-pro'],
  [/^gemini-2\.5-flash(-.*)?$/i, 'gemini-2.5-flash'],
  // Grok / Kimi
  [/^grok-2(-.*)?$/i, 'grok-2'],
  [/^grok-3(-.*)?$/i, 'grok-3'],
  [/^kimi-k2(-.*)?$/i, 'kimi-k2'],
  [/^moonshot-v1(-.*)?$/i, 'moonshot-v1'],
];

// Catch-all: strip a trailing date/build suffix (-YYYYMMDD, -latest,
// -preview, -20240620 etc.) when no specific rule above matched.
const TRAILING_SUFFIX_RE = /-(?:\d{6,8}|latest|preview)$/i;

export function shortModelName(model) {
  if (!model) return model;
  for (const [pattern, alias] of ALIAS_RULES) {
    if (pattern.test(model)) return alias;
  }
  const stripped = model.replace(TRAILING_SUFFIX_RE, '');
  return stripped || model;
}
