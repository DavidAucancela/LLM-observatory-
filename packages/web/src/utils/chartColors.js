// three.js needs literal RGB, not CSS custom property strings — this reads the
// currently-applied theme's computed values so colors stay in sync with
// .theme-light/.theme-dark without duplicating the palette. The theme class
// lives on an inner <div> (App.jsx), not <html> — document.documentElement
// never has these custom properties defined on it, so it must be queried
// directly or every read silently falls through to the fallback color.
export function readCssVar(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  const themedRoot = document.querySelector('.theme-dark, .theme-light') || document.documentElement;
  const value = getComputedStyle(themedRoot).getPropertyValue(name).trim();
  return value || fallback;
}

export function readChartPalette() {
  return {
    surface:       readCssVar('--surface-raised', '#1E2535'),
    border:        readCssVar('--border', '#2A3346'),
    text:          readCssVar('--text', '#E5E9F0'),
    muted:         readCssVar('--muted', '#8B95A8'),
    requests:      readCssVar('--text', '#E5E9F0'),
    tokens:        readCssVar('--tokens-color', '#06B6D4'),
    cost:          readCssVar('--cost-color', '#7C3AED'),
    latency:       readCssVar('--latency-color', '#F59E0B'),
    errorRate:     readCssVar('--error', '#DC2626'),
  };
}

// Distinct, stable per-model colors for the 3D surface's Z-axis rows — cycles
// through a fixed palette by index so a model keeps its color across re-renders.
const MODEL_PALETTE = [
  '#06B6D4', '#7C3AED', '#F59E0B', '#10B981', '#EC4899', '#3B82F6',
];

export function colorForModelIndex(index) {
  if (index === -1) return '#64748B'; // "Other" bucket — neutral slate
  return MODEL_PALETTE[index % MODEL_PALETTE.length];
}
