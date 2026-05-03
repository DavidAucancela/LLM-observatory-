// Component sheet — all 10 reusable components, light + dark

function ComponentSheet({ theme }) {
  return (
    <div className={`theme-${theme}`} style={{ width: 1280, padding: 32, background: 'var(--page)', color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
      <div style={{ marginBottom: 20 }}>
        <div className="obs-section-label">Component sheet · {theme}</div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 4 }}>Building blocks</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Cell n="01" name="StatBlock" desc="metric · delta · sparkline">
          <StatBlock label="Requests" value="11,329" delta={12} sparkData={SPARK_REQ} />
        </Cell>

        <Cell n="02" name="CompactTable" desc="40px rows · sortable headers">
          <table className="obs-table">
            <thead><tr><th>Time</th><th>Model</th><th className="num">Cost</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>14:32</td><td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>sonnet-4.5</td><td className="num">$0.031</td><td><Dot color="var(--success)" /> 200</td></tr>
              <tr><td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>14:31</td><td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>gpt-4o</td><td className="num">$0.061</td><td><Dot color="var(--error)" /> 429</td></tr>
            </tbody>
          </table>
        </Cell>

        <Cell n="03" name="InlineProgress" desc="default · warning · error">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ width: 60, color: 'var(--muted)' }}>Default</span>
              <InlineProgress value={32} max={100} width={180} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>32%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ width: 60, color: 'var(--muted)' }}>Warning</span>
              <InlineProgress value={84} max={100} width={180} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>84%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ width: 60, color: 'var(--muted)' }}>Over</span>
              <InlineProgress value={120} max={100} width={180} />
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--error)' }}>120%</span>
            </div>
          </div>
        </Cell>

        <Cell n="04" name="ProviderBadge" desc="sm · lg">
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <ProviderBadge name="Anthropic" />
            <ProviderBadge name="OpenAI" />
            <ProviderBadge name="Anthropic" size="lg" />
            <ProviderBadge name="OpenAI" size="lg" />
          </div>
        </Cell>

        <Cell n="05" name="TabBar" desc="underline style">
          <div className="tabbar">
            <span className="tab active">Requests</span>
            <span className="tab">Models</span>
            <span className="tab">Errors</span>
          </div>
        </Cell>

        <Cell n="06" name="InlineForm" desc="below section header — never modal">
          <div style={{
            padding: '10px 0',
            display: 'grid', gridTemplateColumns: '1fr 1fr auto auto',
            gap: 8, alignItems: 'end'
          }}>
            <div className="fld"><label>Label</label><input placeholder="Production" /></div>
            <div className="fld"><label>Provider</label>
              <select style={{ height: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}>
                <option>Anthropic</option>
              </select>
            </div>
            <button className="obs-btn">Cancel</button>
            <button className="obs-btn obs-btn-primary">Save</button>
          </div>
        </Cell>

        <Cell n="07" name="RightDrawer" desc="overlay backdrop · 400px wide">
          <div style={{
            border: '1px solid var(--border)', borderRadius: 4, height: 130,
            position: 'relative', overflow: 'hidden', background: 'var(--surface)'
          }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
              <div style={{ flex: 1, padding: 10, fontSize: 11, color: 'var(--muted)' }}>main content</div>
              <div style={{ width: '50%', borderLeft: '1px solid var(--border)', padding: 10, background: 'var(--surface)' }}>
                <div style={{ fontSize: 11, fontWeight: 600 }}>Request detail</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>req_01HXKJ9P</div>
                <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)' }}>metadata · tokens · prompt</div>
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, width: '50%', background: 'rgba(0,0,0,0.15)' }}></div>
          </div>
        </Cell>

        <Cell n="08" name="SyncStatusDot" desc="solid · pulse · error">
          <div style={{ display: 'flex', gap: 22, alignItems: 'center', fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot color="var(--success)" size={8} /> Done</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot color="var(--accent)" pulse size={8} /> Running</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot color="var(--error)" size={8} /> Error</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot color="var(--faint)" size={8} /> Idle</span>
          </div>
        </Cell>

        <Cell n="09" name="KeyHintChip" desc="monospace · muted bg">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="kchip">sk-ant-…XK7q</span>
            <span className="kchip">sk-…fG2h</span>
            <span className="kchip">sk-ant-admin-…Q3wN</span>
          </div>
        </Cell>

        <Cell n="10" name="DeltaBadge" desc="up · down · flat">
          <div style={{ display: 'flex', gap: 14 }}>
            <Delta value={12} />
            <Delta value={-8} />
            <Delta value={0} />
            <Delta value={42} />
            <Delta value={-23} />
          </div>
        </Cell>
      </div>

      {/* Interactive states */}
      <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <div className="obs-section-label" style={{ marginBottom: 14 }}>Button states</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, max-content)', gap: 18, alignItems: 'center', fontSize: 11 }}>
          {['Default', 'Hover', 'Active', 'Focus', 'Disabled'].map(s => (
            <div key={s} style={{ color: 'var(--muted)' }}>{s}</div>
          ))}
          <button className="obs-btn obs-btn-primary">Primary</button>
          <button className="obs-btn obs-btn-primary" style={{ filter: 'brightness(1.05)' }}>Primary</button>
          <button className="obs-btn obs-btn-primary" style={{ filter: 'brightness(0.92)' }}>Primary</button>
          <button className="obs-btn obs-btn-primary" style={{ boxShadow: '0 0 0 3px color-mix(in oklab, var(--accent) 30%, transparent)' }}>Primary</button>
          <button className="obs-btn obs-btn-primary" style={{ opacity: 0.4 }}>Primary</button>

          <button className="obs-btn">Secondary</button>
          <button className="obs-btn" style={{ background: 'var(--hover)' }}>Secondary</button>
          <button className="obs-btn" style={{ background: 'var(--hover)', borderColor: 'var(--text)' }}>Secondary</button>
          <button className="obs-btn" style={{ boxShadow: '0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent)', borderColor: 'var(--accent)' }}>Secondary</button>
          <button className="obs-btn" style={{ opacity: 0.4 }}>Secondary</button>
        </div>

        <div className="obs-section-label" style={{ marginTop: 28, marginBottom: 12 }}>Input states</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 200px)', gap: 14, fontSize: 11 }}>
          <div className="fld"><label>Default</label><input placeholder="placeholder" /></div>
          <div className="fld"><label>Focus</label><input defaultValue="focused" style={{ borderColor: 'var(--accent)', boxShadow: '0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent)' }} /></div>
          <div className="fld"><label>Filled</label><input defaultValue="alex@scout.ai" /></div>
          <div className="fld"><label>Disabled</label><input defaultValue="locked" disabled style={{ opacity: 0.5 }} /></div>
        </div>

        <div className="obs-section-label" style={{ marginTop: 28, marginBottom: 12 }}>Data delivery</div>
        <div style={{ display: 'flex', gap: 22, fontSize: 12, color: 'var(--muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Dot color="var(--success)" pulse size={7} /> <span style={{ color: 'var(--text)' }}>Real-time</span> · WebSocket (Live indicator, sync status, request stream)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Dot color="var(--faint)" size={7} /> <span style={{ color: 'var(--text)' }}>Polled</span> · 30s (KPIs, charts, balances, budgets)
          </span>
        </div>
      </div>
    </div>
  );
}

function Cell({ n, name, desc, children }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 6,
      background: 'var(--surface)',
      padding: 18,
      minHeight: 140,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>{n}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{desc}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '100%' }}>{children}</div>
      </div>
    </div>
  );
}

window.ComponentSheet = ComponentSheet;
