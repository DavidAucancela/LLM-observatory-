// LLM Observatory — Screens

// Mock data
const SPARK_REQ = [12, 14, 11, 18, 22, 19, 24, 28, 26, 31, 29, 33];
const SPARK_TOK = [200, 180, 220, 260, 240, 290, 310, 280, 330, 360, 340, 380];
const SPARK_COST = [4.2, 4.8, 5.1, 4.6, 5.4, 6.1, 5.8, 6.4, 7.0, 6.8, 7.3, 7.6];
const SPARK_LAT = [820, 790, 810, 770, 750, 760, 740, 730, 720, 740, 710, 690];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const ANTH_LINE = HOURS.map(h => 800 + Math.sin(h / 3) * 320 + Math.cos(h / 7) * 180 + h * 14);
const OAI_LINE = HOURS.map(h => 600 + Math.cos(h / 4) * 280 + Math.sin(h / 5) * 160 + h * 9);

const REQUESTS = [
  ['14:32:08', 'Anthropic', 'claude-sonnet-4.5', '4.2k / 1.1k', '$0.0312', '742ms', 200],
  ['14:31:54', 'OpenAI', 'gpt-4o-mini', '1.8k / 420', '$0.0021', '511ms', 200],
  ['14:31:41', 'Anthropic', 'claude-haiku-4.5', '3.1k / 880', '$0.0094', '388ms', 200],
  ['14:31:29', 'OpenAI', 'gpt-4o', '8.7k / 2.4k', '$0.0612', '1.2s', 200],
  ['14:31:12', 'Anthropic', 'claude-sonnet-4.5', '12.4k / 3.2k', '$0.0941', '2.1s', 200],
  ['14:30:58', 'OpenAI', 'gpt-4o-mini', '920 / 180', '$0.0009', '298ms', 200],
  ['14:30:44', 'Anthropic', 'claude-opus-4.5', '6.8k / 1.9k', '$0.4140', '3.4s', 200],
  ['14:30:31', 'OpenAI', 'gpt-4o', '2.3k / 610', '$0.0156', '687ms', 429],
  ['14:30:19', 'Anthropic', 'claude-sonnet-4.5', '5.1k / 1.4k', '$0.0398', '821ms', 200],
  ['14:30:04', 'Anthropic', 'claude-haiku-4.5', '2.8k / 720', '$0.0078', '341ms', 200],
  ['14:29:48', 'OpenAI', 'gpt-4o-mini', '4.4k / 1.1k', '$0.0046', '402ms', 200],
  ['14:29:31', 'Anthropic', 'claude-sonnet-4.5', '7.9k / 2.1k', '$0.0612', '1.4s', 200],
  ['14:29:14', 'OpenAI', 'gpt-4o', '1.2k / 340', '$0.0084', '498ms', 500],
  ['14:28:58', 'Anthropic', 'claude-haiku-4.5', '2.1k / 540', '$0.0058', '289ms', 200],
  ['14:28:42', 'OpenAI', 'gpt-4o-mini', '3.7k / 920', '$0.0039', '378ms', 200],
];

const MODELS = [
  ['claude-sonnet-4.5', 'Anthropic', 1842, '24.8M', '$0.041', '892ms', 76.2],
  ['gpt-4o', 'OpenAI', 1247, '18.3M', '$0.038', '1.1s', 47.4],
  ['claude-opus-4.5', 'Anthropic', 312, '4.2M', '$0.348', '2.8s', 108.6],
  ['claude-haiku-4.5', 'Anthropic', 2918, '11.6M', '$0.008', '341ms', 23.3],
  ['gpt-4o-mini', 'OpenAI', 4124, '14.2M', '$0.003', '402ms', 12.4],
  ['gpt-4-turbo', 'OpenAI', 184, '2.1M', '$0.052', '1.4s', 9.6],
  ['gpt-3.5-turbo', 'OpenAI', 612, '3.4M', '$0.004', '298ms', 2.4],
  ['claude-sonnet-3.7', 'Anthropic', 89, '0.8M', '$0.038', '780ms', 3.4],
];

// ──────────────────────────────────────────────────────────────────────
// 1. OVERVIEW
// ──────────────────────────────────────────────────────────────────────
function Overview({ theme }) {
  return (
    <Frame theme={theme}>
      <Sidebar active="Overview" dark={theme === 'dark'} />
      <div className="obs-main">
        <Header title="Overview" />
        <div className="obs-content">
          <div className="kpi-strip">
            <StatBlock label="Requests" value="11,329" delta={12} sparkData={SPARK_REQ} sparkColor="var(--text)" />
            <StatBlock label="Tokens" value="78.4M" delta={8} sparkData={SPARK_TOK} sparkColor="var(--text)" />
            <StatBlock label="Cost" value="$642.18" delta={-3} sparkData={SPARK_COST} sparkColor="var(--text)" />
            <StatBlock label="Avg Latency" value="784ms" delta={-6} sparkData={SPARK_LAT} sparkColor="var(--text)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 28, marginTop: 22 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="obs-section-label">Tokens over time</div>
                <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 2, background: '#D97706', display: 'inline-block' }}></span>
                    Anthropic
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 2, background: '#059669', display: 'inline-block' }}></span>
                    OpenAI
                  </span>
                </div>
              </div>
              <MultiLineChart
                series={[
                  { name: 'Anthropic', color: '#D97706', data: ANTH_LINE },
                  { name: 'OpenAI', color: '#059669', data: OAI_LINE },
                ]}
                height={180}
                width={600}
              />
            </div>
            <div>
              <div className="obs-section-label" style={{ marginBottom: 10 }}>Provider breakdown</div>
              <table className="obs-table" style={{ marginTop: 4 }}>
                <thead>
                  <tr>
                    <th></th>
                    <th className="num">Reqs</th>
                    <th className="num">Tokens</th>
                    <th className="num">Cost</th>
                    <th className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><ProviderBadge name="Anthropic" /></td>
                    <td className="num">5,161</td>
                    <td className="num">41.4M</td>
                    <td className="num">$498.22</td>
                    <td className="num">77.6</td>
                  </tr>
                  <tr>
                    <td><ProviderBadge name="OpenAI" /></td>
                    <td className="num">6,168</td>
                    <td className="num">37.0M</td>
                    <td className="num">$143.96</td>
                    <td className="num">22.4</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <div className="obs-section-label" style={{ marginBottom: 14 }}>Monthly projection</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              <div style={{ borderRight: '1px solid var(--border-soft)', paddingRight: 28 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <ProviderBadge name="Anthropic" size="lg" />
                  <span style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', marginLeft: 'auto' }}>$1,847.22</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 16 }}>
                  <span>Daily avg <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>$59.58</span></span>
                  <span>14 days remaining</span>
                </div>
              </div>
              <div style={{ paddingLeft: 28 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <ProviderBadge name="OpenAI" size="lg" />
                  <span style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', marginLeft: 'auto' }}>$534.40</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 16 }}>
                  <span>Daily avg <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>$17.24</span></span>
                  <span>14 days remaining</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 2. ACTIVITY / Requests with drawer
// ──────────────────────────────────────────────────────────────────────
function ActivityRequests({ theme, drawer = true }) {
  return (
    <Frame theme={theme}>
      <Sidebar active="Activity" dark={theme === 'dark'} />
      <div className="obs-main">
        <Header title="Activity" />
        <div className="obs-content" style={{ paddingTop: 0, padding: '0 28px' }}>
          <div className="tabbar" style={{ marginBottom: 20, marginTop: 4 }}>
            <span className="tab active">Requests</span>
            <span className="tab">Models</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '0 0 240px' }}>
              <input
                type="text"
                placeholder="Search by request ID, model…"
                style={{
                  width: '100%', height: 30, padding: '0 10px 0 28px',
                  border: '1px solid var(--border)', borderRadius: 5, fontSize: 12,
                  background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit'
                }}
              />
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ position: 'absolute', left: 9, top: 9, color: 'var(--muted)' }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <select className="obs-btn" style={{ height: 30 }}>
              <option>All providers</option>
              <option>Anthropic</option>
              <option>OpenAI</option>
            </select>
            <select className="obs-btn" style={{ height: 30 }}>
              <option>All models</option>
            </select>
            <div className="obs-range-picker">
              {['24h', '7d', '30d'].map(r => (
                <button key={r} className={r === '24h' ? 'active' : ''}>{r}</button>
              ))}
            </div>
            <button className="obs-btn" style={{ marginLeft: 'auto' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </div>

          <table className="obs-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Time</th>
                <th>Provider</th>
                <th>Model</th>
                <th className="num">Tokens (in / out)</th>
                <th className="num">Cost</th>
                <th className="num">Latency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {REQUESTS.slice(0, drawer ? 12 : 15).map((r, i) => {
                const ok = r[6] === 200;
                return (
                  <tr key={i} style={i === 0 && drawer ? { background: 'var(--hover)' } : {}}>
                    <td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r[0]}</td>
                    <td><ProviderBadge name={r[1]} /></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r[2]}</td>
                    <td className="num">{r[3]}</td>
                    <td className="num">{r[4]}</td>
                    <td className="num muted">{r[5]}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Dot color={ok ? 'var(--success)' : 'var(--error)'} />
                        <span className={ok ? '' : 'muted'} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: ok ? 'var(--text)' : 'var(--error)' }}>
                          {r[6]}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', fontSize: 12, color: 'var(--muted)' }}>
            <span>Showing 1–{drawer ? 12 : 15} of 340</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="obs-btn" disabled style={{ opacity: 0.5 }}>Prev</button>
              <button className="obs-btn">Next</button>
            </div>
          </div>
        </div>

        {drawer && (
          <>
            <div className="drawer-backdrop"></div>
            <div className="drawer">
              <div className="drawer-header">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Request detail</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>req_01HXKJ9P7VBRZQ2N</div>
                </div>
                <button className="obs-btn obs-btn-ghost" style={{ padding: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="drawer-body">
                <div className="drawer-section">
                  <div className="obs-section-label" style={{ marginBottom: 10 }}>Metadata</div>
                  <dl className="meta-grid">
                    <dt>Time</dt><dd>14:32:08 UTC</dd>
                    <dt>Provider</dt><dd><ProviderBadge name="Anthropic" /></dd>
                    <dt>Model</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>claude-sonnet-4.5</dd>
                    <dt>Latency</dt><dd>742ms</dd>
                    <dt>Status</dt><dd><span style={{ color: 'var(--success)' }}>200 OK</span></dd>
                    <dt>Stop reason</dt><dd>end_turn</dd>
                  </dl>
                </div>
                <div className="drawer-section">
                  <div className="obs-section-label" style={{ marginBottom: 10 }}>Token breakdown</div>
                  <dl className="meta-grid">
                    <dt>Input</dt><dd>4,218</dd>
                    <dt>Cache read</dt><dd>3,840</dd>
                    <dt>Cache write</dt><dd>0</dd>
                    <dt>Output</dt><dd>1,104</dd>
                    <dt>Total cost</dt><dd>$0.0312</dd>
                  </dl>
                </div>
                <div className="drawer-section">
                  <div className="obs-section-label" style={{ marginBottom: 10 }}>Prompt preview</div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.55,
                    color: 'var(--muted)', padding: 10,
                    background: 'var(--hover)', borderRadius: 4,
                    maxHeight: 130, overflow: 'hidden', position: 'relative'
                  }}>
                    You are a helpful assistant analyzing API usage data. Given the following payload, summarise key trends and surface anomalies in cost…
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Frame>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 3. ACTIVITY / Models
// ──────────────────────────────────────────────────────────────────────
function ActivityModels({ theme }) {
  const maxCost = MODELS[2][6]; // opus highest
  const sorted = [...MODELS].sort((a, b) => b[6] - a[6]);
  return (
    <Frame theme={theme}>
      <Sidebar active="Activity" dark={theme === 'dark'} />
      <div className="obs-main">
        <Header title="Activity" />
        <div className="obs-content" style={{ paddingTop: 0, padding: '0 28px' }}>
          <div className="tabbar" style={{ marginBottom: 22, marginTop: 4 }}>
            <span className="tab">Requests</span>
            <span className="tab active">Models</span>
          </div>

          <div className="obs-section-label" style={{ marginBottom: 12 }}>Cost by model · 7d</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 32 }}>
            {sorted.map((m, i) => (
              <HBar
                key={i}
                label={m[0]}
                value={m[6]}
                max={maxCost}
                color={PROVIDER_COLORS[m[1]]}
                valueLabel={`$${m[6].toFixed(2)}`}
              />
            ))}
          </div>

          <div className="obs-section-label" style={{ marginBottom: 8 }}>All models</div>
          <table className="obs-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Provider</th>
                <th className="num">Requests ↓</th>
                <th className="num">Tokens</th>
                <th className="num">Avg cost / req</th>
                <th className="num">Avg latency</th>
              </tr>
            </thead>
            <tbody>
              {[...MODELS].sort((a, b) => b[2] - a[2]).map((m, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{m[0]}</td>
                  <td><ProviderBadge name={m[1]} /></td>
                  <td className="num">{m[2].toLocaleString()}</td>
                  <td className="num">{m[3]}</td>
                  <td className="num">{m[4]}</td>
                  <td className="num muted">{m[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Frame>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 4. FINANCE / Balances
// ──────────────────────────────────────────────────────────────────────
function FinanceBalances({ theme }) {
  return (
    <Frame theme={theme}>
      <Sidebar active="Finance" dark={theme === 'dark'} />
      <div className="obs-main">
        <Header
          title="Finance"
          right={<button className="obs-btn obs-btn-primary">+ Register recharge</button>}
        />
        <div className="obs-content" style={{ paddingTop: 0, padding: '0 28px' }}>
          <div className="tabbar" style={{ marginBottom: 22, marginTop: 4 }}>
            <span className="tab active">Balances</span>
            <span className="tab">Budgets</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { p: 'Anthropic', remaining: 1452.78, consumed: 547.22, total: 2000.00 },
              { p: 'OpenAI', remaining: 388.41, consumed: 611.59, total: 1000.00 },
            ].map((b, i) => {
              const pct = (b.consumed / b.total) * 100;
              return (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 200px 1fr 240px 110px',
                  gap: 18, alignItems: 'center',
                  padding: '18px 0',
                  borderBottom: '1px solid var(--border-soft)'
                }}>
                  <ProviderBadge name={b.p} size="lg" />
                  <div>
                    <div className="obs-section-label" style={{ fontSize: 10 }}>Remaining</div>
                    <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', marginTop: 2 }}>
                      ${b.remaining.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Consumed <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${b.consumed.toFixed(2)}</span> of <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${b.total.toFixed(2)}</span>
                  </div>
                  <InlineProgress value={b.consumed} max={b.total} width={220} />
                  <button className="obs-btn" style={{ justifySelf: 'end' }}>+ Add funds</button>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 28 }}>
            <div className="obs-section-label" style={{ marginBottom: 10 }}>Recharge history</div>
            <table className="obs-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Date</th>
                  <th>Provider</th>
                  <th className="num">Amount</th>
                  <th>Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['2026-04-22', 'Anthropic', 1000.00, 'Q2 top-up'],
                  ['2026-04-12', 'OpenAI', 500.00, 'Routine'],
                  ['2026-04-02', 'Anthropic', 1000.00, 'Migration buffer'],
                  ['2026-03-28', 'OpenAI', 500.00, '—'],
                  ['2026-03-15', 'Anthropic', 750.00, 'Test workload'],
                ].map((r, i) => (
                  <tr key={i}>
                    <td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r[0]}</td>
                    <td><ProviderBadge name={r[1]} /></td>
                    <td className="num">${r[2].toFixed(2)}</td>
                    <td className="muted">{r[3]}</td>
                    <td className="num"><button className="obs-btn obs-btn-ghost" style={{ color: 'var(--muted)' }}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 5. FINANCE / Budgets
// ──────────────────────────────────────────────────────────────────────
function FinanceBudgets({ theme }) {
  const budgets = [
    { name: 'Production · Anthropic', period: 'Daily', limit: 100, spent: 64.20 },
    { name: 'Production · OpenAI', period: 'Daily', limit: 50, spent: 47.80 },
    { name: 'Eng experiments', period: 'Weekly', limit: 200, spent: 218.40 },
    { name: 'Customer support bot', period: 'Monthly', limit: 1500, spent: 612.00 },
    { name: 'Ops dashboards', period: 'Monthly', limit: 300, spent: 88.20 },
  ];
  return (
    <Frame theme={theme}>
      <Sidebar active="Finance" dark={theme === 'dark'} />
      <div className="obs-main">
        <Header
          title="Finance"
          right={<button className="obs-btn obs-btn-primary">+ New budget</button>}
        />
        <div className="obs-content" style={{ paddingTop: 0, padding: '0 28px' }}>
          <div className="tabbar" style={{ marginBottom: 6, marginTop: 4 }}>
            <span className="tab">Balances</span>
            <span className="tab active">Budgets</span>
          </div>

          {/* Inline form (open) */}
          <div style={{
            padding: '16px 0',
            borderBottom: '1px solid var(--border-soft)',
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr auto auto',
            gap: 10, alignItems: 'end'
          }}>
            <div className="fld"><label>Name</label><input placeholder="e.g. RAG indexer" /></div>
            <div className="fld"><label>Period</label>
              <select style={{ height: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}>
                <option>Daily</option><option>Weekly</option><option>Monthly</option>
              </select>
            </div>
            <div className="fld"><label>Limit (USD)</label><input placeholder="100.00" /></div>
            <div className="fld"><label>Provider</label>
              <select style={{ height: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}>
                <option>All</option><option>Anthropic</option><option>OpenAI</option>
              </select>
            </div>
            <button className="obs-btn">Cancel</button>
            <button className="obs-btn obs-btn-primary">Save</button>
          </div>

          {budgets.map((b, i) => {
            const pct = (b.spent / b.limit) * 100;
            const over = pct >= 100;
            return (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 80px 130px 130px 1fr 80px',
                gap: 16, alignItems: 'center',
                padding: '14px 0',
                borderBottom: '1px solid var(--border-soft)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</div>
                <span style={{
                  fontSize: 11, color: 'var(--muted)',
                  border: '1px solid var(--border)', borderRadius: 3,
                  padding: '2px 7px', justifySelf: 'start'
                }}>{b.period}</span>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Limit <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${b.limit.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Spent <span style={{ color: over ? 'var(--error)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${b.spent.toFixed(2)}</span>
                </div>
                <InlineProgress value={b.spent} max={b.limit} />
                <button className="obs-btn obs-btn-ghost" style={{ color: 'var(--muted)', justifySelf: 'end' }}>Delete</button>
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 6. SETTINGS / Keys
// ──────────────────────────────────────────────────────────────────────
function SettingsKeys({ theme }) {
  const sdkKeys = [
    { label: 'Production', provider: 'Anthropic', hint: 'sk-ant-…XK7q', valid: true, last: '2 min ago' },
    { label: 'Staging', provider: 'Anthropic', hint: 'sk-ant-…M9Lp', valid: true, last: '14 min ago' },
    { label: 'Production', provider: 'OpenAI', hint: 'sk-…fG2h', valid: true, last: '5 min ago' },
    { label: 'Eng sandbox', provider: 'OpenAI', hint: 'sk-…8aBz', valid: false, last: '2 days ago' },
  ];
  const adminKeys = [
    { label: 'Org admin', provider: 'Anthropic', hint: 'sk-ant-admin-…Q3wN', valid: true, last: '1 hr ago' },
    { label: 'Org admin', provider: 'OpenAI', hint: 'sk-admin-…Rk7v', valid: true, last: '1 hr ago' },
  ];
  return (
    <Frame theme={theme}>
      <Sidebar active="Settings" dark={theme === 'dark'} />
      <div className="obs-main">
        <Header title="Settings" right={<span style={{ width: 1 }}></span>} />
        <div className="obs-content" style={{ paddingTop: 0, padding: '0 28px' }}>
          <div className="tabbar" style={{ marginBottom: 22, marginTop: 4 }}>
            <span className="tab active">Keys</span>
            <span className="tab">Sync</span>
            <span className="tab">Alerts</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div className="obs-section-label">SDK Keys</div>
            <button className="obs-btn obs-btn-primary" style={{ padding: '4px 9px', fontSize: 11 }}>+ Add key</button>
          </div>

          {/* expanded inline form for SDK */}
          <div style={{
            padding: '14px 0', borderBottom: '1px solid var(--border-soft)', marginBottom: 4,
            display: 'grid', gridTemplateColumns: '1.2fr 1fr 2fr auto auto',
            gap: 10, alignItems: 'end'
          }}>
            <div className="fld"><label>Label</label><input placeholder="Production" /></div>
            <div className="fld"><label>Provider</label>
              <select style={{ height: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}>
                <option>Anthropic</option><option>OpenAI</option>
              </select>
            </div>
            <div className="fld"><label>API Key</label><input placeholder="sk-ant-…" type="password" /></div>
            <button className="obs-btn">Cancel</button>
            <button className="obs-btn obs-btn-primary">Save</button>
          </div>

          {sdkKeys.map((k, i) => (
            <KeyRow key={i} k={k} kind="sdk" />
          ))}

          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div className="obs-section-label">Admin Keys</div>
            <button className="obs-btn obs-btn-primary" style={{ padding: '4px 9px', fontSize: 11 }}>+ Add key</button>
          </div>
          {adminKeys.map((k, i) => (
            <KeyRow key={i} k={k} kind="admin" />
          ))}

          <div style={{ marginTop: 22, fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Keys are encrypted at rest with AES-256-GCM. Never logged in plaintext.
          </div>
        </div>
      </div>
    </Frame>
  );
}

function KeyRow({ k, kind }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 110px 160px 110px 110px 1fr',
      gap: 14, alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--border-soft)'
    }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{k.label}</div>
      <ProviderBadge name={k.provider} />
      <span className="kchip">{k.hint}</span>
      <span className={`vbadge ${k.valid ? 'valid' : 'invalid'}`}>
        <Dot color={k.valid ? 'var(--success)' : 'var(--error)'} />
        {k.valid ? 'Valid' : 'Invalid'}
      </span>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{k.last}</span>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {kind === 'sdk' && <button className="obs-btn">Sync</button>}
        <button className="obs-btn">Test</button>
        <button className="obs-btn obs-btn-ghost" style={{ color: 'var(--muted)' }}>Delete</button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 7. SETTINGS / Sync
// ──────────────────────────────────────────────────────────────────────
function SettingsSync({ theme }) {
  return (
    <Frame theme={theme}>
      <Sidebar active="Settings" dark={theme === 'dark'} />
      <div className="obs-main">
        <Header title="Settings" right={<span style={{ width: 1 }}></span>} />
        <div className="obs-content" style={{ paddingTop: 0, padding: '0 28px' }}>
          <div className="tabbar" style={{ marginBottom: 22, marginTop: 4 }}>
            <span className="tab">Keys</span>
            <span className="tab active">Sync</span>
            <span className="tab">Alerts</span>
          </div>

          {[
            { p: 'Anthropic', last: '2 min ago', records: '11,329', state: 'ok', running: false },
            { p: 'OpenAI', last: 'Running…', records: '8,421', state: 'running', running: true },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '160px 160px 130px 90px 1fr auto auto',
              gap: 14, alignItems: 'center',
              padding: '16px 0',
              borderBottom: '1px solid var(--border-soft)'
            }}>
              <ProviderBadge name={s.p} size="lg" />
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Last sync <span style={{ color: 'var(--text)' }}>{s.last}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--text)' }}>{s.records}</span> records
              </div>
              <div>
                <Dot
                  color={s.state === 'running' ? 'var(--accent)' : 'var(--success)'}
                  pulse={s.running}
                  size={8}
                />
              </div>
              <div></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="obs-btn" style={{ height: 28 }}>
                  <option>Sync 1 day</option>
                  <option>Sync 7 days</option>
                  <option>Sync 30 days</option>
                </select>
                <button className="obs-btn obs-btn-primary">Run</button>
              </div>
              <button className="obs-btn obs-btn-danger">Clear data</button>
            </div>
          ))}

          <div style={{ marginTop: 24 }}>
            <div className="obs-section-label" style={{ marginBottom: 10 }}>Recent sync log</div>
            {[
              { state: 'success', p: 'Anthropic', msg: 'Fetched 24h window', records: '+412', t: '14:32:08' },
              { state: 'running', p: 'OpenAI', msg: 'In progress…', records: '342', t: '14:31:54' },
              { state: 'success', p: 'Anthropic', msg: 'Fetched 24h window', records: '+388', t: '14:00:08' },
              { state: 'success', p: 'OpenAI', msg: 'Fetched 24h window', records: '+201', t: '13:31:54' },
              { state: 'error', p: 'OpenAI', msg: 'Rate limit · backed off 60s', records: '0', t: '13:01:54' },
              { state: 'success', p: 'Anthropic', msg: 'Fetched 24h window', records: '+341', t: '13:00:08' },
              { state: 'success', p: 'OpenAI', msg: 'Fetched 24h window', records: '+219', t: '12:31:54' },
              { state: 'success', p: 'Anthropic', msg: 'Fetched 24h window', records: '+402', t: '12:00:08' },
            ].map((l, i) => {
              const colorMap = { success: 'var(--success)', error: 'var(--error)', running: 'var(--accent)' };
              return (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 130px 1fr 80px 90px',
                  gap: 12, alignItems: 'center',
                  padding: '8px 0',
                  fontSize: 12,
                  borderBottom: '1px solid var(--border-soft)'
                }}>
                  <Dot color={colorMap[l.state]} pulse={l.state === 'running'} size={7} />
                  <ProviderBadge name={l.p} />
                  <span style={{ color: l.state === 'error' ? 'var(--error)' : 'var(--muted)' }}>{l.msg}</span>
                  <span style={{ color: 'var(--muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.records}</span>
                  <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right' }}>{l.t}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 8. SETTINGS / Alerts
// ──────────────────────────────────────────────────────────────────────
function SettingsAlerts({ theme }) {
  const rules = [
    { p: 'Anthropic', threshold: '$150 / day', debounce: '1 hr', webhook: 'https://hooks.slack.com/…/B07K9X', on: true },
    { p: 'OpenAI', threshold: '$80 / day', debounce: '30 min', webhook: 'https://discord.com/api/webhooks/…', on: true },
    { p: 'Anthropic', threshold: '$50 / hour', debounce: '15 min', webhook: 'https://hooks.slack.com/…/B07K9X', on: false },
    { p: 'OpenAI', threshold: '$300 / week', debounce: '4 hr', webhook: 'https://hooks.slack.com/…/A02L4R', on: true },
  ];
  return (
    <Frame theme={theme}>
      <Sidebar active="Settings" dark={theme === 'dark'} />
      <div className="obs-main">
        <Header
          title="Settings"
          right={<button className="obs-btn obs-btn-primary">+ New rule</button>}
        />
        <div className="obs-content" style={{ paddingTop: 0, padding: '0 28px' }}>
          <div className="tabbar" style={{ marginBottom: 22, marginTop: 4 }}>
            <span className="tab">Keys</span>
            <span className="tab">Sync</span>
            <span className="tab active">Alerts</span>
          </div>

          {rules.map((r, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '160px 130px 90px 1fr 50px 80px 80px',
              gap: 14, alignItems: 'center',
              padding: '14px 0',
              borderBottom: '1px solid var(--border-soft)',
              opacity: r.on ? 1 : 0.55,
            }}>
              <ProviderBadge name={r.p} />
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--muted)' }}>Threshold </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.threshold}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.debounce}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.webhook}
              </div>
              <span className={`tsw ${r.on ? 'on' : ''}`}></span>
              <button className="obs-btn">Test</button>
              <button className="obs-btn obs-btn-ghost" style={{ color: 'var(--muted)' }}>Delete</button>
            </div>
          ))}

          <details style={{ marginTop: 28 }} open>
            <summary style={{
              listStyle: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              Recent alerts (12)
            </summary>
            {[
              { t: '14:18', p: 'OpenAI', msg: 'Threshold $80/day exceeded — actual $84.21', state: 'error' },
              { t: '12:02', p: 'Anthropic', msg: 'Threshold $150/day reached', state: 'warning' },
              { t: '09:41', p: 'OpenAI', msg: 'Webhook delivered', state: 'success' },
              { t: '08:12', p: 'Anthropic', msg: 'Webhook delivered', state: 'success' },
            ].map((a, i) => {
              const colorMap = { success: 'var(--success)', error: 'var(--error)', warning: 'var(--warning)' };
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '16px 60px 130px 1fr',
                  gap: 12, alignItems: 'center', padding: '8px 0',
                  fontSize: 12, borderBottom: '1px solid var(--border-soft)',
                }}>
                  <Dot color={colorMap[a.state]} size={7} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{a.t}</span>
                  <ProviderBadge name={a.p} />
                  <span style={{ color: a.state === 'error' ? 'var(--error)' : 'var(--muted)' }}>{a.msg}</span>
                </div>
              );
            })}
          </details>
        </div>
      </div>
    </Frame>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 9. LOGIN
// ──────────────────────────────────────────────────────────────────────
function Login({ theme }) {
  return (
    <div className={`theme-${theme}`} style={{ width: 1280, height: 800 }}>
      <div className="obs-root" style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <div className="obs-brand-mark" style={{ width: 22, height: 22, fontSize: 12 }}>◐</div>
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>Observatory</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: -12 }}>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>Sign in</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Welcome back to your control panel</div>
          </div>
          <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={(e) => e.preventDefault()}>
            <div className="fld">
              <label>Email</label>
              <input type="email" placeholder="you@company.com" defaultValue="alex@scout.ai" />
            </div>
            <div className="fld">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Password</span>
                <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 400 }}>Forgot?</a>
              </label>
              <input type="password" defaultValue="••••••••••" />
            </div>
            <button className="obs-btn obs-btn-primary" style={{ height: 36, fontSize: 13, justifyContent: 'center', marginTop: 4 }}>
              Sign in
            </button>
          </form>
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
            v2.4 · internal tooling
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 10. EMPTY OVERVIEW
// ──────────────────────────────────────────────────────────────────────
function OverviewEmpty({ theme }) {
  return (
    <Frame theme={theme}>
      <Sidebar active="Overview" dark={theme === 'dark'} />
      <div className="obs-main">
        <Header title="Overview" />
        <div className="obs-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="empty">
            <div className="icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="title" style={{ fontSize: 14, fontWeight: 500 }}>No API keys configured</div>
            <div className="sub">Go to Settings → Keys to get started</div>
            <button className="obs-btn obs-btn-primary" style={{ marginTop: 14 }}>Add API key</button>
          </div>
        </div>
      </div>
    </Frame>
  );
}

Object.assign(window, {
  Overview, ActivityRequests, ActivityModels,
  FinanceBalances, FinanceBudgets,
  SettingsKeys, SettingsSync, SettingsAlerts,
  Login, OverviewEmpty,
});
