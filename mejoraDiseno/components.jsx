// Reusable primitives for LLM Observatory mockups

const PROVIDER_COLORS = {
  Anthropic: '#D97706',
  OpenAI: '#059669',
};

function ProviderBadge({ name, size = 'sm', label }) {
  const color = PROVIDER_COLORS[name] || '#667085';
  return (
    <span className={`pbadge ${size === 'lg' ? 'lg' : ''}`}>
      <span className="dot" style={{ background: color }}></span>
      <span>{label || name}</span>
    </span>
  );
}

function Dot({ color, pulse, size = 6 }) {
  return (
    <span
      className={`dot ${pulse ? 'dot-pulse' : ''}`}
      style={{ background: color, width: size, height: size }}
    ></span>
  );
}

function Delta({ value }) {
  if (value === 0 || value == null) {
    return <span className="delta flat">— 0%</span>;
  }
  const up = value > 0;
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
}

function Sparkline({ data, color = 'currentColor', height = 36, width = 160, fill = false }) {
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

function StatBlock({ label, value, delta, sparkData, sparkColor }) {
  return (
    <div className="stat-block">
      <div className="stat-label">{label}</div>
      <div className="stat-row">
        <div className="stat-value">{value}</div>
        {delta !== undefined && <Delta value={delta} />}
      </div>
      {sparkData && (
        <div className="stat-spark" style={{ color: sparkColor || 'var(--text)' }}>
          <Sparkline data={sparkData} color={sparkColor || 'currentColor'} width={140} height={32} fill />
        </div>
      )}
    </div>
  );
}

function InlineProgress({ value, max, width = 200, state }) {
  const pct = Math.min(100, (value / max) * 100);
  let cls = '';
  if (state === 'warning' || pct >= 75 && pct < 100) cls = 'warning';
  if (state === 'error' || pct >= 100) cls = 'error';
  return (
    <div className="iprog-bar" style={{ width }}>
      <div className={`iprog-fill ${cls}`} style={{ width: `${pct}%` }}></div>
    </div>
  );
}

function MultiLineChart({ series, height = 180, width = 600 }) {
  // series: [{ name, color, data }]
  const allPoints = series.flatMap(s => s.data);
  const max = Math.max(...allPoints);
  const min = 0;
  const range = max - min || 1;
  const padX = 8;
  const innerW = width - padX * 2;
  const innerH = height - 26;
  const stepX = innerW / (series[0].data.length - 1);

  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => max - (range / ticks) * i);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {/* horizontal gridlines */}
      {tickVals.map((v, i) => {
        const y = (i / ticks) * innerH + 6;
        return (
          <g key={i}>
            <line x1={padX + 36} x2={width - padX} y1={y} y2={y} stroke="var(--border-soft)" strokeWidth="1" />
            <text x={padX} y={y + 3} fontSize="9" fill="var(--muted)" fontFamily="var(--font-mono)">
              {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
            </text>
          </g>
        );
      })}
      {/* series */}
      {series.map((s, si) => {
        const pts = s.data
          .map((v, i) => `${padX + 36 + i * (innerW - 36) / (s.data.length - 1)},${6 + (1 - (v - min) / range) * innerH}`)
          .join(' L ');
        return <path key={si} d={`M ${pts}`} stroke={s.color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />;
      })}
      {/* x labels */}
      <text x={padX + 36} y={height - 4} fontSize="9" fill="var(--muted)" fontFamily="var(--font-mono)">00:00</text>
      <text x={width - padX} y={height - 4} fontSize="9" fill="var(--muted)" fontFamily="var(--font-mono)" textAnchor="end">23:59</text>
    </svg>
  );
}

function HBar({ label, value, max, color, valueLabel, width = 460 }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 70px', gap: 12, alignItems: 'center', height: 28 }}>
      <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ height: 16, background: 'var(--border-soft)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }}></div>
      </div>
      <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: 'var(--text)' }}>{valueLabel}</div>
    </div>
  );
}

function Sidebar({ active = 'Overview', dark }) {
  const items = ['Overview', 'Activity', 'Finance', 'Settings'];
  return (
    <aside className={`obs-sidebar ${dark ? 'dark' : ''}`}>
      <div className="obs-brand">
        <div className="obs-brand-mark">◐</div>
        <span>Observatory</span>
      </div>
      <nav className="obs-nav">
        {items.map(item => (
          <div key={item} className={`obs-nav-item ${active === item ? 'active' : ''}`}>
            <span>{item}</span>
            {item === 'Activity' && active !== 'Activity' && (
              <span style={{ fontSize: 10, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>340</span>
            )}
          </div>
        ))}
      </nav>
      <div className="obs-nav-spacer"></div>
      <div className="obs-status-block">
        <div className="obs-section-label" style={{ marginBottom: 2 }}>Providers</div>
        <div className="obs-status-row">
          <Dot color={PROVIDER_COLORS.Anthropic} pulse />
          <span style={{ color: 'var(--text)' }}>Anthropic</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11 }}>OK</span>
        </div>
        <div className="obs-status-row">
          <Dot color={PROVIDER_COLORS.OpenAI} pulse />
          <span style={{ color: 'var(--text)' }}>OpenAI</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11 }}>OK</span>
        </div>
      </div>
      <button className="obs-theme-toggle">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {dark ? (
            <circle cx="12" cy="12" r="4" />
          ) : (
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          )}
        </svg>
        {dark ? 'Light' : 'Dark'} mode
      </button>
    </aside>
  );
}

function Header({ title, range = '24h', children, right }) {
  return (
    <div className="obs-header">
      <div className="obs-page-title">{title}</div>
      <div className="obs-divider-vertical"></div>
      <div className="obs-range-picker">
        {['24h', '7d', '30d', 'Custom'].map(r => (
          <button key={r} className={r === range ? 'active' : ''}>{r}</button>
        ))}
      </div>
      {children}
      <div className="obs-header-right">
        {right || (
          <>
            <div className="obs-live">
              <Dot color="var(--success)" pulse />
              <span>Live</span>
            </div>
            <button className="obs-btn">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Frame({ width = 1280, height = 800, theme = 'light', children, label }) {
  return (
    <div className={`theme-${theme}`} style={{ width, height, position: 'relative' }}>
      <div className="obs-root">{children}</div>
    </div>
  );
}

Object.assign(window, {
  PROVIDER_COLORS, ProviderBadge, Dot, Delta, Sparkline, StatBlock,
  InlineProgress, MultiLineChart, HBar, Sidebar, Header, Frame
});
