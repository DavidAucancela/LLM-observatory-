import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

/* ── Icons ── */
const IC = ({ d, size = 18, stroke = 'currentColor', fill = 'none', strokeWidth = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

/* ── Navbar ── */
function Nav({ onDashboard }) {
  return (
    <nav className="lp-nav">
      <a className="lp-nav-brand" href="#">
        <div className="lp-brand-mark">◐</div>
        Observatory
      </a>
      <div className="lp-nav-links">
        <a className="lp-nav-link" href="#features">Features</a>
        <a className="lp-nav-link" href="#how-it-works">Docs</a>
        <a className="lp-nav-link" href="https://github.com/DavidAucancela/LLM-observatory-" target="_blank" rel="noreferrer">
          <GitHubIcon /> GitHub
        </a>
        <button className="lp-nav-cta" onClick={onDashboard}>Dashboard →</button>
      </div>
    </nav>
  );
}

/* ── Code window ── */
function CodeWindow() {
  return (
    <div className="lp-code-wrap">
      <div className="lp-code-window">
        <div className="lp-code-bar">
          <span className="lp-dot-r" /><span className="lp-dot-y" /><span className="lp-dot-g" />
          <span>app.js</span>
        </div>
        <div className="lp-code-body">
          <div><span className="cm">{'// Before — standard Anthropic SDK'}</span></div>
          <div><span className="ck">const </span><span className="cc">client</span><span className="cd"> = </span><span className="ck">new </span><span className="cn">Anthropic</span><span className="cd">{'({ apiKey })'}</span></div>
          <div>&nbsp;</div>
          <div><span className="cm">{'// After  — zero code changes elsewhere'}</span></div>
          <div><span className="ck">const </span><span className="cc">client</span><span className="cd"> = </span><span className="ck">new </span><span className="cn">MonitoredAnthropic</span><span className="cd">{'({'}</span></div>
          <div><span className="cd">{'  '}</span><span className="cc">apiKey</span><span className="cd">,</span></div>
          <div><span className="cd">{'  '}</span><span className="cc">observatoryUrl</span><span className="cd">: </span><span className="cs">'https://your-obs.up.railway.app'</span><span className="cd">,</span></div>
          <div><span className="cd">{'  '}</span><span className="cc">observatoryToken</span><span className="cd">: </span><span className="cs">'obs_sk_...'</span></div>
          <div><span className="cd">{'});'}</span></div>
          <div>&nbsp;</div>
          <div><span className="cm">{'// API call is unchanged — metrics sent async 🚀'}</span></div>
          <div><span className="ck">const </span><span className="cc">res</span><span className="cd"> = </span><span className="ck">await </span><span className="cc">client</span><span className="cd">.</span><span className="cn">messages</span><span className="cd">.</span><span className="cn">create</span><span className="cd">{'({ ... })'}</span></div>
        </div>
      </div>
      <div className="lp-code-scan" />
    </div>
  );
}

/* ── Feature cards ── */
const FEATURES = [
  {
    color: '#6366f1', bg: 'rgba(99,102,241,0.1)',
    icon: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    title: 'Real-time Dashboard',
    desc: 'WebSocket-driven live updates. Watch tokens, cost, and latency stream in as your apps make API calls.',
  },
  {
    color: '#10b981', bg: 'rgba(16,185,129,0.1)',
    icon: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    title: 'Zero Latency Overhead',
    desc: 'Metrics are sent fire-and-forget after the API response. Your users never wait an extra millisecond.',
  },
  {
    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',
    icon: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    title: 'Cost Tracking',
    desc: 'Per-request cost calculation with model-aware pricing tables. Monthly projections based on live trends.',
  },
  {
    color: '#a855f7', bg: 'rgba(168,85,247,0.1)',
    icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    title: 'Multi-tenant Teams',
    desc: 'Every org gets isolated data. Invite teammates by email, assign admin/member roles, manage Observatory tokens.',
  },
  {
    color: '#ef4444', bg: 'rgba(239,68,68,0.1)',
    icon: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    title: 'Budget Alerts',
    desc: 'Set daily, weekly, or monthly spend limits. Get Discord notifications before you exceed them.',
  },
  {
    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',
    icon: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    title: 'CSV Export & Sync',
    desc: 'Export filtered request logs. Pull historical data from Anthropic Admin API or OpenAI Organization API.',
  },
];

function Features() {
  return (
    <section id="features" className="lp-section">
      <div className="lp-section-tag">Features</div>
      <h2 className="lp-section-title">Everything you need to<br />monitor LLM usage at scale</h2>
      <p className="lp-section-sub">From a single developer to a whole engineering team — Observatory grows with you.</p>
      <div className="lp-features-grid">
        {FEATURES.map(f => (
          <div key={f.title} className="lp-feat-card">
            <div className="lp-feat-icon" style={{ background: f.bg }}>
              <IC d={f.icon} stroke={f.color} size={17} />
            </div>
            <div className="lp-feat-title">{f.title}</div>
            <div className="lp-feat-desc">{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── How it works ── */
function HowItWorks() {
  return (
    <section id="how-it-works" className="lp-section" style={{ paddingTop: 0 }}>
      <div className="lp-section-tag">How it works</div>
      <h2 className="lp-section-title">Up and running in minutes</h2>
      <p className="lp-section-sub">No infrastructure to manage. Self-host on Railway, Docker, or any Node.js host.</p>
      <div className="lp-steps">
        {[
          {
            title: 'Deploy Observatory',
            desc: 'One-click deploy to Railway (or docker-compose up locally). PostgreSQL, API, and web dashboard start together.',
            code: 'docker-compose up -d --build',
          },
          {
            title: 'Create an Observatory token',
            desc: 'Register, create your org, then go to Settings → Team → Observatory Tokens → New token.',
            code: 'obs_sk_xxxxxxxxxxxxxxxxxxxxxxxx',
          },
          {
            title: 'Wrap your SDK client',
            desc: 'Replace new Anthropic() with new MonitoredAnthropic(). Every call is automatically tracked.',
            code: 'npm install @llm-observatory/sdk',
          },
        ].map((s, i) => (
          <div key={i} className="lp-step">
            <div className="lp-step-num">{i + 1}</div>
            <div>
              <div className="lp-step-title">{s.title}</div>
              <div className="lp-step-desc">{s.desc}</div>
              <div style={{
                marginTop: 10, padding: '8px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 7,
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                fontSize: 12, color: '#a5b4fc',
                display: 'inline-block',
              }}>
                {s.code}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Stats ── */
function Stats() {
  return (
    <div className="lp-stats">
      {[
        { num: '2',    label: 'Providers supported'       },
        { num: '0ms',  label: 'Latency overhead on calls'  },
        { num: '∞',    label: 'Requests tracked per org'   },
        { num: 'MIT',  label: 'Open source license'        },
      ].map(s => (
        <div key={s.label} className="lp-stat">
          <div className="lp-stat-num">{s.num}</div>
          <div className="lp-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── CTA Banner ── */
function CTABanner({ onDashboard }) {
  return (
    <div className="lp-cta-banner">
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 60% at 50% 120%, rgba(99,102,241,0.25), transparent)',
      }} />
      <h2>Ready to see what your API spend<br />actually looks like?</h2>
      <p>Free, open source, self-hosted. Your data stays in your infrastructure.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="lp-btn-primary" onClick={onDashboard}>
          Open Dashboard →
        </button>
        <a
          className="lp-btn-secondary"
          href="https://github.com/DavidAucancela/LLM-observatory-"
          target="_blank"
          rel="noreferrer"
        >
          <GitHubIcon /> View on GitHub
        </a>
      </div>
    </div>
  );
}

/* ── Footer ── */
function Footer() {
  return (
    <footer className="lp-footer">
      <a className="lp-footer-brand" href="#">
        <div className="lp-brand-mark" style={{ width: 20, height: 20, fontSize: 10 }}>◐</div>
        LLM Observatory
      </a>
      <div className="lp-footer-links">
        <a className="lp-footer-link" href="https://github.com/DavidAucancela/LLM-observatory-" target="_blank" rel="noreferrer">GitHub</a>
        <a className="lp-footer-link" href="https://github.com/DavidAucancela/LLM-observatory-/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT License</a>
        <a className="lp-footer-link" href="https://github.com/DavidAucancela/LLM-observatory-/issues" target="_blank" rel="noreferrer">Issues</a>
      </div>
      <span className="lp-mit">MIT © 2026 LLM Observatory</span>
    </footer>
  );
}

/* ── Page ── */
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
          <button className="lp-btn-primary" onClick={onDashboard}>
            Open Dashboard →
          </button>
          <a
            className="lp-btn-secondary"
            href="https://github.com/DavidAucancela/LLM-observatory-"
            target="_blank"
            rel="noreferrer"
          >
            <GitHubIcon /> Star on GitHub
          </a>
        </div>
        <CodeWindow />
      </section>

      {/* Provider strip */}
      <div className="lp-providers">
        <span className="lp-prov-label">Works with</span>
        <div className="lp-prov-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#d97706" strokeWidth="1.5"/>
            <path d="M8 12h8M12 8l4 4-4 4" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ color: '#d97706' }}>Anthropic</span>
        </div>
        <div className="lp-prov-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="1.5"/>
            <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ color: '#10b981' }}>OpenAI</span>
        </div>
        <div className="lp-prov-item" style={{ color: '#444' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          More coming soon
        </div>
      </div>

      <Stats />
      <Features />
      <HowItWorks />
      <CTABanner onDashboard={onDashboard} />
      <Footer />
    </div>
  );
}
