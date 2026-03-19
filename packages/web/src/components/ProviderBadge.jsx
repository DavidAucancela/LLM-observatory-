import React from 'react';

export default function ProviderBadge({ provider }) {
  if (provider === 'anthropic') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
        Anthropic
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
      OpenAI
    </span>
  );
}
