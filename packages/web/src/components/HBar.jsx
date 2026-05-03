import React from 'react';

export default function HBar({ label, value, max, color = 'var(--text)', valueLabel }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 70px', gap: 12, alignItems: 'center', height: 28 }}>
      <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
      <div style={{ height: 14, background: 'var(--border-soft)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: 'var(--text)' }}>
        {valueLabel ?? value}
      </div>
    </div>
  );
}
