import React from 'react';

export default function Sparkline({ data = [], color = 'currentColor', width, height = 32, fill = false }) {
  if (data.length < 2) return <svg width={width ?? '100%'} height={height} />;

  const W = 200;
  const H = height;
  const pad = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - pad - ((v - min) / range) * (H - pad * 2),
  ]);

  const linePath = `M ${pts.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' L ')}`;
  const areaPath = `M 0,${H} L ${pts.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' L ')} L ${W},${H} Z`;

  const gradId = `sg${color.replace(/[^a-zA-Z0-9]/g, '').slice(-12) || 'def'}`;

  return (
    <svg
      width={width ?? '100%'}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {fill && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path d={linePath} stroke={color} strokeWidth="1.5" fill="none"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
