import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Grid, ContactShadows, Text, Billboard } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import { readChartPalette, colorForModelIndex } from '../utils/chartColors';
import { buildGrid, formatMetricValue } from '../utils/metricGrid';
import * as THREE from 'three';

const BAR_SIZE = 0.62;
const SPACING  = 0.9;
const MAX_HEIGHT = 3.6;
// A day with real (if comparatively tiny) activity would otherwise scale to a
// near-zero height next to a much larger max in the same grid — e.g. a demo
// dataset that ramps up over 30 days makes early days ~1.5% of the tallest
// bar, which rounds to a sliver indistinguishable from the true-zero ghost
// cells. Flooring nonzero bars to a small but visible height keeps "small
// but real" and "no data" readable apart; color saturation (still driven by
// the true ratio) is what still communicates relative magnitude.
const MIN_VISIBLE_HEIGHT = MAX_HEIGHT * 0.035;
const DAMP_LAMBDA = 6;
// Above this many days of span (roughly the 30d/90d ranges), thin the bars
// and flatten the camera angle so front-row bars stop occluding back rows —
// see Scene's isDense derivation (spanDays, not raw bucket count, since 24h
// uses hourly buckets while 30d/90d use daily buckets).
const DENSE_THRESHOLD = 14;
const MAX_AXIS_LABELS = 7;
// Axis label font size was a fixed 0.32 world units — fine at 7d (gridSpan
// ~7), but the same absolute size reads as illegibly tiny once the camera
// pulls back for 30d/90d (gridSpan up to ~80+), since the labels shrink
// relative to everything else in the scene without this. BASE_LABEL_GRID_SPAN
// is the gridSpan where 0.32 was tuned to look right (roughly the default 7d
// view) — scaling by sqrt keeps the growth sub-linear so 90d labels stay
// legible without ballooning past the bars.
const BASE_LABEL_FONT_SIZE = 0.32;
const BASE_LABEL_GRID_SPAN = 7.2;
// OrbitControls' old minDistance (cameraDistance * 0.4) grows right along
// with cameraDistance, so at 90d the closest zoom still left the camera ~47
// units away — too far to read individual bars. Capping it at a small,
// scene-size-independent constant means you can always zoom in tight on a
// handful of bars no matter how many buckets are in view.
const MIN_CAMERA_DISTANCE = 8;
// The default camera distance grows with gridSpan, which is right for 24h/7d
// but wrong for 30d/90d: those ranges pack many more (already-thinned, see
// isDense) bars into view, so pulling the default framing *closer* — not
// farther — is what keeps individual bars legible and clickable. 90d needs
// to start closer still than 30d since it's the densest range. Keyed off the
// selected range directly (not a data-derived span) so the zoom level is
// predictable regardless of how much of that range actually has data.
const ZOOM_FACTOR_BY_RANGE = { '24h': 1, '7d': 1, '30d': 0.6, '90d': 0.36 };
// Companion floor for OrbitControls' minDistance — 30d/90d need to allow
// zooming in tighter than the shared MIN_CAMERA_DISTANCE, not just start
// closer, since their bars are thinner (isDense) and closer inspection is
// what makes them individually readable/clickable.
const MIN_CAMERA_DISTANCE_BY_RANGE = { '24h': MIN_CAMERA_DISTANCE, '7d': MIN_CAMERA_DISTANCE, '30d': 5.5, '90d': 3.5 };
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

// xLabels is indexed by the same position as the untrimmed bucket list —
// safe because both come from queries sharing the exact same
// tsSeriesStart/tsSeriesEnd/bucketUnit zero-fill (metrics.js summary route),
// so they always produce the same bucket count in the same order. Since
// buildGrid trims leading/trailing empty buckets, every grid.hours index hi
// must be offset by grid.labelOffset to land back on the right xLabels entry.
// `?? ''` below is just a guard, not the real defense.
function Scene({ grid, metric, xLabels, palette, gridSpan, cameraDistance, minCameraDistance, barSize, labelFontSize, controlsRef, hovered, pinned, onHoverChange, onUnhoverChange, onPinToggle, hiddenModels }) {
  const { hours, models, values, max, labelOffset } = grid;
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
        hiddenModels.has(model) ? null : values[mi].map((value, hi) => {
          const ratio = value / max;
          const height = value > 0 ? Math.max(ratio * MAX_HEIGHT, MIN_VISIBLE_HEIGHT) : ratio * MAX_HEIGHT;
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
          const cellInfo = { key, model, hour: xLabels[labelOffset + hi] ?? '', value, x, z, height, color: barColor };
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
          <Text fontSize={labelFontSize} color={palette.text} anchorX="center" anchorY="middle">
            {xLabels[labelOffset + hi] ?? ''}
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
        onStart={pauseAutoRotate}
        onEnd={scheduleAutoRotate}
        minDistance={Math.min(cameraDistance * 0.4, minCameraDistance)}
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

export default function MetricSurface3D({ modelTimeSeries, metric, xLabels, loading, range, hiddenModels = new Set() }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const controlsRef = useRef();
  const grid = useMemo(() => buildGrid(modelTimeSeries || [], metric), [modelTimeSeries, metric]);
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);

  const handlePinToggle = (cellInfo) => {
    setPinned(prev => (prev && prev.key === cellInfo.key ? null : cellInfo));
  };

  const totalActivity = grid.values.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  // >= 1, not > 1: buildGrid now trims leading/trailing empty buckets, so a
  // range with a single real day of activity legitimately collapses to one
  // column — that's still real data worth showing, not "not enough data".
  const hasEnoughData = grid.hours.length >= 1 && totalActivity > 0;

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
  const zoomFactor = ZOOM_FACTOR_BY_RANGE[range] ?? 1;
  const minCameraDistance = MIN_CAMERA_DISTANCE_BY_RANGE[range] ?? MIN_CAMERA_DISTANCE;
  const cameraDistance = (gridSpan * 1.4 + 5) * zoomFactor;
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
  const labelFontSize = Math.max(
    BASE_LABEL_FONT_SIZE,
    BASE_LABEL_FONT_SIZE * Math.sqrt(gridSpan / BASE_LABEL_GRID_SPAN)
  );

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
          labelFontSize={labelFontSize}
          cameraDistance={cameraDistance}
          minCameraDistance={minCameraDistance}
          barSize={barSize}
          controlsRef={controlsRef}
          hovered={hovered}
          pinned={pinned}
          onHoverChange={setHovered}
          onUnhoverChange={(key) => setHovered(prev => (prev && prev.key === key ? null : prev))}
          onPinToggle={handlePinToggle}
          hiddenModels={hiddenModels}
        />
      </Canvas>

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
    </div>
  );
}
