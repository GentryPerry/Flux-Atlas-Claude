import { useMemo } from 'react';

/**
 * MapPreviewCanvas — miniature SVG diff map for scenario review.
 *
 * Shows the resulting world state's territories, with colour coding
 * indicating what changed vs the source.
 *
 * Props:
 *   sourceWorldState     { nodes, territories }
 *   resultingWorldState  { nodes, territories }
 *   mapPreviewData       { expandedTerritoryIds, contractedTerritoryIds,
 *                          shiftedTerritoryIds, destroyedNodeIds, diedNodeIds,
 *                          territoryUpdates }
 *   width, height        canvas dimensions in px
 */
export default function MapPreviewCanvas({
  sourceWorldState,
  resultingWorldState,
  mapPreviewData,
  height = 160,
}) {
  const width = '100%';
  const { viewBox, territories, nodeMarkers } = useMemo(() => {
    const src = sourceWorldState || { nodes: [], territories: [] };
    const res = resultingWorldState || { nodes: [], territories: [] };
    const prev = mapPreviewData || {};

    // Collect all points to compute bounding box
    const allPts = [];
    const addPts = (pts) => pts?.forEach((p) => allPts.push(p));

    src.territories.forEach((t) => { if (t.shapeType === 'polygon') addPts(t.points); });
    src.nodes.forEach((n) => { if (n.x != null) allPts.push({ x: n.x, y: n.y }); });

    if (!allPts.length) {
      return { viewBox: '0 0 400 300', territories: [], nodeMarkers: [] };
    }

    const xs = allPts.map((p) => p.x);
    const ys = allPts.map((p) => p.y);
    let minX = Math.min(...xs);
    let minY = Math.min(...ys);
    let maxX = Math.max(...xs);
    let maxY = Math.max(...ys);

    // Pad 8%
    const padX = (maxX - minX) * 0.08 || 50;
    const padY = (maxY - minY) * 0.08 || 50;
    minX -= padX; minY -= padY; maxX += padX; maxY += padY;

    const vbW = maxX - minX || 400;
    const vbH = maxY - minY || 300;

    // Build change sets
    const expandedIds   = new Set(prev.expandedTerritoryIds  || []);
    const contractedIds = new Set(prev.contractedTerritoryIds || []);
    const shiftedIds    = new Set(prev.shiftedTerritoryIds    || []);
    const destroyedIds  = new Set(prev.destroyedNodeIds       || []);
    const diedIds       = new Set(prev.diedNodeIds            || []);

    // Territory updates map (id → new points)
    const updatesMap = {};
    (prev.territoryUpdates || []).forEach((u) => { updatesMap[u.id] = u.points; });

    // Determine result territory points (use updated points if available)
    const resTerrs = src.territories
      .filter((t) => t.shapeType === 'polygon' && t.points?.length > 1)
      .map((t) => {
        const points = updatesMap[t.id] || t.points;
        let changeType = null;
        if (expandedIds.has(t.id))   changeType = 'expanded';
        if (contractedIds.has(t.id)) changeType = 'contracted';
        if (shiftedIds.has(t.id))    changeType = 'shifted';
        return { ...t, previewPoints: points, changeType };
      });

    // Node markers for dead/destroyed nodes
    const markers = src.nodes
      .filter((n) => destroyedIds.has(n.id) || diedIds.has(n.id))
      .map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        type: diedIds.has(n.id) ? 'died' : 'destroyed',
      }));

    const ptsToSVG = (pts) =>
      pts.map((p) => `${p.x},${p.y}`).join(' ');

    return {
      viewBox: `${minX} ${minY} ${vbW} ${vbH}`,
      territories: resTerrs.map((t) => ({
        id: t.id,
        svgPoints: ptsToSVG(t.previewPoints),
        color: t.color || '#8890a0',
        changeType: t.changeType,
      })),
      nodeMarkers: markers,
    };
  }, [sourceWorldState, resultingWorldState, mapPreviewData]);

  // Change type → colours
  const strokeFor = (changeType, baseColor) => {
    if (changeType === 'expanded')   return '#5ae892';
    if (changeType === 'contracted') return '#f47070';
    if (changeType === 'shifted')    return '#f5b042';
    return baseColor;
  };
  const opacityFor = (changeType) => changeType ? 0.28 : 0.13;
  const strokeWidthFor = (changeType) => changeType ? 1.5 : 0.8;

  return (
    <div style={{
      width: '100%',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--border)',
      background: 'var(--bg-inset)',
      overflow: 'hidden',
    }}>
      <svg
        width="100%"
        height={height}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Base territories */}
        {territories.map((t) => (
          <polygon
            key={t.id}
            points={t.svgPoints}
            fill={t.changeType ? strokeFor(t.changeType, t.color) : t.color}
            fillOpacity={opacityFor(t.changeType)}
            stroke={strokeFor(t.changeType, t.color)}
            strokeWidth={strokeWidthFor(t.changeType)}
            strokeOpacity={0.75}
          />
        ))}

        {/* Died / destroyed markers */}
        {nodeMarkers.map((m) => (
          <g key={m.id} transform={`translate(${m.x},${m.y})`}>
            <circle
              r={6}
              fill={m.type === 'died' ? '#f47070' : '#f5b042'}
              fillOpacity={0.85}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={0.5}
            />
            {/* X mark */}
            <line x1={-3} y1={-3} x2={3} y2={3} stroke="#fff" strokeWidth={1.2} />
            <line x1={3}  y1={-3} x2={-3} y2={3} stroke="#fff" strokeWidth={1.2} />
          </g>
        ))}
      </svg>

      {/* Legend row */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.3)',
        borderTop: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
      }}>
        {[
          { color: '#5ae892', label: 'Expanded' },
          { color: '#f47070', label: 'Contracted' },
          { color: '#f5b042', label: 'Shifted' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, opacity: 0.85, display: 'inline-block', flexShrink: 0 }} />
            {label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f47070', display: 'inline-block', flexShrink: 0 }} />
          Fallen
        </span>
      </div>
    </div>
  );
}
