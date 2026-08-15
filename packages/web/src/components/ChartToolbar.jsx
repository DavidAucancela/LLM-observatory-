import React from 'react';
import { useTranslation } from 'react-i18next';
import { colorForModelIndex } from '../utils/chartColors';

function IconHelp() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconRefresh({ spinning }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

// Points "right" — the rail sits on the card's right edge, so collapsing
// tucks it away in that direction.
function IconCollapse() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// Points "left" — used on the floating expand tab left behind once the rail
// is collapsed, so its direction reads as "bring the rail back" from the right.
export function IconExpand() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

// Same rotate/zoom/pan/click iconography that used to live in
// MetricSurface3D's always-on .ms3d-controls-card overlay. Rendered as a
// banner along the bottom edge of the chart plot itself (Dashboard.jsx mounts
// this inside .dash-chart-body, not the rail) since the hints describe how to
// interact with the plot — anchoring them there beats a popover tucked in the
// rail, which can end up far from the chart when the rail sits on the right.
export function ChartHintBanner({ chartView, open }) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="dash-chart-hint-banner" role="status">
      <div className="dash-chart-hint-banner-row">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 9V4.5a1.5 1.5 0 0 1 3 0V9" />
          <path d="M12 9V3.5a1.5 1.5 0 0 1 3 0V9" />
          <path d="M15 9.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-2c-2.5 0-3.5-1-5-3l-2.7-4a1.4 1.4 0 0 1 2-2L6 12" />
        </svg>
        {t('dashboard.legendClickHint')}
      </div>
      {chartView === '3d' && (
        <>
          <div className="dash-chart-hint-banner-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="7" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="17" r="1" />
              <circle cx="15" cy="7" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="17" r="1" />
            </svg>
            {t('dashboard.controlRotate')}
          </div>
          <div className="dash-chart-hint-banner-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            {t('dashboard.controlZoom')}
          </div>
          <div className="dash-chart-hint-banner-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" />
              <polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" />
              <line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
            </svg>
            {t('dashboard.controlPan')}
          </div>
          <div className="dash-chart-hint-banner-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="7" r="1" /><circle cx="15" cy="7" r="1" />
            </svg>
            {t('dashboard.controlClick')}
          </div>
        </>
      )}
    </div>
  );
}

function ViewToggle({ chartView, onSetChartView, className, tabIndex }) {
  const { t } = useTranslation();
  return (
    <div className={`obs-range-picker${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`obs-range-btn${chartView === '3d' ? ' active' : ''}`}
        title={t('dashboard.view3D')}
        tabIndex={tabIndex}
        onClick={() => onSetChartView('3d')}
      >3D</button>
      <button
        type="button"
        className={`obs-range-btn${chartView === '2d' ? ' active' : ''}`}
        title={t('dashboard.view2D')}
        tabIndex={tabIndex}
        onClick={() => onSetChartView('2d')}
      >2D</button>
    </div>
  );
}

// Unifies the four dashboard chart controls that used to be scattered across
// the page header, the chart card's own mini-header, and floating overlays
// inside MetricSurface3D's canvas: model legend, usage hint, refresh, and the
// 2D/3D toggle. Laid out as a vertical rail down the chart card's right edge so
// the chart body keeps the card's full height — a horizontal bar on top stole
// ~40px of chart height on every viewport.
//
// The rail always stays mounted (collapsing only toggles a class + CSS
// transition, it used to be an unmount) so collapse/expand animates instead of
// snapping. A second, always-mounted overlay (`.dash-chart-collapsed-controls`,
// absolutely positioned — flex items with position:absolute drop out of
// .dash-chart-card's row layout, same trick the old standalone expand tab
// used) fades in opposite the rail and carries a compact 2D/3D toggle plus the
// expand button, so switching chart view doesn't require reopening the rail.
export default function ChartToolbar({
  title, models, hiddenModels, onToggleModel,
  chartView, onSetChartView, onRefresh, syncing,
  collapsed, onToggleCollapsed,
  hintOpen, onToggleHint,
  showCompare, comparePrev, onToggleCompare, compareDelta,
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className={`dash-chart-rail${collapsed ? ' dash-chart-rail--collapsed' : ''}`} aria-hidden={collapsed}>
        <div className="dash-chart-rail-head">
          <div className="obs-section-label dash-chart-rail-title">{title}</div>
          <button
            type="button"
            className="dash-chart-collapse-btn"
            title={t('dashboard.collapseToolbar')}
            aria-label={t('dashboard.collapseToolbar')}
            tabIndex={collapsed ? -1 : 0}
            onClick={onToggleCollapsed}
          >
            <IconCollapse />
          </button>
        </div>

        <div className="dash-chart-rail-legend">
          {models.map((model, mi) => (
            <button
              key={model}
              type="button"
              className="dash-chart-rail-legend-item"
              style={{ opacity: hiddenModels.has(model) ? 0.4 : 1 }}
              title={model === 'Other' ? t('dashboard.other') : model}
              tabIndex={collapsed ? -1 : 0}
              onClick={() => onToggleModel(model)}
            >
              <span
                className="dash-chart-rail-legend-dot"
                style={{ background: colorForModelIndex(model === 'Other' ? -1 : mi) }}
              />
              <span className="dash-chart-rail-legend-name">
                {model === 'Other' ? t('dashboard.other') : model}
              </span>
            </button>
          ))}

          <div className="dash-chart-rail-legend-separator" />

          <div className="dash-chart-rail-view-toggle">
            <ViewToggle
              chartView={chartView}
              onSetChartView={onSetChartView}
              tabIndex={collapsed ? -1 : 0}
            />
          </div>
        </div>

        <div className="dash-chart-rail-foot">
          {showCompare && (
            <button
              type="button"
              className={`obs-btn obs-btn-sm dash-chart-rail-compare${comparePrev ? ' obs-btn-active' : ''}`}
              title={t('dashboard.comparePrevToggle')}
              tabIndex={collapsed ? -1 : 0}
              onClick={onToggleCompare}
            >
              {t('dashboard.comparePrevToggle')}
              {comparePrev && typeof compareDelta === 'number' && !isNaN(compareDelta) && (
                <span style={{ marginLeft: 5, fontWeight: 600, color: compareDelta > 0 ? 'var(--error)' : 'var(--success)' }}>
                  {compareDelta > 0 ? '↑' : '↓'} {Math.abs(compareDelta).toFixed(1)}%
                </span>
              )}
            </button>
          )}

          <div className="dash-chart-rail-actions">
            <button className="obs-btn dash-chart-rail-refresh" tabIndex={collapsed ? -1 : 0} onClick={onRefresh} disabled={syncing}>
              <IconRefresh spinning={syncing} />
              {t('dashboard.refresh')}
            </button>
            <button
              type="button"
              className={`dash-chart-rail-hint-btn${hintOpen ? ' is-active' : ''}`}
              title={t('dashboard.chartHelp')}
              aria-label={t('dashboard.chartHelp')}
              aria-pressed={hintOpen}
              tabIndex={collapsed ? -1 : 0}
              onClick={onToggleHint}
            >
              {hintOpen ? <IconClose /> : <IconHelp />}
            </button>
          </div>
        </div>
      </div>

      <div className={`dash-chart-collapsed-controls${collapsed ? ' is-visible' : ''}`}>
        <ViewToggle
          chartView={chartView}
          onSetChartView={onSetChartView}
          className="dash-chart-collapsed-views"
          tabIndex={collapsed ? 0 : -1}
        />
        <button
          type="button"
          className="dash-chart-expand-tab"
          title={t('dashboard.expandToolbar')}
          aria-label={t('dashboard.expandToolbar')}
          tabIndex={collapsed ? 0 : -1}
          onClick={onToggleCollapsed}
        >
          <IconExpand />
        </button>
      </div>
    </>
  );
}
