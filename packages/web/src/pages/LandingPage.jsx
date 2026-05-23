import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

/* ── Icon helper ── */
const IC = ({ d, size = 18, stroke = 'currentColor', fill = 'none', sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

/* ══════════════════════════════════════════════════════
   1. NAVBAR
══════════════════════════════════════════════════════ */
function Nav({ onDashboard }) {
  return (
    <nav className="lp-nav">
      <a className="lp-nav-brand" href="#">
        <div className="lp-brand-mark">◐</div>
        Observatory
      </a>
      <div className="lp-nav-links">
        <a className="lp-nav-link" href="#features">Features</a>
        <a className="lp-nav-link" href="#architecture">Architecture</a>
        <a className="lp-nav-link" href="#how-it-works">How it works</a>
        <a className="lp-nav-link lp-nav-link-gh" href="https://github.com/DavidAucancela/LLM-observatory-" target="_blank" rel="noreferrer">
          <GitHubIcon /> GitHub
        </a>
        <button className="lp-nav-cta" onClick={onDashboard}>Dashboard →</button>
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════
   2. DASHBOARD MOCKUP (hero visual)
══════════════════════════════════════════════════════ */
const CHART_A = '0,58 32,42 64,50 96,28 128,44 160,32 192,20 224,36 256,24 288,38 320,16';
const CHART_O = '0,68 32,64 64,58 96,54 128,61 160,52 192,56 224,49 256,54 288,46 320,50';

function DashboardMockup() {
  return (
    <div className="lp-mockup-outer">
      <div className="lp-mockup-glow" />
      <div className="lp-hero-mockup">
        <div className="lp-mockup-window">
          {/* Topbar */}
          <div className="lp-mockup-topbar">
            <span className="lp-dot-r" /><span className="lp-dot-y" /><span className="lp-dot-g" />
            <span className="lp-mockup-topbar-title">Observatory — Dashboard</span>
          </div>

          {/* KPI strip */}
          <div className="lp-mockup-kpi-strip">
            {[
              { label: 'Requests',    val: '12.4K',  color: '#6366f1' },
              { label: 'Tokens',      val: '1.84M',  color: '#3b82f6' },
              { label: 'Total Cost',  val: '$4.21',  color: '#a855f7' },
              { label: 'Avg Latency', val: '312ms',  color: '#f59e0b' },
            ].map(k => (
              <div key={k.label} className="lp-mockup-kpi">
                <div className="lp-mockup-kpi-val" style={{ color: k.color }}>{k.val}</div>
                <div className="lp-mockup-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Body: chart + breakdown */}
          <div className="lp-mockup-body">
            <div className="lp-mockup-chart">
              <div className="lp-mockup-chart-title">Tokens over time</div>
              <svg viewBox="0 0 320 72" preserveAspectRatio="none" className="lp-mockup-svg">
                <defs>
                  <linearGradient id="lgA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d97706" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="lgO" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points={`${CHART_A} 320,72 0,72`} fill="url(#lgA)" />
                <polygon points={`${CHART_O} 320,72 0,72`} fill="url(#lgO)" />
                <polyline points={CHART_A} fill="none" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={CHART_O} fill="none" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="lp-mockup-legend">
                <span><span className="lp-mockup-dot" style={{ background: '#d97706' }} />Anthropic</span>
                <span><span className="lp-mockup-dot" style={{ background: '#10b981' }} />OpenAI</span>
              </div>
            </div>
            <div className="lp-mockup-breakdown">
              <div className="lp-mockup-breakdown-title">Top models</div>
              {[
                { name: 'claude-sonnet-4-6', pct: 72, color: '#d97706' },
                { name: 'gpt-4o',            pct: 18, color: '#10b981' },
                { name: 'claude-haiku-4-5',  pct: 10, color: '#6366f1' },
              ].map(m => (
                <div key={m.name} className="lp-mockup-row">
                  <div className="lp-mockup-row-name">{m.name}</div>
                  <div className="lp-mockup-row-track">
                    <div className="lp-mockup-row-fill" style={{ width: `${m.pct}%`, background: m.color }} />
                  </div>
                  <div className="lp-mockup-row-pct">{m.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   3. PROVIDER STRIP
══════════════════════════════════════════════════════ */
function Providers() {
  return (
    <div className="lp-providers">
      <span className="lp-prov-label">Works with</span>
      <div className="lp-prov-item">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#d97706" strokeWidth="1.5" />
          <path d="M8 12h8M12 8l4 4-4 4" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ color: '#d97706' }}>Anthropic</span>
      </div>
      <div className="lp-prov-item">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="1.5" />
          <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ color: '#10b981' }}>OpenAI</span>
      </div>
      <div className="lp-prov-item lp-prov-item-soon">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        More coming soon
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   4. STATS BAR
══════════════════════════════════════════════════════ */
function Stats() {
  return (
    <div className="lp-stats">
      {[
        { num: '0ms',  label: 'Latency overhead on your API calls' },
        { num: '2',    label: 'Providers supported'                },
        { num: '∞',    label: 'Requests tracked per org'           },
        { num: 'MIT',  label: 'Open source license'                },
      ].map(s => (
        <div key={s.label} className="lp-stat">
          <div className="lp-stat-num">{s.num}</div>
          <div className="lp-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   5. PROBLEM → SOLUTION
══════════════════════════════════════════════════════ */
const VS = {
  bad: [
    'No visibility into which model costs most',
    'Surprise bills at the end of the month',
    'Scattered API keys across team members',
    'Zero context when a latency spike appears',
    'No budget limits or webhook alerts',
  ],
  good: [
    'Per-request cost breakdown by model & provider',
    'Monthly projections based on live 30-day trend',
    'Centralised org tokens, each scoped to one integration',
    'Real-time latency chart + historical data sync',
    'Discord alerts before you hit daily/weekly limits',
  ],
};

function ProblemSolution() {
  return (
    <section className="lp-section" id="why">
      <div className="lp-section-tag">Why Observatory?</div>
      <h2 className="lp-section-title">Stop flying blind on LLM costs</h2>
      <p className="lp-section-sub">Most teams don't know what they're spending on AI until the invoice arrives.</p>
      <div className="lp-vs-grid">
        <div className="lp-vs-col lp-vs-col-bad">
          <div className="lp-vs-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Without Observatory
          </div>
          {VS.bad.map(item => (
            <div key={item} className="lp-vs-item">
              <span className="lp-vs-icon lp-vs-icon-bad">✗</span>
              {item}
            </div>
          ))}
        </div>
        <div className="lp-vs-col lp-vs-col-good">
          <div className="lp-vs-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            With Observatory
          </div>
          {VS.good.map(item => (
            <div key={item} className="lp-vs-item">
              <span className="lp-vs-icon lp-vs-icon-good">✓</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════
   6. FEATURES WITH TABS
══════════════════════════════════════════════════════ */
const TABS = [
  {
    label: 'Real-time Monitoring',
    title: 'Live metrics as they happen',
    desc: 'WebSocket-powered updates stream tokens, cost, and latency the instant your app makes a call. Every request is logged with full detail.',
    bullets: [
      'WebSocket live feed — no polling required',
      'Per-request drawer with prompt preview',
      'Provider & model side-by-side comparison',
    ],
    visual: 'monitoring',
  },
  {
    label: 'Cost & Budgets',
    title: 'Know your spend before the bill arrives',
    desc: 'Model-aware pricing tables auto-calculate cost per request. Set daily, weekly, or monthly budget limits and get Discord alerts.',
    bullets: [
      'Model-aware pricing for all Claude & OpenAI models',
      'Discord webhook alerts before overspending',
      'Monthly projection based on 30-day live trend',
    ],
    visual: 'budgets',
  },
  {
    label: 'Team Management',
    title: 'One org, isolated data, full control',
    desc: 'Every organisation gets its own tenant. Invite teammates by email, assign roles, and issue Observatory tokens per integration.',
    bullets: [
      'Role-based access: admin / member',
      'Observatory tokens (obs_sk_…) per integration',
      'Email invitations with 7-day expiry',
    ],
    visual: 'team',
  },
];

function TabVisualMonitoring() {
  return (
    <div className="lp-tab-visual">
      <div className="lp-tab-visual-label">Recent requests</div>
      {[
        { p: 'A', model: 'claude-sonnet-4-6', tok: '2.4K', cost: '$0.012', ok: true  },
        { p: 'O', model: 'gpt-4o',            tok: '1.1K', cost: '$0.005', ok: true  },
        { p: 'A', model: 'claude-haiku-4-5',  tok: '890',  cost: '$0.001', ok: true  },
        { p: 'A', model: 'claude-sonnet-4-6', tok: '3.2K', cost: '$0.016', ok: false },
      ].map((r, i) => (
        <div key={i} className="lp-tab-vrow">
          <span className="lp-tab-pbadge" style={{
            background: r.p === 'A' ? 'rgba(217,119,6,0.15)' : 'rgba(16,185,129,0.15)',
            color: r.p === 'A' ? '#d97706' : '#10b981',
          }}>
            {r.p === 'A' ? 'Anthropic' : 'OpenAI'}
          </span>
          <span className="lp-tab-model">{r.model}</span>
          <span className="lp-tab-num">{r.tok}</span>
          <span className="lp-tab-num">{r.cost}</span>
          <span style={{ color: r.ok ? '#10b981' : '#ef4444', fontSize: 9 }}>●</span>
        </div>
      ))}
    </div>
  );
}

function TabVisualBudgets() {
  const rows = [
    { label: 'Daily',   spent: 12.4,  limit: 20,  color: '#f59e0b' },
    { label: 'Weekly',  spent: 82.1,  limit: 100, color: '#ef4444' },
    { label: 'Monthly', spent: 142.8, limit: 500, color: '#10b981' },
  ];
  return (
    <div className="lp-tab-visual">
      <div className="lp-tab-visual-label">Budget limits</div>
      {rows.map(b => (
        <div key={b.label} className="lp-tab-budget">
          <div className="lp-tab-budget-hdr">
            <span>{b.label}</span>
            <span className="lp-tab-mono">${b.spent.toFixed(2)} / ${b.limit}</span>
          </div>
          <div className="lp-tab-bar-track">
            <div className="lp-tab-bar-fill" style={{ width: `${(b.spent / b.limit) * 100}%`, background: b.color }} />
          </div>
        </div>
      ))}
      <div className="lp-tab-projection">
        <span>Projected monthly</span>
        <span className="lp-tab-mono" style={{ color: '#a855f7' }}>$248.60</span>
      </div>
    </div>
  );
}

function TabVisualTeam() {
  const members = [
    { initials: 'DA', name: 'David A.',  email: 'david@corp.io', role: 'Admin',  color: '#6366f1' },
    { initials: 'MR', name: 'Maria R.',  email: 'maria@corp.io', role: 'Member', color: '#10b981' },
    { initials: 'JL', name: 'Juan L.',   email: 'juan@corp.io',  role: 'Member', color: '#f59e0b' },
  ];
  return (
    <div className="lp-tab-visual">
      <div className="lp-tab-visual-label">Team members</div>
      {members.map(m => (
        <div key={m.email} className="lp-tab-member">
          <div className="lp-tab-avatar" style={{ background: m.color }}>{m.initials}</div>
          <div className="lp-tab-member-info">
            <div className="lp-tab-member-name">{m.name}</div>
            <div className="lp-tab-member-email">{m.email}</div>
          </div>
          <span className="lp-tab-role" style={{ color: m.role === 'Admin' ? '#818cf8' : '#555' }}>{m.role}</span>
        </div>
      ))}
      <div className="lp-tab-token">
        <span className="lp-tab-mono" style={{ color: '#6366f1', fontSize: 10 }}>obs_sk_abc123…</span>
        <span style={{ fontSize: 10, color: '#555' }}>SDK token</span>
      </div>
    </div>
  );
}

const TAB_VISUALS = { monitoring: TabVisualMonitoring, budgets: TabVisualBudgets, team: TabVisualTeam };

function FeaturesWithTabs() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];
  const Visual = TAB_VISUALS[tab.visual];
  return (
    <section id="features" className="lp-section">
      <div className="lp-section-tag">Features</div>
      <h2 className="lp-section-title">Everything you need to monitor<br />LLM usage at scale</h2>
      <p className="lp-section-sub">From a single developer to a whole engineering team — Observatory grows with you.</p>
      <div className="lp-tabs-bar">
        {TABS.map((t, i) => (
          <button key={t.label} className={`lp-tab-btn${active === i ? ' active' : ''}`} onClick={() => setActive(i)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="lp-tab-content">
        <div className="lp-tab-desc">
          <h3 className="lp-tab-desc-title">{tab.title}</h3>
          <p className="lp-tab-desc-text">{tab.desc}</p>
          <ul className="lp-tab-bullets">
            {tab.bullets.map(b => (
              <li key={b}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <Visual />
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════
   7. ARCHITECTURE DIAGRAM
══════════════════════════════════════════════════════ */
function ArchNode({ label, sub, primary, accent }) {
  return (
    <div className={['lp-arch-node', primary && 'lp-arch-node-primary', accent && 'lp-arch-node-accent'].filter(Boolean).join(' ')}>
      <div className="lp-arch-node-label">{label}</div>
      {sub && <div className="lp-arch-node-sub">{sub}</div>}
    </div>
  );
}

function Arrow({ dashed }) {
  return (
    <div className={`lp-arch-arrow${dashed ? ' lp-arch-arrow-dashed' : ''}`}>
      <div className="lp-arch-arrow-line" />
      <span className="lp-arch-arrow-tip">›</span>
    </div>
  );
}

function ArchDiagram() {
  return (
    <section id="architecture" className="lp-section" style={{ paddingTop: 0 }}>
      <div className="lp-section-tag">Architecture</div>
      <h2 className="lp-section-title">Zero-latency by design</h2>
      <p className="lp-section-sub">Metrics travel a completely separate async path — your users never wait an extra millisecond.</p>
      <div className="lp-arch-wrap">
        {/* Sync row */}
        <div className="lp-arch-row">
          <div className="lp-arch-row-tag lp-arch-row-tag-sync">sync · awaited</div>
          <div className="lp-arch-nodes">
            <ArchNode label="Your App" sub="Node.js" />
            <Arrow />
            <ArchNode label="MonitoredAnthropic" sub="SDK wrapper" primary />
            <Arrow />
            <ArchNode label="Claude / OpenAI" sub="Provider API" />
          </div>
        </div>
        {/* Async row */}
        <div className="lp-arch-row lp-arch-row-async">
          <div className="lp-arch-row-tag lp-arch-row-tag-async">async · fire &amp; forget</div>
          <div className="lp-arch-nodes">
            <ArchNode label="MonitoredAnthropic" sub="SDK wrapper" primary />
            <Arrow dashed />
            <ArchNode label="Observatory API" sub="Express + pg" accent />
            <Arrow dashed />
            <ArchNode label="PostgreSQL" sub="metrics store" />
            <Arrow dashed />
            <ArchNode label="Socket.io" sub="real-time" />
            <Arrow dashed />
            <ArchNode label="Dashboard" sub="React + WS" primary />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════
   8. HOW IT WORKS
══════════════════════════════════════════════════════ */
const STEPS = [
  {
    title: 'Deploy Observatory',
    desc: 'One-click deploy to Railway or docker-compose up locally. PostgreSQL, API, and dashboard start together.',
    code: 'docker-compose up -d --build',
  },
  {
    title: 'Create an Observatory token',
    desc: 'Register, create your org, then go to Settings → Team → Observatory Tokens → New token.',
    code: 'obs_sk_xxxxxxxxxxxxxxxxxxxxxxxx',
  },
  {
    title: 'Wrap your SDK client',
    desc: 'Replace new Anthropic() with new MonitoredAnthropic(). Every API call is automatically tracked with zero extra latency.',
    code: 'npm install @llm-observatory/sdk',
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="lp-section" style={{ paddingTop: 0 }}>
      <div className="lp-section-tag">How it works</div>
      <h2 className="lp-section-title">Up and running in minutes</h2>
      <p className="lp-section-sub">No infrastructure expertise required. Self-host on Railway, Docker, or any Node.js server.</p>
      <div className="lp-steps">
        {STEPS.map((s, i) => (
          <div key={i} className="lp-step">
            <div className="lp-step-num">{i + 1}</div>
            <div className="lp-step-body">
              <div className="lp-step-title">{s.title}</div>
              <div className="lp-step-desc">{s.desc}</div>
              <div className="lp-code-chip">{s.code}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════
   9. OPEN SOURCE CALLOUT
══════════════════════════════════════════════════════ */
function OpenSourceCallout() {
  return (
    <section className="lp-oss-callout">
      <div className="lp-section-tag" style={{ textAlign: 'center' }}>Open Source</div>
      <h2 className="lp-oss-title">Your data never leaves<br />your infrastructure</h2>
      <p className="lp-oss-sub">Self-host on any server. Inspect every line of code. Fork it and extend it to fit your stack.</p>
      <div className="lp-oss-badges">
        {[
          { icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',               label: 'Data stays yours'       },
          { icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z',            label: 'Self-hosted'            },
          { icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', label: 'MIT License'           },
        ].map(b => (
          <div key={b.label} className="lp-oss-badge">
            <IC d={b.icon} size={15} stroke="#6366f1" />
            {b.label}
          </div>
        ))}
      </div>
      <a className="lp-btn-secondary" href="https://github.com/DavidAucancela/LLM-observatory-" target="_blank" rel="noreferrer"
        style={{ display: 'inline-flex', marginTop: 28 }}>
        <GitHubIcon /> View on GitHub
      </a>
    </section>
  );
}

/* ══════════════════════════════════════════════════════
   10. CTA BANNER
══════════════════════════════════════════════════════ */
function CTABanner({ onDashboard }) {
  return (
    <div className="lp-cta-banner">
      <div className="lp-cta-glow" />
      <h2>Ready to see what your API spend<br />actually looks like?</h2>
      <p>Free, open source, self-hosted. No credit card. Your data stays in your infrastructure.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="lp-btn-primary" onClick={onDashboard}>Open Dashboard →</button>
        <a className="lp-btn-secondary" href="https://github.com/DavidAucancela/LLM-observatory-" target="_blank" rel="noreferrer">
          <GitHubIcon /> View on GitHub
        </a>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   11. FOOTER
══════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-cols">
        <div className="lp-footer-col">
          <a className="lp-nav-brand" href="#" style={{ marginBottom: 10, display: 'inline-flex' }}>
            <div className="lp-brand-mark" style={{ width: 22, height: 22, fontSize: 10 }}>◐</div>
            LLM Observatory
          </a>
          <p className="lp-footer-tagline">Open-source observability for<br />Claude and OpenAI API calls.</p>
          <span className="lp-mit">MIT © 2026 LLM Observatory</span>
        </div>
        <div className="lp-footer-col">
          <div className="lp-footer-col-title">Product</div>
          <a className="lp-footer-link" href="#features">Features</a>
          <a className="lp-footer-link" href="#architecture">Architecture</a>
          <a className="lp-footer-link" href="#how-it-works">How it works</a>
          <a className="lp-footer-link" href="/login">Open Dashboard</a>
        </div>
        <div className="lp-footer-col">
          <div className="lp-footer-col-title">Resources</div>
          <a className="lp-footer-link" href="https://github.com/DavidAucancela/LLM-observatory-" target="_blank" rel="noreferrer">GitHub</a>
          <a className="lp-footer-link" href="https://github.com/DavidAucancela/LLM-observatory-/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT License</a>
          <a className="lp-footer-link" href="https://github.com/DavidAucancela/LLM-observatory-/issues" target="_blank" rel="noreferrer">Issues</a>
          <a className="lp-footer-link" href="https://github.com/DavidAucancela/LLM-observatory-/blob/main/README.md" target="_blank" rel="noreferrer">Docs</a>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════
   PAGE ROOT
══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();
  const onDashboard = () => navigate('/login');

  return (
    <div className="lp-root">
      <Nav onDashboard={onDashboard} />

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-hero-grid" />
        <div className="lp-badge">
          <span className="lp-badge-dot" />
          Open source · Self-hosted · MIT License
        </div>
        <h1>
          Observability for your<br />
          <span className="lp-grad">Claude &amp; OpenAI calls</span>
        </h1>
        <p>
          Drop-in SDK wrapper that streams real-time cost, token, and latency
          metrics to your team dashboard — with zero overhead on your API calls.
        </p>
        <div className="lp-hero-actions">
          <button className="lp-btn-primary" onClick={onDashboard}>Open Dashboard →</button>
          <a className="lp-btn-secondary" href="https://github.com/DavidAucancela/LLM-observatory-" target="_blank" rel="noreferrer">
            <GitHubIcon /> Star on GitHub
          </a>
        </div>
        <DashboardMockup />
      </section>

      <Providers />
      <Stats />
      <ProblemSolution />
      <FeaturesWithTabs />
      <ArchDiagram />
      <HowItWorks />
      <OpenSourceCallout />
      <CTABanner onDashboard={onDashboard} />
      <Footer />
    </div>
  );
}
