import React, { useRef, useState } from 'react';

function fmtV(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
}

export default function MultiLineChart({ series = [], height = 180, labelFormat }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!series.length || !series[0]?.data?.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>No data</span>
      </div>
    );
  }

  const n = series[0].data.length;
  const allPoints = series.flatMap(s => s.data);
  const dataMax = Math.max(...allPoints) || 1;
  const fmt = labelFormat || fmtV;

  // SVG coordinate space
  const VW = 600;
  const padL = 44;
  const padR = 8;
  const padT = 6;
  const padB = 22;
  const innerW = VW - padL - padR;
  const innerH = height - padT - padB;

  const toX = (i) => padL + (i / Math.max(n - 1, 1)) * innerW;
  const toY = (v) => padT + (1 - v / dataMax) * innerH;

  // Y gridlines — 4 ticks
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => dataMax * (1 - i / ticks));

  // X-axis — up to 5 evenly spaced labels
  const xCount = Math.min(5, n);
  const xIdxs = n === 1
    ? [0]
    : Array.from({ length: xCount }, (_, i) => Math.round(i * (n - 1) / (xCount - 1)));

  function handleMouseMove(e) {
    if (!svgRef.current || n < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const chartStartPx = (padL / VW) * rect.width;
    const chartEndPx = ((VW - padR) / VW) * rect.width;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left - chartStartPx) / (chartEndPx - chartStartPx)));
    setHover(Math.round(pct * (n - 1)));
  }

  const crossX = hover !== null ? toX(hover) : null;
  const tooltipOnRight = hover !== null && hover < n / 2;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${VW} ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block', cursor: n > 1 ? 'crosshair' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`mlc-g${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Y-axis gridlines + labels */}
        {tickVals.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={padL} x2={VW - padR} y1={y} y2={y}
                stroke="var(--border-soft)" strokeWidth="1" />
              <text x={padL - 4} y={y + 3} fontSize="9" fill="var(--muted)"
                fontFamily="var(--font-mono)" textAnchor="end">
                {fmt(v)}
              </text>
            </g>
          );
        })}

        {/* Area fills */}
        {n >= 2 && series.map((s, si) => {
          const bottom = toY(0);
          const pts = s.data.map((v, i) => `${toX(i)},${toY(v)}`);
          const d = `M ${toX(0)},${bottom} L ${pts.join(' L ')} L ${toX(n - 1)},${bottom} Z`;
          return <path key={si} d={d} fill={`url(#mlc-g${si})`} />;
        })}

        {/* Lines */}
        {n >= 2 && series.map((s, si) => {
          const d = `M ${s.data.map((v, i) => `${toX(i)},${toY(v)}`).join(' L ')}`;
          return (
            <path key={si} d={d} stroke={s.color} strokeWidth="1.5"
              fill="none" strokeLinejoin="round" strokeLinecap="round" />
          );
        })}

        {/* Crosshair */}
        {hover !== null && crossX !== null && (
          <g>
            <line x1={crossX} y1={padT} x2={crossX} y2={padT + innerH}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="3,2" />
            {series.map((s, si) => (
              <circle key={si} cx={crossX} cy={toY(s.data[hover])} r="3.5"
                fill={s.color} stroke="var(--surface)" strokeWidth="2" />
            ))}
          </g>
        )}

        {/* X-axis labels */}
        {xIdxs.map((idx, i) => {
          const anchor = i === 0 ? 'start' : i === xIdxs.length - 1 ? 'end' : 'middle';
          return (
            <text key={i} x={toX(idx)} y={height - 4} fontSize="9" fill="var(--muted)"
              fontFamily="var(--font-mono)" textAnchor={anchor}>
              {series[0]?.xLabels?.[idx] ?? ''}
            </text>
          );
        })}
      </svg>

      {/* Tooltip — positioned in DOM space, outside SVG */}
      {hover !== null && (
        <div style={{
          position: 'absolute',
          top: 6,
          left: tooltipOnRight
            ? `calc(${(toX(hover) / VW) * 100}% + 10px)`
            : `calc(${(toX(hover) / VW) * 100}% - 138px)`,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '7px 11px',
          pointerEvents: 'none',
          boxShadow: 'var(--shadow-md)',
          zIndex: 10,
          minWidth: 128,
        }}>
          {series[0]?.xLabels?.[hover] && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 5, fontFamily: 'var(--font-mono)' }}>
              {series[0].xLabels[hover]}
            </div>
          )}
          {series.map((s, si) => (
            <div key={si} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              marginBottom: si < series.length - 1 ? 4 : 0,
              fontSize: 11,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--muted)' }}>{s.name}</span>
              <span style={{
                marginLeft: 'auto', fontVariantNumeric: 'tabular-nums',
                color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font-mono)',
              }}>
                {fmt(s.data[hover])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
