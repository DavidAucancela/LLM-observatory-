import React from 'react';
import { useTranslation } from 'react-i18next';
import { colorForModel } from '../utils/chartColors';
import { modelProviderIndices } from '../utils/providerColors';
import { formatCost, fmtLatency, fmtCompact } from '../utils/fmt';

// Replaces the flat HBar list that used to answer only "which model cost the
// most". Each row's bar is the model's recorded spend, split into what the
// input tokens and the output tokens are worth (server-side, via
// pricingBridge.splitRecordedCost — the same pricing tables that produced the
// stored cost), so the chart answers "where inside this model did the money
// go" too. Segments always add up to the recorded cost: whatever the token
// counts can't explain (sync-imported rows, models with no rate in the
// catalog, Anthropic's cache-write surcharge) lands in the striped
// "unattributed" segment instead of being smoothed away.

// Segment share of a model's own cost, guarded against the $0 rows that a
// range with only failed calls produces.
function pct(part, whole) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

// 4 decimals only where they matter (sub-dollar amounts) — "$41.0000" in a
// chip is noise, "$0.0045" is the whole point.
function money(v) {
  return formatCost(v, { small: v < 1 });
}

function Chip({ children, title }) {
  return <span className="mcost-chip" title={title}>{children}</span>;
}

export default function ModelCostBreakdown({ models, range }) {
  const { t } = useTranslation();

  const rows = [...models]
    .filter(m => m.total_cost > 0)
    .sort((a, b) => b.total_cost - a.total_cost);

  if (rows.length === 0) return null;

  const total    = rows.reduce((s, m) => s + m.total_cost, 0);
  const maxCost  = Math.max(...rows.map(m => m.total_cost));
  const totalOut = rows.reduce((s, m) => s + m.output_cost, 0);
  const anyUnattributed = rows.some(m => m.unattributed_cost > 0.0000005);

  // Same per-provider shading the dashboard chart uses, so a model keeps one
  // color across the whole app.
  const shades = modelProviderIndices(
    rows.map(m => m.model),
    Object.fromEntries(rows.map(m => [m.model, m.provider]))
  );

  return (
    <div className="obs-card mcost-card">
      <div className="mcost-head">
        <div>
          <div className="obs-section-label">{t('activity.costByModel')} · {range}</div>
          <div className="mcost-subtitle">{t('models.costBreakdownSubtitle')}</div>
        </div>
        <div className="mcost-total-block">
          <div className="mcost-total-value">{formatCost(total)}</div>
          <div className="mcost-total-caption">{t('models.rangeTotal')}</div>
        </div>
      </div>

      <div className="mcost-legend">
        <span className="mcost-legend-item">
          <span className="mcost-swatch mcost-swatch--in" /> {t('drawer.input')}
        </span>
        <span className="mcost-legend-item">
          <span className="mcost-swatch mcost-swatch--out" /> {t('drawer.output')}
        </span>
        {anyUnattributed && (
          <span className="mcost-legend-item" title={t('models.segUnattributedHint')}>
            <span className="mcost-swatch mcost-swatch--other" /> {t('models.segUnattributed')}
          </span>
        )}
      </div>

      <div className="mcost-rows">
        {rows.map((m, i) => {
          const color   = colorForModel(shades[i].provider, shades[i].index);
          const share   = pct(m.total_cost, total);
          const perK    = m.total_tokens > 0 ? (m.total_cost / m.total_tokens) * 1000 : 0;
          const cacheIn = m.input_tokens > 0 ? pct(m.cache_read_tokens, m.input_tokens) : 0;

          return (
            <div className="mcost-row" key={`${m.provider}-${m.model}`}>
              <div className="mcost-row-head">
                <span className="mcost-dot" style={{ background: color }} />
                <span className="mcost-name" title={m.model}>{m.model}</span>
                <span className="mcost-cost">{money(m.total_cost)}</span>
                <span className="mcost-share">{share.toFixed(share < 10 ? 1 : 0)}%</span>
              </div>

              <div className="mcost-track">
                <div className="mcost-fill" style={{ width: `${pct(m.total_cost, maxCost)}%` }}>
                  {m.input_cost > 0 && (
                    <span
                      className="mcost-seg"
                      style={{
                        width: `${pct(m.input_cost, m.total_cost)}%`,
                        background: `color-mix(in srgb, ${color} 42%, transparent)`,
                      }}
                      title={`${t('drawer.input')} · ${money(m.input_cost)}`}
                    />
                  )}
                  {m.output_cost > 0 && (
                    <span
                      className="mcost-seg"
                      style={{ width: `${pct(m.output_cost, m.total_cost)}%`, background: color }}
                      title={`${t('drawer.output')} · ${money(m.output_cost)}`}
                    />
                  )}
                  {m.unattributed_cost > 0 && (
                    <span
                      className="mcost-seg mcost-seg--other"
                      style={{ width: `${pct(m.unattributed_cost, m.total_cost)}%` }}
                      title={`${t('models.segUnattributed')} · ${money(m.unattributed_cost)} — ${t('models.segUnattributedHint')}`}
                    />
                  )}
                </div>
              </div>

              <div className="mcost-chips">
                {m.input_cost > 0 && (
                  <Chip>{t('drawer.input')} {money(m.input_cost)}</Chip>
                )}
                {m.output_cost > 0 && (
                  <Chip>{t('drawer.output')} {money(m.output_cost)}</Chip>
                )}
                {m.unattributed_cost > 0 && (
                  <Chip title={t('models.segUnattributedHint')}>
                    {t('models.segUnattributed')} {money(m.unattributed_cost)}
                  </Chip>
                )}
                <Chip>{fmtCompact(m.requests)} {t('models.chipRequests')}</Chip>
                <Chip title={t('models.axisCostPer1k')}>{formatCost(perK, { small: true })}/1K</Chip>
                <Chip>{fmtLatency(m.avg_latency)}</Chip>
                {m.cache_read_tokens > 0 && (
                  <Chip title={t('models.chipCacheReadHint')}>
                    {t('drawer.cacheRead')} {fmtCompact(m.cache_read_tokens)} ({cacheIn.toFixed(0)}%)
                  </Chip>
                )}
                {m.cache_write_tokens > 0 && (
                  <Chip title={t('models.chipCacheWriteHint')}>
                    {t('drawer.cacheWrite')} {fmtCompact(m.cache_write_tokens)}
                  </Chip>
                )}
                {m.error_count > 0 && (
                  <Chip title={t('models.chipErrorsHint')}>
                    {m.error_count.toLocaleString()} {t('models.chipErrors')}
                  </Chip>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mcost-foot">
        {t('models.outputShare', { pct: pct(totalOut, total).toFixed(0) })}
        {anyUnattributed && <> · {t('models.segUnattributedHint')}</>}
      </div>
    </div>
  );
}
