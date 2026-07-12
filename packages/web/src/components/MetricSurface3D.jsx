import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Grid } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import { formatCost, fmtLatency } from '../utils/fmt';
import { readChartPalette, colorForModelIndex } from '../utils/chartColors';
import * as THREE from 'three';

function fmtCompact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function formatMetricValue(value, metric) {
  switch (metric) {
    case 'cost':      return formatCost(value);
    case 'latency':   return fmtLatency(value);
    case 'errorRate': return `${(value * 100).toFixed(1)}%`;
    default:          return fmtCompact(value);
  }
}

function extractMetric(row, metric) {
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

function buildGrid(modelTimeSeries, metric) {
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

function Bar({ targetHeight, color, position, onHover, onUnhover }) {
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
      <boxGeometry args={[BAR_SIZE, 1, BAR_SIZE]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// xLabels is indexed by the same position as grid.hours — safe because both
// come from queries sharing the exact same tsSeriesStart/tsSeriesEnd/bucketUnit
// zero-fill (metrics.js summary route), so they always produce the same bucket
// count in the same order. `?? ''` below is just a guard, not the real defense.
function Scene({ grid, metric, xLabels, palette }) {
  const { hours, models, values, max } = grid;
  const [hovered, setHovered] = useState(null);

  const offsetX = -((hours.length - 1) * SPACING) / 2;
  const offsetZ = -((models.length - 1) * SPACING) / 2;
  const gridSpan = Math.max(hours.length, models.length, 1) * SPACING;
  const cameraDistance = gridSpan * 1.4 + 5;

  return (
    <>
      <color attach="background" args={[palette.surface]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 10, 6]} intensity={0.7} />
      <Grid
        args={[gridSpan + 2, gridSpan + 2]}
        position={[0, 0, 0]}
        cellColor={palette.border}
        sectionColor={palette.border}
        fadeDistance={cameraDistance * 2}
        infiniteGrid={false}
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
              color={colorForModelIndex(model === 'Other' ? -1 : mi)}
              position={[x, 0, z]}
              onHover={() => setHovered({ key, model, hour: xLabels[hi] ?? '', value, x, z })}
              onUnhover={() => setHovered(prev => (prev && prev.key === key ? null : prev))}
            />
          );
        })
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
        enablePan={false}
        minDistance={cameraDistance * 0.4}
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

  return (
    <div className="ms3d-wrap">
      <Canvas
        resize={{ scroll: false, debounce: 0 }}
        dpr={[1, 2]}
        camera={{ position: [cameraDistance * 0.7, cameraDistance * 0.55, cameraDistance * 0.7], fov: 45 }}
      >
        <Scene grid={grid} metric={metric} xLabels={xLabels} palette={palette} />
      </Canvas>

      <div className="ms3d-legend">
        {grid.models.map((model, mi) => (
          <span key={model} className="ms3d-legend-item">
            <span className="ms3d-legend-dot" style={{ background: colorForModelIndex(model === 'Other' ? -1 : mi) }} />
            {model === 'Other' ? t('dashboard.other') : model}
          </span>
        ))}
      </div>

      <div className="ms3d-hint">{t('dashboard.rotateHint')}</div>
    </div>
  );
}
