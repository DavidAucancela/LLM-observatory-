import React, { useState, useRef, useEffect } from 'react';
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

function IconRefresh({ spinning }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

// Points "up" — collapsing tucks the toolbar away above the chart body.
function IconCollapse() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

// Points "down" — used on the floating expand tab left behind once the
// toolbar is collapsed, so its direction reads as "bring the bar back".
export function IconExpand() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Same rotate/zoom/pan/click iconography that used to live in
// MetricSurface3D's always-on .ms3d-controls-card overlay — now only shown
// inside this popover, and only for the 3D view (2D has no camera controls).
function HelpPopover({ chartView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="dash-chart-toolbar-hint" ref={ref}>
      <button
        type="button"
        className="dash-chart-toolbar-hint-btn"
        title={t('dashboard.chartHelp')}
        aria-label={t('dashboard.chartHelp')}
        onClick={() => setOpen(o => !o)}
      >
        <IconHelp />
      </button>
      {open && (
        <div className="dash-chart-toolbar-hint-panel">
          <div className="dash-chart-toolbar-hint-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 9V4.5a1.5 1.5 0 0 1 3 0V9" />
              <path d="M12 9V3.5a1.5 1.5 0 0 1 3 0V9" />
              <path d="M15 9.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-2c-2.5 0-3.5-1-5-3l-2.7-4a1.4 1.4 0 0 1 2-2L6 12" />
            </svg>
            {t('dashboard.legendClickHint')}
          </div>
          {chartView === '3d' && (
            <>
              <div className="dash-chart-toolbar-hint-row">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="7" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="17" r="1" />
                  <circle cx="15" cy="7" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="17" r="1" />
                </svg>
                {t('dashboard.controlRotate')}
              </div>
              <div className="dash-chart-toolbar-hint-row">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
                </svg>
                {t('dashboard.controlZoom')}
              </div>
              <div className="dash-chart-toolbar-hint-row">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" />
                  <polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" />
                  <line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
                </svg>
                {t('dashboard.controlPan')}
              </div>
              <div className="dash-chart-toolbar-hint-row">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="7" r="1" /><circle cx="15" cy="7" r="1" />
                </svg>
                {t('dashboard.controlClick')}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Unifies the four dashboard chart controls that used to be scattered across
// the page header, the chart card's own mini-header, and floating overlays
// inside MetricSurface3D's canvas: model legend, usage hint, refresh, and the
// 2D/3D toggle. Collapsing this bar (Dashboard.jsx) removes it from the flex
// flow entirely so the chart body grows to fill the card.
export default function ChartToolbar({
  title, models, hiddenModels, onToggleModel,
  chartView, onSetChartView, onRefresh, syncing, onToggleCollapsed,
  showCompare, comparePrev, onToggleCompare, compareDelta,
}) {
  const { t } = useTranslation();

  return (
    <div className="dash-chart-toolbar">
      <div className="obs-section-label dash-chart-toolbar-title">{title}</div>

      <div className="dash-chart-toolbar-legend">
        {models.map((model, mi) => (
          <button
            key={model}
            type="button"
            className="dash-chart-toolbar-legend-item"
            style={{ opacity: hiddenModels.has(model) ? 0.4 : 1 }}
            onClick={() => onToggleModel(model)}
          >
            <span
              className="dash-chart-toolbar-legend-dot"
              style={{ background: colorForModelIndex(model === 'Other' ? -1 : mi) }}
            />
            {model === 'Other' ? t('dashboard.other') : model}
          </button>
        ))}
      </div>

      <HelpPopover chartView={chartView} />

      {showCompare && (
        <button
          type="button"
          className={`obs-btn obs-btn-sm${comparePrev ? ' obs-btn-active' : ''}`}
          title={t('dashboard.comparePrevToggle')}
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

      <div className="obs-range-picker">
        <button
          className={`obs-range-btn${chartView === '3d' ? ' active' : ''}`}
          title={t('dashboard.view3D')}
          onClick={() => onSetChartView('3d')}
        >3D</button>
        <button
          className={`obs-range-btn${chartView === '2d' ? ' active' : ''}`}
          title={t('dashboard.view2D')}
          onClick={() => onSetChartView('2d')}
        >2D</button>
      </div>

      <button className="obs-btn" onClick={onRefresh} disabled={syncing}>
        <IconRefresh spinning={syncing} />
        {t('dashboard.refresh')}
      </button>

      <button
        type="button"
        className="dash-chart-collapse-btn"
        title={t('dashboard.collapseToolbar')}
        aria-label={t('dashboard.collapseToolbar')}
        onClick={onToggleCollapsed}
      >
        <IconCollapse />
      </button>
    </div>
  );
}
