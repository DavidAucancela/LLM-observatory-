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

function isDarkTheme() {
  return typeof document !== 'undefined' && !!document.querySelector('.theme-dark');
}

// surface/border are consumed by MetricSurface3D's canvas background/grid;
// text/muted are consumed by ModelTrendChart2D's axis ticks and tooltip.
// Bars/lines are colored per-model (colorForModelIndex below), not per-metric,
// since the Z axis (3D) / series (2D) is model — keep this to what's used.
export function readChartPalette() {
  return {
    surface: readCssVar('--surface-raised', '#1E2535'),
    border:  readCssVar('--border', '#2A3346'),
    text:    readCssVar('--text', '#E7ECF5'),
    muted:   readCssVar('--muted', '#8B96AC'),
    accent:  readCssVar('--accent', '#06B6D4'),
    // Fixed (not read from the app's --border token): the 3D floor grid and
    // its contact shadow need real contrast against `surface` in both
    // themes. --border is tuned for subtle card outlines and in light mode
    // (#E4E7EC on #FFFFFF) is nearly invisible as a 3D floor.
    gridLine: isDarkTheme() ? '#3A4560' : '#CBD2DC',
    shadow:   isDarkTheme() ? '#000000' : '#94A3B8',
  };
}

// Per-model color, shaded from its provider's hue (see utils/providerColors.js)
// instead of an arbitrary cyclic palette — keeps the chart's series colors
// visually grouped by provider, consistent with the spend/provider cards.
// `provider` null/undefined (the synthetic "Other" bucket) falls back to a
// fixed neutral slate. `forThreeJs` picks the literal-hex variant three.js
// needs (MetricSurface3D) vs. the color-mix() CSS string used by 2D/DOM
// contexts (Recharts lines, legend dots).
import { shadeForModelRGB, shadeForModelCSS } from './providerColors';

export function colorForModel(provider, indexWithinProvider, { forThreeJs = false } = {}) {
  return forThreeJs
    ? shadeForModelRGB(provider, indexWithinProvider)
    : shadeForModelCSS(provider, indexWithinProvider);
}
