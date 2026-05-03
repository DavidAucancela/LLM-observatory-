import React from 'react';

export default function MultiLineChart({ series = [], height = 180, labelFormat }) {
  if (!series.length || !series[0]?.data?.length) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sin datos</span>
    </div>
  );

  const allPoints = series.flatMap(s => s.data);
  const max = Math.max(...allPoints);
  const min = 0;
  const range = max - min || 1;
  const padX = 8;
  const labelW = 38;
  const innerH = height - 26;
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => max - (range / ticks) * i);

  function fmtTick(v) {
    if (labelFormat) return labelFormat(v);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return v.toFixed(0);
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 600 ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {tickVals.map((v, i) => {
        const y = (i / ticks) * innerH + 6;
        return (
          <g key={i}>
            <line x1={padX + labelW} x2={600 - padX} y1={y} y2={y} stroke="var(--border-soft)" strokeWidth="1" />
            <text x={padX} y={y + 3} fontSize="9" fill="var(--muted)" fontFamily="var(--font-mono)">{fmtTick(v)}</text>
          </g>
        );
      })}
      {series.map((s, si) => {
        const n = s.data.length;
        const pts = s.data
          .map((v, i) => {
            const x = padX + labelW + (i / (n - 1)) * (600 - padX - labelW - padX);
            const y = 6 + (1 - (v - min) / range) * innerH;
            return `${x},${y}`;
          })
          .join(' L ');
        return <path key={si} d={`M ${pts}`} stroke={s.color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />;
      })}
      <text x={padX + labelW} y={height - 4} fontSize="9" fill="var(--muted)" fontFamily="var(--font-mono)">
        {series[0]?.xLabels?.[0] ?? ''}
      </text>
      <text x={600 - padX} y={height - 4} fontSize="9" fill="var(--muted)" fontFamily="var(--font-mono)" textAnchor="end">
        {series[0]?.xLabels?.[series[0].xLabels.length - 1] ?? ''}
      </text>
    </svg>
  );
}
