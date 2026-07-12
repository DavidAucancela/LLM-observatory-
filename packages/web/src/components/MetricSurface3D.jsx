import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Grid, ContactShadows, Text, Billboard } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import { formatCost, fmtLatency } from '../utils/fmt';
import { readChartPalette, colorForModelIndex } from '../utils/chartColors';
import * as THREE from 'three';

function fmtCompact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

export function formatMetricValue(value, metric) {
  switch (metric) {
    case 'cost':      return formatCost(value);
    case 'latency':   return fmtLatency(value);
    case 'errorRate': return `${(value * 100).toFixed(1)}%`;
    default:          return fmtCompact(value);
  }
}

export function extractMetric(row, metric) {
  if (!row) return 0;
  const requests = parseInt(row.requests || 0, 10);
  switch (metric) {
    case 'requests':  return requests;
    case 'tokens':    return parseFloat(row.total_tokens || 0);
    case 'cost':      return parseFloat(row.cost_usd || 0);
    case 'latency':   return parseFloat(row.avg_latency_ms || 0);
    case 'errorRate': return requests > 0 ? parseInt(row.error_count || 0, 10) / requests : 0;
    default:          return 0;
  }
}

export function buildGrid(modelTimeSeries, metric) {
  const hours = [...new Set(modelTimeSeries.map(r => r.hour))].sort((a, b) => new Date(a) - new Date(b));
  const models = [...new Set(modelTimeSeries.map(r => r.model))]
    .sort((a, b) => (a === 'Other' ? 1 : 0) - (b === 'Other' ? 1 : 0));

  const cellMap = new Map();
  for (const row of modelTimeSeries) cellMap.set(`${row.hour}|${row.model}`, row);

  let max = 0;
  const values = models.map(model =>
    hours.map(hour => {
      const v = extractMetric(cellMap.get(`${hour}|${model}`), metric);
      if (v > max) max = v;
      return v;
    })
  );

  return { hours, models, values, max: max || 1 };
}

const BAR_SIZE = 0.62;
const SPACING  = 0.9;
const MAX_HEIGHT = 3.6;
const DAMP_LAMBDA = 6;
// Above this many time buckets (roughly the 30d/90d ranges), thin the bars
// and flatten the camera angle so front-row bars stop occluding back rows —
// see Scene's isDense derivation.
const DENSE_THRESHOLD = 14;
const MAX_AXIS_LABELS = 7;
// OrbitControls' old minDistance (cameraDistance * 0.4) grows right along
// with cameraDistance, so at 90d the closest zoom still left the camera ~47
// units away — too far to read individual bars. Capping it at a small,
// scene-size-independent constant means you can always zoom in tight on a
// handful of bars no matter how many buckets are in view.
const MIN_CAMERA_DISTANCE = 8;

function Bar({ targetHeight, size, color, position, onHover, onUnhover }) {
  const meshRef = useRef();
  const currentHeight = useRef(0.01);

  useFrame((_, delta) => {
    currentHeight.current = THREE.MathUtils.damp(currentHeight.current, Math.max(targetHeight, 0.01), DAMP_LAMBDA, delta);
    if (meshRef.current) {
      meshRef.current.scale.y = currentHeight.current;
      meshRef.current.position.y = currentHeight.current / 2;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], 0, position[2]]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(); }}
      onPointerOut={(e) => { e.stopPropagation(); onUnhover(); }}
    >
      <boxGeometry args={[size, 1, size]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// Picks up to MAX_AXIS_LABELS bucket indices to label on the floor: always
// the first and last bucket, plus evenly-spaced steps between — avoids
// rendering one label per bucket (unreadable clutter at 30d/90d).
function pickLabelIndices(count) {
  if (count <= 1) return [0].slice(0, count);
  const step = Math.max(1, Math.ceil(count / (MAX_AXIS_LABELS - 1)));
  const indices = new Set();
  for (let i = 0; i < count; i += step) indices.add(i);
  indices.add(count - 1);
  return [...indices].sort((a, b) => a - b);
}

// xLabels is indexed by the same position as grid.hours — safe because both
// come from queries sharing the exact same tsSeriesStart/tsSeriesEnd/bucketUnit
// zero-fill (metrics.js summary route), so they always produce the same bucket
// count in the same order. `?? ''` below is just a guard, not the real defense.
function Scene({ grid, metric, xLabels, palette, gridSpan, cameraDistance, barSize, controlsRef }) {
  const { hours, models, values, max } = grid;
  const [hovered, setHovered] = useState(null);

  const offsetX = -((hours.length - 1) * SPACING) / 2;
  const offsetZ = -((models.length - 1) * SPACING) / 2;
  // Labels sit one step beyond the last model row, on the +Z side — that's
  // the edge nearest the default camera corner (see cameraYRatio/position in
  // MetricSurface3D), so they read in the foreground instead of being
  // occluded by the bar field.
  const labelZ = offsetZ + models.length * SPACING;
  const labelIndices = pickLabelIndices(hours.length);

  return (
    <>
      <color attach="background" args={[palette.surface]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 10, 6]} intensity={0.7} />
      <Grid
        args={[gridSpan + 2, gridSpan + 2]}
        position={[0, 0, 0]}
        cellColor={palette.gridLine}
        sectionColor={palette.gridLine}
        fadeDistance={cameraDistance * 2}
        infiniteGrid={false}
      />
      <ContactShadows
        position={[0, 0.01, 0]}
        scale={gridSpan + 6}
        blur={2.4}
        far={MAX_HEIGHT}
        opacity={0.4}
        color={palette.shadow}
      />
      {models.map((model, mi) => (
        values[mi].map((value, hi) => {
          const height = (value / max) * MAX_HEIGHT;
          const x = offsetX + hi * SPACING;
          const z = offsetZ + mi * SPACING;
          const key = `${mi}-${hi}`;
          return (
            <Bar
              key={key}
              targetHeight={height}
              size={barSize}
              color={colorForModelIndex(model === 'Other' ? -1 : mi)}
              position={[x, 0, z]}
              onHover={() => setHovered({ key, model, hour: xLabels[hi] ?? '', value, x, z })}
              onUnhover={() => setHovered(prev => (prev && prev.key === key ? null : prev))}
            />
          );
        })
      ))}
      {labelIndices.map(hi => (
        <Billboard key={hi} position={[offsetX + hi * SPACING, 0.05, labelZ]}>
          <Text fontSize={0.32} color={palette.text} anchorX="center" anchorY="middle">
            {xLabels[hi] ?? ''}
          </Text>
        </Billboard>
      ))}
      {hovered && (
        <Html position={[hovered.x, MAX_HEIGHT + 0.4, hovered.z]} center style={{ pointerEvents: 'none' }}>
          <div className="ms3d-tooltip">
            <div className="ms3d-tooltip-model">{hovered.model}</div>
            <div className="ms3d-tooltip-bucket">{hovered.hour}</div>
            <div className="ms3d-tooltip-value">{formatMetricValue(hovered.value, metric)}</div>
          </div>
        </Html>
      )}
      <OrbitControls
        ref={controlsRef}
        enablePan
        minDistance={Math.min(cameraDistance * 0.4, MIN_CAMERA_DISTANCE)}
        maxDistance={cameraDistance * 1.8}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, MAX_HEIGHT / 3, 0]}
        makeDefault
      />
    </>
  );
}

// Three.js needs literal RGB baked into the scene, but the theme toggle just
// flips a CSS class on the app root (App.jsx: .theme-dark/.theme-light) —
// nothing re-renders this component on its own, so without watching for that
// class change the canvas keeps whichever palette it happened to mount with.
function useThemePalette() {
  const [palette, setPalette] = useState(() => readChartPalette());

  useEffect(() => {
    const target = document.querySelector('.theme-dark, .theme-light') || document.documentElement;
    const observer = new MutationObserver(() => setPalette(readChartPalette()));
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return palette;
}

export default function MetricSurface3D({ modelTimeSeries, metric, xLabels, loading }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const controlsRef = useRef();
  const grid = useMemo(() => buildGrid(modelTimeSeries || [], metric), [modelTimeSeries, metric]);

  const totalActivity = grid.values.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  const hasEnoughData = grid.hours.length > 1 && totalActivity > 0;

  if (loading) {
    return <div className="obs-skeleton" style={{ height: '100%', borderRadius: 4 }} />;
  }

  if (!hasEnoughData) {
    return (
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dashboard.notEnoughData')}</span>
      </div>
    );
  }

  const gridSpan = Math.max(grid.hours.length, grid.models.length, 1) * SPACING;
  const cameraDistance = gridSpan * 1.4 + 5;
  // 30d/90d cross DENSE_THRESHOLD buckets — thin the bars and flatten the
  // camera to a more overhead angle so front-row bars stop occluding back
  // rows (see Bar's `size` prop and the Canvas camera position below).
  const isDense = grid.hours.length > DENSE_THRESHOLD;
  const barSize = isDense ? BAR_SIZE * 0.6 : BAR_SIZE;
  const cameraYRatio = isDense ? 0.85 : 0.55;

  // Panning lets the user drag the OrbitControls target away from the data —
  // useful for scrubbing across many time buckets, but easy to get lost in.
  // Don't rely on OrbitControls' own reset() here: it restores whatever
  // position/target existed the moment the controls were constructed, which
  // is only this range's default framing if the user hasn't switched ranges
  // since mount (the Canvas persists across range switches, it doesn't
  // remount). Recomputing the intended position/target from the current
  // gridSpan/cameraDistance instead always reframes correctly for whatever
  // range is showing right now.
  const resetView = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(cameraDistance * 0.7, cameraDistance * cameraYRatio, cameraDistance * 0.7);
    controls.target.set(0, MAX_HEIGHT / 3, 0);
    controls.update();
  };

  return (
    <div className="ms3d-wrap">
      <Canvas
        resize={{ scroll: false, debounce: 0 }}
        dpr={[1, 2]}
        camera={{ position: [cameraDistance * 0.7, cameraDistance * cameraYRatio, cameraDistance * 0.7], fov: 45 }}
      >
        <Scene
          grid={grid}
          metric={metric}
          xLabels={xLabels}
          palette={palette}
          gridSpan={gridSpan}
          cameraDistance={cameraDistance}
          barSize={barSize}
          controlsRef={controlsRef}
        />
      </Canvas>

      <div className="ms3d-legend">
        {grid.models.map((model, mi) => (
          <span key={model} className="ms3d-legend-item">
            <span className="ms3d-legend-dot" style={{ background: colorForModelIndex(model === 'Other' ? -1 : mi) }} />
            {model === 'Other' ? t('dashboard.other') : model}
          </span>
        ))}
      </div>

      <button
        type="button"
        className="ms3d-reset-btn"
        title={t('dashboard.resetView')}
        aria-label={t('dashboard.resetView')}
        onClick={resetView}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </button>

      <div className="ms3d-controls-card">
        <div className="ms3d-controls-row">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="7" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="17" r="1" />
            <circle cx="15" cy="7" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="17" r="1" />
          </svg>
          {t('dashboard.controlRotate')}
        </div>
        <div className="ms3d-controls-row">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          {t('dashboard.controlZoom')}
        </div>
        <div className="ms3d-controls-row">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" />
            <polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" />
            <line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
          </svg>
          {t('dashboard.controlPan')}
        </div>
      </div>
    </div>
  );
}
