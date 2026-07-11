import React from 'react';

const COLORS = {
  anthropic: '#D97706', openai: '#059669', gemini: '#4285F4',
  Anthropic: '#D97706', OpenAI: '#059669', Gemini: '#4285F4',
};
const LABELS = {
  anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini',
  Anthropic: 'Anthropic', OpenAI: 'OpenAI', Gemini: 'Gemini',
};

export default function ProviderBadge({ provider, size = 'sm' }) {
  const color = COLORS[provider] ?? '#667085';
  const label = LABELS[provider] ?? provider;
  const isLg = size === 'lg';
  return (
    <span className={`pbadge ${isLg ? 'pbadge-lg' : ''}`}>
      <span className="pbadge-dot" style={{ background: color, width: isLg ? 8 : 6, height: isLg ? 8 : 8, borderRadius: isLg ? 2 : 1.5 }} />
      <span>{label}</span>
    </span>
  );
}
