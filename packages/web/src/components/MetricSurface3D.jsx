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
  // Zero-fill (generate_series in metrics.js) emits one row per hour for
  // every model regardless of activity — drop models with no requests in
  // any bucket so the grid only shows models that actually have data.
  const modelsWithActivity = new Set(
    modelTimeSeries.filter(r => parseInt(r.requests || 0, 10) > 0).map(r => r.model)
  );
  const models = [...modelsWithActivity]
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
// Above this many days of span (roughly the 30d/90d ranges), thin the bars
// and flatten the camera angle so front-row bars stop occluding back rows —
// see Scene's isDense derivation (spanDays, not raw bucket count, since 24h
// uses hourly buckets while 30d/90d use daily buckets).
const DENSE_THRESHOLD = 14;
const MAX_AXIS_LABELS = 7;
// OrbitControls' old minDistance (cameraDistance * 0.4) grows right along
// with cameraDistance, so at 90d the closest zoom still left the camera ~47
// units away — too far to read individual bars. Capping it at a small,
// scene-size-independent constant means you can always zoom in tight on a
// handful of bars no matter how many buckets are in view.
const MIN_CAMERA_DISTANCE = 8;
// Idle time before the camera resumes auto-rotating after a drag/zoom/pan,
// a bar hover, or a pinned tooltip — long enough to read a tooltip without
// the scene drifting under it.
const AUTO_ROTATE_IDLE_MS = 3000;
const AUTO_ROTATE_SPEED = 0.55;
// Diagonal "wave" stagger for the entrance animation: each bar's grow-in is
// delayed proportionally to its (hour, model) grid position, so the surface
// fills in sweeping from the front-left corner instead of popping in at once.
const REVEAL_STEP_MS = 14;
const HOVER_LIFT = 0.22;
const DIMMED_OPACITY = 0.32;
// Cells with no data (zero-fill buckets) render as a faint ghost box instead
// of a solid bar, so the eye reads "no activity" at a glance rather than
// mistaking them for a real (if small) value.
const EMPTY_OPACITY = 0.22;

function Bar({ targetHeight, size, color, position, isActiveCell, dimmed, hasValue, revealDelay, revealStart, onHover, onUnhover, onClick }) {
  const meshRef = useRef();
  const materialRef = useRef();
  const currentHeight = useRef(0.01);
  const currentLift = useRef(0);

  // A fresh revealStart timestamp means the grid's shape just changed (range
  // or metric switch) — snap back to zero so the stagger reveal is visible
  // again instead of just re-damping from whatever height it already had.
  useEffect(() => {
    currentHeight.current = 0.01;
  }, [revealStart]);

  useFrame((_, delta) => {
    const revealed = performance.now() - revealStart >= revealDelay;
    const targetH = revealed ? Math.max(targetHeight, 0.01) : 0.01;
    currentHeight.current = THREE.MathUtils.damp(currentHeight.current, targetH, DAMP_LAMBDA, delta);
    currentLift.current = THREE.MathUtils.damp(currentLift.current, isActiveCell ? HOVER_LIFT : 0, DAMP_LAMBDA, delta);
    if (meshRef.current) {
      meshRef.current.scale.y = currentHeight.current;
      meshRef.current.position.y = currentHeight.current / 2 + currentLift.current;
    }
    if (materialRef.current) {
      const targetOpacity = isActiveCell ? 1 : dimmed ? DIMMED_OPACITY : (hasValue ? 1 : EMPTY_OPACITY);
      materialRef.current.opacity = THREE.MathUtils.damp(materialRef.current.opacity, targetOpacity, DAMP_LAMBDA, delta);
      materialRef.current.emissiveIntensity = THREE.MathUtils.damp(materialRef.current.emissiveIntensity, isActiveCell ? 0.6 : 0, DAMP_LAMBDA, delta);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], 0, position[2]]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(); }}
      onPointerOut={(e) => { e.stopPropagation(); onUnhover(); }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <boxGeometry args={[size, 1, size]} />
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        emissive={color}
        emissiveIntensity={0}
        roughness={0.32}
        metalness={0.15}
        transparent
        opacity={1}
      />
    </mesh>
  );
}

// Floor ring under the active (hovered or pinned) bar — a lightweight focus
// indicator that pulses gently so it reads clearly against the grid even
// when the camera is auto-rotating.
function FocusRing({ x, z, color }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 3) * 0.08;
    ref.current.scale.set(pulse, pulse, 1);
  });
  return (
    <mesh ref={ref} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.5, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} />
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
function Scene({ grid, metric, xLabels, palette, gridSpan, cameraDistance, barSize, controlsRef, hovered, pinned, onHoverChange, onUnhoverChange, onPinToggle, onDragStart, onDragEnd }) {
  const { hours, models, values, max } = grid;
  const [autoRotate, setAutoRotate] = useState(true);
  const idleTimerRef = useRef(null);

  const pauseAutoRotate = () => {
    clearTimeout(idleTimerRef.current);
    setAutoRotate(false);
  };
  const scheduleAutoRotate = () => {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setAutoRotate(true), AUTO_ROTATE_IDLE_MS);
  };

  useEffect(() => {
    scheduleAutoRotate();
    return () => clearTimeout(idleTimerRef.current);
  }, []);

  // Keep rotation paused for as long as a tooltip is pinned open, regardless
  // of whether OrbitControls itself fired a start/end (a plain click may not).
  useEffect(() => {
    if (pinned) pauseAutoRotate(); else scheduleAutoRotate();
  }, [pinned]);

  // structureKey changes only when the set of buckets/models changes (range
  // or filter switch) — NOT on every value update from a live socket refetch,
  // which would otherwise replay the grow-in animation on every new metric.
  const structureKey = `${hours.join(',')}|${models.join(',')}`;
  const revealStartRef = useRef(performance.now());
  const prevStructureKeyRef = useRef(structureKey);
  if (structureKey !== prevStructureKeyRef.current) {
    prevStructureKeyRef.current = structureKey;
    revealStartRef.current = performance.now();
  }

  const offsetX = -((hours.length - 1) * SPACING) / 2;
  const offsetZ = -((models.length - 1) * SPACING) / 2;
  // Labels sit one step beyond the last model row, on the +Z side — that's
  // the edge nearest the default camera corner (see cameraYRatio/position in
  // MetricSurface3D), so they read in the foreground instead of being
  // occluded by the bar field.
  const labelZ = offsetZ + models.length * SPACING;
  const labelIndices = pickLabelIndices(hours.length);

  // Hover always previews on top of a pin (the mouse is literally over it);
  // otherwise fall back to whatever's pinned.
  const active = hovered || pinned;

  return (
    <>
      {/* No flat scene background here on purpose — Canvas is transparent
          (gl alpha) so the CSS gradient on .ms3d-wrap shows through instead
          of a plain fill. Fog fades the grid/bars toward that same surface
          tone at distance, blending the geometry into the gradient instead
          of cutting off at a hard edge. */}
      <fog attach="fog" args={[palette.surface, cameraDistance * 0.9, cameraDistance * 2.3]} />
      <hemisphereLight args={[palette.text, palette.surface, 0.3]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 10, 6]} intensity={0.75} />
      <directionalLight position={[-7, 5, -6]} intensity={0.3} color={palette.accent} />
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
          const ratio = value / max;
          const height = ratio * MAX_HEIGHT;
          const x = offsetX + hi * SPACING;
          const z = offsetZ + mi * SPACING;
          const key = `${mi}-${hi}`;
          const hasValue = value > 0;
          // Taller/higher-value bars stay fully saturated; low-value bars fade
          // toward the scene surface color, so magnitude reads through color
          // as well as height. Zero-value cells fade much further — they're a
          // placeholder marker, not a real (if small) data point.
          const barColor = new THREE.Color(colorForModelIndex(model === 'Other' ? -1 : mi))
            .lerp(new THREE.Color(palette.surface), hasValue ? (1 - ratio) * 0.45 : 0.78);
          const cellInfo = { key, model, hour: xLabels[hi] ?? '', value, x, z, height, color: barColor };
          const isActiveCell = !!active && active.key === key;
          const isActiveRow = !!active && active.model === model;
          return (
            <Bar
              key={key}
              targetHeight={height}
              size={barSize}
              color={barColor}
              position={[x, 0, z]}
              isActiveCell={isActiveCell}
              dimmed={!!active && !isActiveRow}
              hasValue={hasValue}
              revealDelay={(hi + mi) * REVEAL_STEP_MS}
              revealStart={revealStartRef.current}
              onHover={() => { onHoverChange(cellInfo); pauseAutoRotate(); }}
              onUnhover={() => { onUnhoverChange(key); scheduleAutoRotate(); }}
              onClick={() => onPinToggle(cellInfo)}
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
      {active && <FocusRing x={active.x} z={active.z} color={active.color} />}
      {active && (
        // Anchored to this bar's own height (not a fixed MAX_HEIGHT) — a
        // fixed anchor left the tooltip floating far above short bars,
        // reading as detached/misplaced instead of pointing at the bar.
        <Html position={[active.x, active.height + 0.55, active.z]} center style={{ pointerEvents: 'none' }}>
          <div className={`ms3d-tooltip${pinned && pinned.key === active.key ? ' ms3d-tooltip--pinned' : ''}`}>
            <div className="ms3d-tooltip-model">{active.model}</div>
            <div className="ms3d-tooltip-bucket">{active.hour}</div>
            <div className="ms3d-tooltip-value">{formatMetricValue(active.value, metric)}</div>
          </div>
        </Html>
      )}
      <OrbitControls
        ref={controlsRef}
        enablePan
        autoRotate={autoRotate}
        autoRotateSpeed={AUTO_ROTATE_SPEED}
        onStart={() => { pauseAutoRotate(); onDragStart(); }}
        onEnd={() => { scheduleAutoRotate(); onDragEnd(); }}
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
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [dragging, setDragging] = useState(false);
  // Hovering/pinning a bar or dragging the camera all count as "interacting
  // with the 3D view" — the legend and controls-help overlays fade out for
  // that duration so they don't sit on top of what the user is looking at.
  const interacting = !!(hovered || pinned || dragging);

  const handlePinToggle = (cellInfo) => {
    setPinned(prev => (prev && prev.key === cellInfo.key ? null : cellInfo));
  };

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
  // Density must key off the actual time span (days), not raw bucket count:
  // 24h uses hourly buckets (25 buckets for ~1 day) while 30d/90d use daily
  // buckets (30/90 buckets for 30/90 days) — comparing bucket counts directly
  // against DENSE_THRESHOLD misclassified 24h (25 buckets) as dense, shrinking
  // bars and flattening the camera even with a single real data point.
  const spanDays = grid.hours.length > 1
    ? (new Date(grid.hours[grid.hours.length - 1]) - new Date(grid.hours[0])) / 86_400_000
    : 0;
  const isDense = spanDays > DENSE_THRESHOLD;
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
        gl={{ alpha: true }}
        camera={{ position: [cameraDistance * 0.7, cameraDistance * cameraYRatio, cameraDistance * 0.7], fov: 45 }}
        onPointerMissed={() => setPinned(null)}
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
          hovered={hovered}
          pinned={pinned}
          onHoverChange={setHovered}
          onUnhoverChange={(key) => setHovered(prev => (prev && prev.key === key ? null : prev))}
          onPinToggle={handlePinToggle}
          onDragStart={() => setDragging(true)}
          onDragEnd={() => setDragging(false)}
        />
      </Canvas>

      <div className={`ms3d-legend${interacting ? ' ms3d-panel--hidden' : ''}`}>
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

      <div className={`ms3d-controls-card${interacting ? ' ms3d-panel--hidden' : ''}`}>
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
        <div className="ms3d-controls-row">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 9V4.5a1.5 1.5 0 0 1 3 0V9" />
            <path d="M12 9V3.5a1.5 1.5 0 0 1 3 0V9" />
            <path d="M15 9.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-2c-2.5 0-3.5-1-5-3l-2.7-4a1.4 1.4 0 0 1 2-2L6 12" />
          </svg>
          {t('dashboard.controlClick')}
        </div>
      </div>
    </div>
  );
}
