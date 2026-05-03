import React from 'react';

export default function Sparkline({ data = [], color = 'currentColor', width = 140, height = 32, fill = false }) {
  if (!data.length) return <svg width={width} height={height} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => `${i * stepX},${height - ((v - min) / range) * (height - 4) - 2}`);
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {fill && <path d={areaPath} fill={color} opacity="0.08" />}
      <path d={linePath} stroke={color} strokeWidth="1.25" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
