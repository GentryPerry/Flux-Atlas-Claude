import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { Stage, Layer, Image as KImage, Circle, Text, Group, Rect, Line, Shape } from 'react-konva';
import useMapStore from '../../stores/mapStore';
import useNodeStore from '../../stores/nodeStore';
import useConnectionStore from '../../stores/connectionStore';
import useCampaignStore from '../../stores/campaignStore';
import useTerritoryStore from '../../stores/territoryStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';

const TYPE_COLORS = {
  character: '#c084fc',
  location: '#60a5fa',
  faction: '#fb923c',
  religion: '#fbbf24',
  event: '#f87171',
  realm: '#e879a8',
  thing: '#4ade80',
};

const NODE_RADIUS = 20;

/** Compute bezier curve control point offset based on distance */
function getCurveOffset(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.min(dist * 0.25, 80);
}

/** Check if a node's primary status flag is "off" (dead/ruined/disbanded/etc) */
function isNodeInactive(node) {
  const schema = NODE_TYPES[node.type];
  if (!schema?.statusFlags || !node.statusFlags) return false;
  const primaryFlag = Object.keys(schema.statusFlags).find((k) => k !== 'revealed');
  return primaryFlag ? !node.statusFlags[primaryFlag] : false;
}

/**
 * Individual map node — memoized to prevent re-render when sibling nodes change.
 * Only re-renders when this specific node's canvas-relevant data changes.
 */
const MapNode = memo(({ id, x, y, type, name, isSelected, isInactive, isHidden, onDragEnd, onClick, onContextMenu }) => {
  const color = TYPE_COLORS[type] || '#8890a0';

  return (
    <Group
      x={x}
      y={y}
      draggable
      onDragEnd={(e) => onDragEnd(id, e)}
      onClick={(e) => onClick(id, e)}
      onTap={(e) => onClick(id, e)}
      onContextMenu={(e) => onContextMenu(id, e)}
    >
      {/* Selection outer glow */}
      {isSelected && (
        <>
          <Circle radius={NODE_RADIUS + 8} fill="transparent" stroke={color} strokeWidth={1.5} opacity={0.2} />
          <Circle radius={NODE_RADIUS + 3} fill="transparent" stroke={color} strokeWidth={2} opacity={0.6} />
        </>
      )}

      {/* Node body */}
      <Circle
        radius={NODE_RADIUS}
        fill="#181a24"
        stroke={color}
        strokeWidth={2.5}
        shadowForStrokeEnabled={false}
        shadowColor={isSelected ? color : undefined}
        shadowBlur={isSelected ? 16 : 0}
        shadowOpacity={isSelected ? 0.4 : 0}
      />

      {/* Inner accent */}
      <Circle radius={6} fill={color} opacity={isSelected ? 0.9 : 0.5} />

      {/* Inactive indicator */}
      {isInactive && (
        <Group x={NODE_RADIUS - 4} y={-NODE_RADIUS + 2}>
          <Circle radius={7} fill="#181a24" />
          <Circle radius={5} fill="#f87171" opacity={0.8} />
          <Text text="x" fontSize={8} fill="#fff" x={-3} y={-4} fontStyle="bold" />
        </Group>
      )}

      {/* Hidden indicator */}
      {isHidden && (
        <Group x={-NODE_RADIUS + 4} y={-NODE_RADIUS + 2}>
          <Circle radius={5} fill="#181a24" />
          <Circle radius={4} fill="#555d6e" opacity={0.6} />
        </Group>
      )}

      {/* Label */}
      <Text
        text={name}
        fontSize={11}
        fontFamily="Inter, sans-serif"
        fill="#eaedf3"
        y={NODE_RADIUS + 8}
        align="center"
        width={120}
        offsetX={60}
        shadowColor="#000"
        shadowBlur={3}
        shadowOpacity={0.8}
        fontStyle={isSelected ? 'bold' : 'normal'}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
});
MapNode.displayName = 'MapNode';

export default function MapCanvas({
  placingType, onPlacingDone, showConnections, connectingFrom, onConnectionClick,
  onNodeContextMenu, drawingMode, setDrawingMode,
  polygonPoints, setPolygonPoints,
  selectedTerritoryId, setSelectedTerritoryId,
}) {
  const stageRef = useRef(null);
  const [bgImage, setBgImage] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const containerRef = useRef(null);

  const activeMapId = useMapStore((s) => s.activeMapId);
  const allMaps = useMapStore((s) => s.maps);
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);
  const selectNode = useNodeStore((s) => s.selectNode);
  const deselectNode = useNodeStore((s) => s.deselectNode);
  const createNode = useNodeStore((s) => s.createNode);
  const moveNode = useNodeStore((s) => s.moveNode);
  const allConnections = useConnectionStore((s) => s.connections);
  const allTerritories = useTerritoryStore((s) => s.territories);
  const createTerritory = useTerritoryStore((s) => s.createTerritory);

  const activeMap = useMemo(
    () => allMaps.find((m) => m.id === activeMapId) || null,
    [allMaps, activeMapId]
  );

  /**
   * CRITICAL PERFORMANCE: Extract only canvas-relevant data from nodes.
   * This prevents MapNode re-renders when description/tags/images change.
   * We create a stable projection that only changes when x/y/type/name/statusFlags change.
   */
  const canvasNodes = useMemo(() => {
    return allNodes
      .filter((n) => n.mapId === activeMapId)
      .map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        type: n.type,
        name: n.fields?.name || n.type,
        isInactive: isNodeInactive(n),
        isHidden: n.statusFlags ? !n.statusFlags.revealed : false,
      }));
  }, [allNodes, activeMapId]);

  const connections = useMemo(() => {
    const nodeIds = new Set(canvasNodes.map((n) => n.id));
    return allConnections.filter((c) => nodeIds.has(c.nodeAId) && nodeIds.has(c.nodeBId));
  }, [allConnections, canvasNodes]);

  const territories = useMemo(
    () => allTerritories.filter((t) => t.mapId === activeMapId),
    [allTerritories, activeMapId]
  );

  // Load background image
  useEffect(() => {
    if (!activeMap?.image) { setBgImage(null); return; }
    const img = new window.Image();
    img.onload = () => setBgImage(img);
    img.src = activeMap.image;
  }, [activeMap?.image]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setStageSize({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);


  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.1, Math.min(5, oldScale * (1 + direction * 0.1)));
    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [stageScale, stagePos]);

  // Click on canvas — place node, add polygon point, or deselect
  const handleStageClick = useCallback((e) => {
    const targetName = e.target?.name?.() || '';
    const isStage = e.target === e.currentTarget;
    const isBg = targetName === 'bg-image' || targetName === 'bg-rect';
    const isTerritory = targetName.startsWith('territory-');

    if (!isStage && !isBg && !isTerritory) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    const x = (pointer.x - stagePos.x) / stageScale;
    const y = (pointer.y - stagePos.y) / stageScale;

    if (drawingMode === 'polygon') {
      // Just add the point — finishing is done via the Finish button
      setPolygonPoints((prev) => [...prev, { x, y }]);
    } else if (placingType) {
      createNode(campaignId, activeMapId, placingType, x, y);
      onPlacingDone();
    } else if (isTerritory) {
      // Click on a territory shape → select it
      const territoryId = targetName.replace('territory-', '');
      setSelectedTerritoryId?.(territoryId);
    } else {
      setSelectedTerritoryId?.(null);
      deselectNode();
    }
  }, [placingType, drawingMode, campaignId, activeMapId, createNode, onPlacingDone, deselectNode, stagePos, stageScale, setPolygonPoints, setSelectedTerritoryId]);

  const handleNodeDragEnd = useCallback((nodeId, e) => {
    moveNode(campaignId, nodeId, e.target.x(), e.target.y());
  }, [campaignId, moveNode]);

  const handleNodeClick = useCallback((nodeId, e) => {
    e.cancelBubble = true;
    if (connectingFrom) {
      onConnectionClick(nodeId);
    } else {
      selectNode(nodeId);
    }
  }, [selectNode, connectingFrom, onConnectionClick]);

  const handleNodeRightClick = useCallback((nodeId, e) => {
    e.evt.preventDefault();
    e.cancelBubble = true;
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container().getBoundingClientRect();
    const pointer = stage.getPointerPosition();
    onNodeContextMenu?.(nodeId, container.left + pointer.x, container.top + pointer.y);
  }, [onNodeContextMenu]);

  // Build node lookup for connections
  const nodeMap = useMemo(() => {
    const m = {};
    for (const n of canvasNodes) m[n.id] = n;
    return m;
  }, [canvasNodes]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        cursor: placingType ? 'crosshair' : drawingMode === 'polygon' ? 'crosshair' : connectingFrom ? 'pointer' : 'default',
        borderRadius: 'var(--radius)',
      }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        draggable={!placingType && drawingMode !== 'polygon'}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onContextMenu={(e) => {
          if (drawingMode === 'polygon' && polygonPoints.length > 0) {
            e.evt.preventDefault();
            setPolygonPoints((prev) => prev.slice(0, -1));
          }
        }}
      >
        <Layer>
          {/* Background */}
          {bgImage ? (
            <KImage image={bgImage} name="bg-image" listening={true} perfectDrawEnabled={false} />
          ) : (
            <Rect name="bg-rect" x={-3000} y={-3000} width={6000} height={6000} fill="#0c0e14" listening={true} />
          )}

          {/* Territories */}
          {territories.map((territory) => {
            const isSel = territory.id === selectedTerritoryId;
            if (territory.shapeType === 'polygon') {
              const flatPoints = [];
              for (const p of territory.points) flatPoints.push(p.x, p.y);
              return (
                <Line
                  key={territory.id}
                  name={`territory-${territory.id}`}
                  points={flatPoints}
                  closed={true}
                  fill={territory.color}
                  opacity={isSel ? 0.35 : territory.opacity}
                  stroke={isSel ? '#fff' : territory.strokeColor}
                  strokeWidth={isSel ? 3 : territory.strokeWidth}
                  listening={true}
                  perfectDrawEnabled={false}
                  hitStrokeWidth={10}
                />
              );
            } else if (territory.shapeType === 'rectangle') {
              return (
                <Rect
                  key={territory.id}
                  name={`territory-${territory.id}`}
                  x={territory.x} y={territory.y}
                  width={territory.width} height={territory.height}
                  fill={territory.color}
                  opacity={isSel ? 0.35 : territory.opacity}
                  stroke={isSel ? '#fff' : territory.strokeColor}
                  strokeWidth={isSel ? 3 : territory.strokeWidth}
                  listening={true} perfectDrawEnabled={false}
                />
              );
            } else if (territory.shapeType === 'circle') {
              return (
                <Circle
                  key={territory.id}
                  name={`territory-${territory.id}`}
                  x={territory.center?.cx || 0} y={territory.center?.cy || 0}
                  radius={territory.radius}
                  fill={territory.color}
                  opacity={isSel ? 0.35 : territory.opacity}
                  stroke={isSel ? '#fff' : territory.strokeColor}
                  strokeWidth={isSel ? 3 : territory.strokeWidth}
                  listening={true} perfectDrawEnabled={false}
                />
              );
            }
            return null;
          })}

          {/* Polygon preview while drawing */}
          {drawingMode === 'polygon' && polygonPoints.length > 0 && (
            <>
              <Line
                points={polygonPoints.flatMap((p) => [p.x, p.y])}
                stroke="#7b9bff"
                strokeWidth={2}
                opacity={0.7}
                dash={[8, 4]}
                listening={false}
              />
              {/* Close preview line from last point to first */}
              {polygonPoints.length >= 3 && (
                <Line
                  points={[
                    polygonPoints[polygonPoints.length - 1].x,
                    polygonPoints[polygonPoints.length - 1].y,
                    polygonPoints[0].x,
                    polygonPoints[0].y,
                  ]}
                  stroke="#7b9bff"
                  strokeWidth={1}
                  opacity={0.3}
                  dash={[4, 6]}
                  listening={false}
                />
              )}
            </>
          )}
          {drawingMode === 'polygon' && polygonPoints.map((p, i) => (
            <Circle
              key={`pp-${i}`}
              x={p.x} y={p.y}
              radius={i === 0 ? 7 : 5}
              fill={i === 0 ? '#7b9bff' : '#8890a0'}
              stroke={i === 0 ? '#fff' : undefined}
              strokeWidth={i === 0 ? 1.5 : 0}
              opacity={0.8}
              listening={false}
            />
          ))}

          {/* Connections */}
          {showConnections && connections.map((conn) => {
            const a = nodeMap[conn.nodeAId];
            const b = nodeMap[conn.nodeBId];
            if (!a || !b) return null;
            const color = conn.color || '#6e8efb';
            const offset = getCurveOffset(a.x, a.y, b.x, b.y);
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const cpx = (a.x + b.x) / 2 + nx * offset * 0.4;
            const cpy = (a.y + b.y) / 2 + ny * offset * 0.4;

            return (
              <Shape
                key={conn.id}
                sceneFunc={(ctx) => {
                  ctx.beginPath();
                  ctx.moveTo(a.x, a.y);
                  ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
                  ctx.strokeStyle = color;
                  ctx.lineWidth = 2;
                  ctx.globalAlpha = 0.5;
                  if (!conn.directional) ctx.setLineDash([6, 4]);
                  ctx.stroke();
                  ctx.setLineDash([]);
                  ctx.globalAlpha = 1;
                  if (conn.directional) {
                    const angle = Math.atan2(b.y - cpy, b.x - cpx);
                    const arrowLen = 10;
                    ctx.beginPath();
                    ctx.moveTo(b.x, b.y);
                    ctx.lineTo(b.x - arrowLen * Math.cos(angle - 0.4), b.y - arrowLen * Math.sin(angle - 0.4));
                    ctx.moveTo(b.x, b.y);
                    ctx.lineTo(b.x - arrowLen * Math.cos(angle + 0.4), b.y - arrowLen * Math.sin(angle + 0.4));
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.6;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                  }
                }}
                listening={false}
                perfectDrawEnabled={false}
              />
            );
          })}

          {/* Nodes — each memoized individually */}
          {canvasNodes.map((node) => (
            <MapNode
              key={node.id}
              id={node.id}
              x={node.x}
              y={node.y}
              type={node.type}
              name={node.name}
              isSelected={node.id === selectedNodeId}
              isInactive={node.isInactive}
              isHidden={node.isHidden}
              onDragEnd={handleNodeDragEnd}
              onClick={handleNodeClick}
              onContextMenu={handleNodeRightClick}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
