import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { Stage, Layer, Image as KImage, Circle, Text, Group, Rect, Line } from 'react-konva';
import Konva from 'konva';
import useMapStore from '../../stores/mapStore';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import useTerritoryStore from '../../stores/territoryStore';
import { NODE_TYPES, canNestType, MAP_MAX_DEPTH } from '../../utils/nodeSchemas';
import useSettingsStore from '../../stores/settingsStore';
import { DEFAULT_TYPE_COLORS, getTypeColor, getTypeIcon } from '../../utils/typeColors';
import { getIconImage, preloadIcons } from '../../utils/iconImages';
import TopoBackground from '../common/TopoBackground';
import useViewportStore from '../../stores/viewportStore';

/* ─── Design system helpers ─────────────────────────────────────────────── */
function hexToRgba(hex, alpha) {
  const h = (hex || '#888888').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function useIconImage(iconName, size = 16) {
  const [tick, setTick] = useState(0);
  const img = useMemo(() => getIconImage(iconName, '#ffffff', size), [iconName, size]);
  useEffect(() => {
    if (!img || img.complete) return;
    const handler = () => setTick(t => t + 1);
    img.addEventListener('load',  handler, { once: true });
    img.addEventListener('error', handler, { once: true });
    return () => {
      img.removeEventListener('load',  handler);
      img.removeEventListener('error', handler);
    };
  }, [img]);
  // eslint-disable-next-line no-unused-expressions
  tick;
  return img?.complete ? img : null;
}

/* ─── Layout constants ──────────────────────────────────────────────────── */
const NODE_RADIUS        = 20;
const FOLDER_CHILD_R     = 19;
const FOLDER_PARENT_R    = 13;
const FOLDER_CELL        = 76;
const GRID_COLS          = 3;
const GRID_ROWS          = 3;
const CELLS_PER_PAGE     = GRID_COLS * GRID_ROWS;
const FOLDER_PAD         = 16;
const NAV_H              = 32;
const MAX_SUBFOLDERS     = 5;
const FOLDER_BOX_W       = FOLDER_PAD + GRID_COLS * FOLDER_CELL + FOLDER_PAD; // 260
const NEST_HIT_R         = NODE_RADIUS * 1.9;

function getFolderBoxH(showNav) {
  return FOLDER_PAD + GRID_ROWS * FOLDER_CELL + FOLDER_PAD + (showNav ? NAV_H : 0);
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function isNodeInactive(node) {
  const schema = NODE_TYPES[node.type];
  if (!schema?.statusFlags || !node.statusFlags) return false;
  const primaryFlag = Object.keys(schema.statusFlags).find((k) => k !== 'revealed');
  return primaryFlag ? !node.statusFlags[primaryFlag] : false;
}

/* ─── MapNode ────────────────────────────────────────────────────────────
 * Standalone circle node on the canvas.
 * isRejectTarget — red "no entry" glow when an invalid nest is being attempted
 * isShaking      — triggers a short horizontal shake on the inner group
 */
const MapNode = memo(({
  id, x, y, type, name, color: colorProp, iconName,
  isSelected, isInactive, isHidden, childCount, isSearchDimmed,
  isNestTarget, isRejectTarget, isShaking, hasChildMap,
  onDragEnd, onDragMove, onClick, onDblClick, onContextMenu,
}) => {
  const nodeRef  = useRef(null);
  const shakeRef = useRef(null);   // inner group — shaken without disturbing outer x/y
  const color = colorProp || DEFAULT_TYPE_COLORS[type] || '#8ea1a4';
  const isFolder = childCount > 0;

  const resolvedIconName = iconName || 'UserCircle';
  const iconImg = useIconImage(resolvedIconName, 16);

  // Mount pop animation — ease-out so scale decelerates naturally into resting position.
  // Opacity starts at 0 so the search-dim effect below can immediately correct it.
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    node.scaleX(0.5);
    node.scaleY(0.5);
    node.opacity(0);
    node.to({ scaleX: 1, scaleY: 1, opacity: 1, duration: 0.22, easing: Konva.Easings.EaseOut });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Search dim sync — authoritative source for opacity; also runs after mount.
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    node.to({ opacity: isSearchDimmed ? 0.2 : 1, duration: 0.12 });
  }, [isSearchDimmed]);

  // Shake animation on invalid drop — animates the inner group's x offset only
  useEffect(() => {
    if (!isShaking) return;
    const g = shakeRef.current;
    if (!g) return;
    const mag = 7;
    g.to({ x:  mag,        duration: 0.055, onFinish: () =>
    g.to({ x: -mag,        duration: 0.065, onFinish: () =>
    g.to({ x:  mag * 0.5,  duration: 0.055, onFinish: () =>
    g.to({ x: -mag * 0.35, duration: 0.05,  onFinish: () =>
    g.to({ x:  0,          duration: 0.04  })
    }) }) }) });
  }, [isShaking]);

  return (
    <Group
      ref={nodeRef}
      x={x} y={y}
      draggable
      onDragStart={(e) => { e.target.moveToTop(); }}
      onDragEnd={(e) => onDragEnd(id, e)}
      onDragMove={(e) => onDragMove?.(id, e)}
      onClick={(e) => {
        if (e.evt.button !== 0) return;
        onClick(id, e);
      }}
      onDblClick={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        onDblClick?.(id, e);
      }}
      onTap={(e) => onClick(id, e)}
      onContextMenu={(e) => onContextMenu(id, e)}
    >
      {/* Reject glow — red rings for invalid nest target */}
      {isRejectTarget && (
        <>
          <Circle radius={NODE_RADIUS + 14} fill="transparent" stroke="#f87171" strokeWidth={2.5} opacity={0.7} />
          <Circle radius={NODE_RADIUS + 8}  fill="#f8717118"  stroke="#f87171" strokeWidth={1.5} opacity={0.5} />
        </>
      )}

      {/* Nest-target highlight — green glow */}
      {isNestTarget && (
        <>
          <Circle radius={NODE_RADIUS + 14} fill="transparent" stroke="#4ade80" strokeWidth={2.5} opacity={0.7} />
          <Circle radius={NODE_RADIUS + 8}  fill="#4ade8018"  stroke="#4ade80" strokeWidth={1.5} opacity={0.5} />
        </>
      )}

      {/* Selection glow */}
      {isSelected && !isNestTarget && !isRejectTarget && (
        <>
          <Circle radius={NODE_RADIUS + 8} fill="transparent" stroke={color} strokeWidth={1.5} opacity={0.2} />
          <Circle radius={NODE_RADIUS + 3} fill="transparent" stroke={color} strokeWidth={2}   opacity={0.6} />
        </>
      )}

      {/* Dashed outer ring for folder nodes */}
      {isFolder && (
        <Circle
          radius={NODE_RADIUS + 6}
          fill="transparent"
          stroke={color}
          strokeWidth={1}
          opacity={0.35}
          dash={[3, 4]}
          listening={false}
        />
      )}

      {/* Inner group — this is what animates on shake */}
      <Group ref={shakeRef}>
        {/* Dark backdrop */}
        <Circle
          radius={isFolder ? NODE_RADIUS + 2 : NODE_RADIUS}
          fill="rgba(3,16,18,0.82)"
          listening={false}
          perfectDrawEnabled={false}
        />
        {/* Color tint + border — glow only when selected (shadowBlur=0 on idle = no canvas filter overhead) */}
        <Circle
          radius={isFolder ? NODE_RADIUS + 2 : NODE_RADIUS}
          fill={hexToRgba(color, 0.22)}
          stroke={color}
          strokeWidth={isFolder ? 3 : 2}
          shadowForStrokeEnabled={false}
          shadowColor={color}
          shadowBlur={isSelected ? 16 : 0}
          shadowOpacity={isSelected ? 0.55 : 0}
          perfectDrawEnabled={false}
        />

        {/* Icon */}
        {iconImg ? (
          <KImage
            image={iconImg}
            x={-8} y={-8}
            width={16} height={16}
            opacity={isSelected ? 1 : 0.82}
            listening={false}
            perfectDrawEnabled={false}
          />
        ) : (
          <Circle radius={6} fill={color} opacity={isSelected ? 0.9 : 0.55} />
        )}

        {/* Child-count badge */}
        {isFolder && (
          <Group x={NODE_RADIUS - 2} y={NODE_RADIUS - 2}>
            <Circle radius={9} fill={color} />
            <Text
              text={String(childCount)}
              fontSize={10} fill="#031012" fontStyle="bold"
              align="center" width={18} x={-9} y={-5}
              listening={false}
            />
          </Group>
        )}

        {/* Inactive indicator */}
        {isInactive && (
          <Group x={NODE_RADIUS - 4} y={-NODE_RADIUS + 2}>
            <Circle radius={7} fill="#031012" />
            <Circle radius={5} fill="#f87171" opacity={0.8} />
            <Text text="x" fontSize={8} fill="#fff" x={-3} y={-4} fontStyle="bold" />
          </Group>
        )}

        {/* Sub-map badge — top-left corner; indicates a drill-down map is attached */}
        {hasChildMap && (
          <Group x={-NODE_RADIUS + 2} y={-NODE_RADIUS + 2}>
            <Circle radius={8} fill="rgba(3,16,18,0.92)" stroke={color} strokeWidth={1.5} opacity={0.95} />
            <Text
              text="M"
              fontSize={8}
              fontFamily="Lexend, sans-serif"
              fill={color}
              align="center"
              width={16}
              x={-8} y={-5}
              listening={false}
              fontStyle="bold"
            />
          </Group>
        )}

        {/* Label — dark stroke halo for readability without Canvas shadowBlur overhead */}
        <Text
          text={name}
          fontSize={11}
          fontFamily="Lexend, sans-serif"
          fill="#ffffff"
          stroke="rgba(0,0,0,0.88)"
          strokeWidth={2.5}
          fillAfterStrokeEnabled={true}
          y={NODE_RADIUS + 8}
          align="center"
          width={120}
          offsetX={60}
          fontStyle={isSelected ? 'bold' : 'normal'}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
    </Group>
  );
});
MapNode.displayName = 'MapNode';

/* ─── FolderGrid ────────────────────────────────────────────────────────
 * Expanded folder: 3×3 grid of child node circles.
 * openFolderBounds — world-space bounds of other open folders (cross-nest detection)
 * onCrossNest      — (childId, targetRootFolderId) => void
 */
const FolderGrid = memo(({
  rootFolderId, drillPath, page,
  allMapNodes, selectedNodeId, nestCounts, nodeTypeOverrides, customNodeTypes,
  onClose, onCloseComplete, isClosing,
  onDrillInto, onDrillUp, onPageChange,
  onChildSelect, onChildContextMenu, onChildUnnest, onChildNest, onFolderDragEnd,
  openFolderBounds, onCrossNest,
  isRejectTarget, isShaking,
  stageRef,
}) => {
  const groupRef = useRef(null);
  const shakeRef = useRef(null);  // inner content group — shake without disturbing drag position
  const [innerNestTarget, setInnerNestTarget] = useState(null);

  const rootFolderNode = useMemo(
    () => allMapNodes.find((n) => n.id === rootFolderId),
    [allMapNodes, rootFolderId]
  );
  if (!rootFolderNode) return null;

  const currentFolderId = drillPath[drillPath.length - 1];
  const currentFolderNode = useMemo(
    () => allMapNodes.find((n) => n.id === currentFolderId) || rootFolderNode,
    [allMapNodes, currentFolderId, rootFolderNode]
  );

  const allChildren = useMemo(() => {
    const kids = allMapNodes.filter((n) => n.parentNodeId === currentFolderId);
    const savedOrder = currentFolderNode?.fields?.childOrder;
    if (savedOrder?.length) {
      return [...kids].sort((a, b) => {
        const ai = savedOrder.indexOf(a.id);
        const bi = savedOrder.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    }
    return kids;
  }, [allMapNodes, currentFolderId, currentFolderNode]);

  const totalPages = Math.max(1, Math.ceil(allChildren.length / CELLS_PER_PAGE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageKids   = allChildren.slice(safePage * CELLS_PER_PAGE, (safePage + 1) * CELLS_PER_PAGE);
  const showNav    = totalPages > 1;

  const FH  = getFolderBoxH(showNav);
  const FW  = FOLDER_BOX_W;
  const HW  = FW / 2;
  const HH  = FH / 2;
  const GOX = -HW + FOLDER_PAD;
  const GOY = -HH + FOLDER_PAD;

  const cellCenter = (idx) => ({
    x: GOX + (idx % GRID_COLS) * FOLDER_CELL + FOLDER_CELL / 2,
    y: GOY + Math.floor(idx / GRID_COLS) * FOLDER_CELL + FOLDER_CELL / 2,
  });

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    node.scaleX(0.88);
    node.scaleY(0.88);
    node.opacity(0);
    node.to({ scaleX: 1, scaleY: 1, opacity: 1, duration: 0.18, easing: Konva.Easings.EaseOut });
  }, []);

  // Shake animation — animates inner content group's x only
  useEffect(() => {
    if (!isShaking) return;
    const g = shakeRef.current;
    if (!g) return;
    const mag = 9;
    g.to({ x:  mag,        duration: 0.055, onFinish: () =>
    g.to({ x: -mag,        duration: 0.065, onFinish: () =>
    g.to({ x:  mag * 0.5,  duration: 0.055, onFinish: () =>
    g.to({ x: -mag * 0.35, duration: 0.05,  onFinish: () =>
    g.to({ x:  0,          duration: 0.04  })
    }) }) }) });
  }, [isShaking]);

  // Exit animation — scale down + fade out, then signal MapCanvas to remove from state
  useEffect(() => {
    if (!isClosing) return;
    const node = groupRef.current;
    if (!node) return;
    node.to({
      scaleX: 0.82, scaleY: 0.82, opacity: 0,
      duration: 0.14,
      easing: Konva.Easings.EaseIn,
      onFinish: () => onCloseComplete?.(rootFolderId),
    });
  }, [isClosing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Group
      ref={groupRef}
      x={rootFolderNode.x}
      y={rootFolderNode.y}
      draggable
      onDragEnd={(e) => {
        if (e.target === groupRef.current) {
          onFolderDragEnd(rootFolderId, e.target.x(), e.target.y());
        }
      }}
    >
      {/* ── Inner shakeable content ──────────────────────────────────── */}
      <Group ref={shakeRef}>

      {/* Folder box background */}
      <Rect
        x={-HW} y={-HH}
        width={FW} height={FH}
        fill="rgba(4,17,20,0.95)"
        stroke="rgba(255,255,255,0.11)"
        strokeWidth={1.5}
        cornerRadius={14}
        shadowColor="rgba(0,0,0,0.65)"
        shadowBlur={10}
        shadowOffsetY={4}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Reject glow overlay — red border when folder can't accept the dragged node */}
      {isRejectTarget && (
        <Rect
          x={-HW} y={-HH}
          width={FW} height={FH}
          fill="#f8717110"
          stroke="#f87171"
          strokeWidth={2.5}
          cornerRadius={14}
          opacity={0.8}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Grid background */}
      <Rect
        x={GOX} y={GOY}
        width={GRID_COLS * FOLDER_CELL}
        height={GRID_ROWS * FOLDER_CELL}
        fill="rgba(0,0,0,0.14)"
        cornerRadius={8}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Grid cell dividers */}
      {[1, 2].map((col) => (
        <Line
          key={`gv-${col}`}
          points={[
            GOX + col * FOLDER_CELL, GOY,
            GOX + col * FOLDER_CELL, GOY + GRID_ROWS * FOLDER_CELL,
          ]}
          stroke="rgba(255,255,255,0.045)" strokeWidth={1}
          listening={false} perfectDrawEnabled={false}
        />
      ))}
      {[1, 2].map((row) => (
        <Line
          key={`gh-${row}`}
          points={[
            GOX, GOY + row * FOLDER_CELL,
            GOX + GRID_COLS * FOLDER_CELL, GOY + row * FOLDER_CELL,
          ]}
          stroke="rgba(255,255,255,0.045)" strokeWidth={1}
          listening={false} perfectDrawEnabled={false}
        />
      ))}

      {/* Child node circles */}
      {pageKids.map((child, idx) => {
        const { x: cx, y: cy } = cellCenter(idx);
        const isSubfolder = (nestCounts[child.id] || 0) > 0;
        const color = getTypeColor(child.type, nodeTypeOverrides, customNodeTypes);
        const isSel  = child.id === selectedNodeId;
        const name   = child.fields?.name || child.type;
        const kCount = nestCounts[child.id] || 0;

        return (
          <Group
            key={child.id}
            x={cx} y={cy}
            draggable
            onDragStart={(e) => { e.cancelBubble = true; }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const lx = e.target.x();
              const ly = e.target.y();
              let found = null;
              for (let i = 0; i < pageKids.length; i++) {
                const other = pageKids[i];
                if (other.id === child.id) continue;
                const { x: ox, y: oy } = cellCenter(i);
                if (Math.sqrt((lx - ox) ** 2 + (ly - oy) ** 2) < FOLDER_CHILD_R * 2.2) {
                  found = other.id;
                  break;
                }
              }
              setInnerNestTarget(found);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              setInnerNestTarget(null);
              const lx = e.target.x();
              const ly = e.target.y();
              const threshold = 55;

              // Check if dropped near another child → deep nest
              for (let i = 0; i < pageKids.length; i++) {
                const other = pageKids[i];
                if (other.id === child.id) continue;
                const { x: ox, y: oy } = cellCenter(i);
                const dx = lx - ox;
                const dy = ly - oy;
                if (Math.sqrt(dx * dx + dy * dy) < FOLDER_CHILD_R * 2.2) {
                  onChildNest(child.id, other.id);
                  return;
                }
              }

              if (
                lx < -HW - threshold || lx > HW + threshold ||
                ly < -HH - threshold || ly > HH + threshold
              ) {
                // Compute world position of drop
                const worldX = rootFolderNode.x + lx;
                const worldY = rootFolderNode.y + ly;

                // ── Cross-folder: check if dropped inside another open folder ──
                if (openFolderBounds) {
                  for (const [otherRootId, rect] of Object.entries(openFolderBounds)) {
                    if (otherRootId === rootFolderId) continue;
                    if (
                      worldX >= rect.x - rect.hw - 20 && worldX <= rect.x + rect.hw + 20 &&
                      worldY >= rect.y - rect.hh - 20 && worldY <= rect.y + rect.hh + 20
                    ) {
                      onCrossNest?.(child.id, otherRootId);
                      return;
                    }
                  }
                }

                // Dragged outside & not into another folder → unnest to canvas
                onChildUnnest(child.id, worldX, worldY);
              } else {
                // Snap back to cell
                e.target.to({ x: cx, y: cy, duration: 0.2 });
              }
            }}
            onClick={(e) => {
              if (e.evt.button !== 0) return;
              e.cancelBubble = true;
              if (isSubfolder) {
                onDrillInto(rootFolderId, child.id);
              } else {
                onChildSelect(child.id);
              }
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              if (isSubfolder) {
                onDrillInto(rootFolderId, child.id);
              } else {
                onChildSelect(child.id);
              }
            }}
            onContextMenu={(e) => {
              e.evt.preventDefault();
              e.cancelBubble = true;
              const stage = stageRef.current;
              if (!stage) return;
              const nativeEvt = e.evt;
              onChildContextMenu(child.id, nativeEvt.clientX, nativeEvt.clientY);
            }}
          >
            {/* Inner nest-target highlight */}
            {innerNestTarget === child.id && (
              <>
                <Circle radius={FOLDER_CHILD_R + 10} fill="transparent" stroke="#4ade80" strokeWidth={2} opacity={0.65} />
                <Circle radius={FOLDER_CHILD_R + 5}  fill="#4ade8010" stroke="#4ade80" strokeWidth={1} opacity={0.45} />
              </>
            )}

            {isSel && (
              <Circle radius={FOLDER_CHILD_R + 5} fill="transparent" stroke={color} strokeWidth={1.5} opacity={0.35} />
            )}

            {isSubfolder && (
              <Circle
                radius={FOLDER_CHILD_R + 6}
                fill="transparent" stroke={color}
                strokeWidth={1} opacity={0.28}
                dash={[3, 4]} listening={false}
              />
            )}

            <Circle
              radius={FOLDER_CHILD_R}
              fill="rgba(3,16,18,0.82)"
              listening={false}
              perfectDrawEnabled={false}
            />
            {/* Glow only when selected — shadowBlur=0 on idle prevents canvas filter overhead */}
            <Circle
              radius={FOLDER_CHILD_R}
              fill={hexToRgba(color, 0.22)}
              stroke={color}
              strokeWidth={isSubfolder ? 3 : 2}
              shadowForStrokeEnabled={false}
              shadowColor={color}
              shadowBlur={isSel ? 10 : 0}
              shadowOpacity={isSel ? 0.5 : 0}
              perfectDrawEnabled={false}
            />

            <Circle radius={5} fill={color} opacity={isSel ? 0.9 : 0.5} />

            {isSubfolder && (
              <Group x={FOLDER_CHILD_R - 2} y={FOLDER_CHILD_R - 2}>
                <Circle radius={8} fill={color} />
                <Text
                  text={String(kCount)}
                  fontSize={9} fill="#031012" fontStyle="bold"
                  align="center" width={16} x={-8} y={-5}
                  listening={false}
                />
              </Group>
            )}

            <Text
              text={name}
              fontSize={9}
              fontFamily="Lexend, sans-serif"
              fill="#ffffff"
              stroke="rgba(0,0,0,0.88)"
              strokeWidth={2}
              fillAfterStrokeEnabled={true}
              y={FOLDER_CHILD_R + 5}
              align="center"
              width={FOLDER_CELL - 8}
              offsetX={(FOLDER_CELL - 8) / 2}
              wrap="none" ellipsis={true}
              listening={false} perfectDrawEnabled={false}
            />
          </Group>
        );
      })}

      {/* Navigation bar */}
      {showNav && (
        <Group y={HH - FOLDER_PAD - NAV_H / 2}>
          {safePage > 0 && (
            <Group
              x={-HW + 26}
              onClick={(e) => { e.cancelBubble = true; onPageChange(rootFolderId, safePage - 1); }}
              onTap={(e)   => { e.cancelBubble = true; onPageChange(rootFolderId, safePage - 1); }}
            >
              <Circle radius={13} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
              <Text text="‹" fontSize={20} fill="#edf2f1" align="center" width={26} x={-13} y={-11} listening={false} />
            </Group>
          )}

          {Array.from({ length: totalPages }, (_, i) => (
            <Circle
              key={i}
              x={(i - (totalPages - 1) / 2) * 14}
              radius={i === safePage ? 4.5 : 3}
              fill={i === safePage ? '#ff9248' : 'rgba(255,255,255,0.2)'}
              onClick={(e) => { e.cancelBubble = true; onPageChange(rootFolderId, i); }}
              onTap={(e)   => { e.cancelBubble = true; onPageChange(rootFolderId, i); }}
            />
          ))}

          {safePage < totalPages - 1 && (
            <Group
              x={HW - 26}
              onClick={(e) => { e.cancelBubble = true; onPageChange(rootFolderId, safePage + 1); }}
              onTap={(e)   => { e.cancelBubble = true; onPageChange(rootFolderId, safePage + 1); }}
            >
              <Circle radius={13} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
              <Text text="›" fontSize={20} fill="#edf2f1" align="center" width={26} x={-13} y={-11} listening={false} />
            </Group>
          )}
        </Group>
      )}

      </Group>{/* end inner shakeable content */}

      {/* Parent breadcrumb circles */}
      {drillPath.map((fId, idx) => {
        const stackFromBottom = idx;
        const cy  = HH - FOLDER_PARENT_R - 10 - stackFromBottom * (FOLDER_PARENT_R * 2 + 10);
        const fNode = allMapNodes.find((n) => n.id === fId);
        const col   = getTypeColor(fNode?.type, nodeTypeOverrides, customNodeTypes);
        const isCurrent = idx === drillPath.length - 1;

        return (
          <Group
            key={fId}
            x={HW}
            y={cy}
            onClick={(e) => {
              e.cancelBubble = true;
              if (isCurrent) {
                if (drillPath.length === 1) {
                  onClose(rootFolderId);
                } else {
                  onDrillUp(rootFolderId, idx - 1);
                }
              } else {
                onDrillUp(rootFolderId, idx);
              }
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              if (isCurrent) {
                if (drillPath.length === 1) {
                  onClose(rootFolderId);
                } else {
                  onDrillUp(rootFolderId, idx - 1);
                }
              } else {
                onDrillUp(rootFolderId, idx);
              }
            }}
          >
            <Circle
              radius={FOLDER_PARENT_R + 3}
              fill="rgba(3,16,18,0.96)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
            <Circle radius={FOLDER_PARENT_R} fill="rgba(3,16,18,0.82)" listening={false} perfectDrawEnabled={false} />
            <Circle
              radius={FOLDER_PARENT_R}
              fill={hexToRgba(col, isCurrent ? 0.22 : 0.12)}
              stroke={col}
              strokeWidth={isCurrent ? 2.5 : 1.5}
              opacity={isCurrent ? 1 : 0.55}
            />
            <Circle radius={4} fill={col} opacity={isCurrent ? 0.85 : 0.45} />
          </Group>
        );
      })}
    </Group>
  );
});
FolderGrid.displayName = 'FolderGrid';

/* ─── MapCanvas ──────────────────────────────────────────────────────────*/
export default function MapCanvas({
  placingType, onPlacingDone,
  onNodeContextMenu, drawingMode, setDrawingMode,
  polygonPoints, setPolygonPoints,
  selectedTerritoryId, setSelectedTerritoryId,
  editingTerritoryId,
  searchHighlightIds,
  orgView,          // dims nodes, boosts territory opacity for org/territory overview
}) {
  const stageRef     = useRef(null);
  const containerRef = useRef(null);

  // ── Instant zoom: drive Konva imperatively; RAF-sync React state ──────
  // Eliminates the old lerp loop — zoom now responds on every wheel tick.
  const wheelRafRef       = useRef(null);
  // ── Pinch-to-zoom touch refs ───────────────────────────────────────────────
  const pinchLastDistRef   = useRef(0);
  const pinchLastCenterRef = useRef(null);
  const pendingStageState = useRef(null);

  // ── Drag RAF throttle — same pattern as wheel so WidgetLayer only re-renders once per frame
  const dragRafRef = useRef(null);

  // Cleanup refs for shake-clear timeouts so they don't fire after unmount
  const shakeNodeTimerRef   = useRef(null);
  const shakeFolderTimerRef = useRef(null);
  useEffect(() => () => {
    clearTimeout(shakeNodeTimerRef.current);
    clearTimeout(shakeFolderTimerRef.current);
  }, []);

  const setViewport = useViewportStore((s) => s.setViewport);

  const [bgImage, setBgImage]       = useState(null);
  const [stageSize, setStageSize]   = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos]     = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  // Keep viewport store in sync so WidgetLayer can transform canvas→screen coords
  useEffect(() => {
    setViewport(stagePos.x, stagePos.y, stageScale);
  }, [stagePos, stageScale, setViewport]);

  const [folderState, setFolderState]     = useState({});
  const [nestTargetId,         setNestTargetId]         = useState(null);
  const [rejectTargetId,       setRejectTargetId]       = useState(null); // red glow on hovered node
  const [rejectShakeId,        setRejectShakeId]        = useState(null); // shake on failed node drop
  const [rejectFolderGridId,   setRejectFolderGridId]   = useState(null); // red glow on hovered folder grid
  const [rejectShakeFolderGridId, setRejectShakeFolderGridId] = useState(null); // shake folder grid

  const activeMapId  = useMapStore((s) => s.activeMapId);
  const allMaps      = useMapStore((s) => s.maps);
  const mapStack     = useMapStore((s) => s.mapStack);
  const drillDownMap = useMapStore((s) => s.drillDown);
  const drillUpMap   = useMapStore((s) => s.drillUp);
  const jumpToMap    = useMapStore((s) => s.jumpTo);
  const campaignId   = useCampaignStore((s) => s.activeCampaignId);
  const allNodes     = useNodeStore((s) => s.nodes);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);
  const selectNode   = useNodeStore((s) => s.selectNode);
  const deselectNode = useNodeStore((s) => s.deselectNode);
  const createNode   = useNodeStore((s) => s.createNode);
  const moveNode     = useNodeStore((s) => s.moveNode);
  const nestNode     = useNodeStore((s) => s.nestNode);
  const unnestNode   = useNodeStore((s) => s.unnestNode);
  const allTerritories    = useTerritoryStore((s) => s.territories);
  const updateTerritory   = useTerritoryStore((s) => s.updateTerritory);
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];

  const activeMap = useMemo(
    () => allMaps.find((m) => m.id === activeMapId) || null,
    [allMaps, activeMapId]
  );

  const mapNodes = useMemo(
    () => allNodes.filter((n) => n.mapId === activeMapId),
    [allNodes, activeMapId]
  );

  // O(1) node lookup used by isAncestorOf during drag events (avoids O(n²) finds)
  const nodeById = useMemo(() => {
    const map = {};
    for (const n of mapNodes) map[n.id] = n;
    return map;
  }, [mapNodes]);

  const nestCounts = useMemo(() => {
    const counts = {};
    for (const n of mapNodes) {
      if (n.parentNodeId) {
        counts[n.parentNodeId] = (counts[n.parentNodeId] || 0) + 1;
      }
    }
    return counts;
  }, [mapNodes]);

  const openFolderIds = useMemo(
    () => new Set(Object.keys(folderState).filter((id) => mapNodes.some((n) => n.id === id))),
    [folderState, mapNodes]
  );

  const regularNodes = useMemo(
    () => mapNodes.filter((n) => !n.parentNodeId && !openFolderIds.has(n.id)),
    [mapNodes, openFolderIds]
  );

  const territories = useMemo(
    () => allTerritories.filter((t) => t.mapId === activeMapId),
    [allTerritories, activeMapId]
  );

  // Set of nodeIds that have a child map (used for sub-map badge + dblclick drill-in)
  const childMapNodeIds = useMemo(() => {
    return new Set(allMaps.filter((m) => m.parentMapId).map((m) => m.parentMapId));
  }, [allMaps]);

  // World-space bounds of every open folder for cross-folder drag detection
  const openFolderBounds = useMemo(() => {
    const bounds = {};
    for (const [rootId, state] of Object.entries(folderState)) {
      const rootNode = mapNodes.find((n) => n.id === rootId);
      if (!rootNode) continue;
      const currentFolderId = state.drillPath[state.drillPath.length - 1];
      const kids = mapNodes.filter((n) => n.parentNodeId === currentFolderId);
      const showNav = kids.length > CELLS_PER_PAGE;
      const FH = getFolderBoxH(showNav);
      bounds[rootId] = {
        x:  rootNode.x,
        y:  rootNode.y,
        hw: FOLDER_BOX_W / 2,
        hh: FH / 2,
      };
    }
    return bounds;
  }, [folderState, mapNodes]);

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
      if (width > 0 && height > 0) setStageSize({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── Folder state helpers ─────────────────────────────────────────── */
  const openFolder = useCallback((nodeId) => {
    setFolderState((prev) => ({ ...prev, [nodeId]: { drillPath: [nodeId], page: 0 } }));
  }, []);

  // Mark as closing so FolderGrid can run its exit tween before unmounting.
  const closeFolder = useCallback((nodeId) => {
    setFolderState((prev) => {
      if (!prev[nodeId]) return prev;
      return { ...prev, [nodeId]: { ...prev[nodeId], closing: true } };
    });
  }, []);

  // Called by FolderGrid after its exit animation finishes.
  const handleFolderCloseComplete = useCallback((nodeId) => {
    setFolderState((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }, []);

  const drillIntoFolder = useCallback((rootId, childId) => {
    setFolderState((prev) => ({
      ...prev,
      [rootId]: { drillPath: [...prev[rootId].drillPath, childId], page: 0 },
    }));
  }, []);

  const drillUpToIndex = useCallback((rootId, pathIndex) => {
    setFolderState((prev) => ({
      ...prev,
      [rootId]: { drillPath: prev[rootId].drillPath.slice(0, pathIndex + 1), page: 0 },
    }));
  }, []);

  const setFolderPage = useCallback((rootId, page) => {
    setFolderState((prev) => ({
      ...prev,
      [rootId]: { ...prev[rootId], page },
    }));
  }, []);

  /* ── Auto-close / auto-drill-up when a folder level becomes empty ─── *
   * Runs whenever mapNodes changes (node added, moved, unnested).
   * For each open folder:
   *   - Walk the drillPath from the current (deepest) level upward.
   *   - Find the deepest level that still has children.
   *   - If no level has children → close the folder entirely.
   *   - If a shallower level still has children → trim drillPath to that level.
   */
  useEffect(() => {
    setFolderState((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const [rootId, state] of Object.entries(next)) {
        // Walk from current level upward to find deepest level with children
        let validDepth = -1;
        for (let i = state.drillPath.length - 1; i >= 0; i--) {
          const folderId = state.drillPath[i];
          const kidsCount = mapNodes.filter((n) => n.parentNodeId === folderId).length;
          if (kidsCount > 0) {
            validDepth = i;
            break;
          }
        }

        if (validDepth === -1) {
          // No level in the drill path has children — close folder entirely
          delete next[rootId];
          changed = true;
        } else if (validDepth < state.drillPath.length - 1) {
          // Current view is empty but an ancestor level has children — step back
          next[rootId] = { drillPath: state.drillPath.slice(0, validDepth + 1), page: 0 };
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [mapNodes]);

  /* ── Nesting validation ───────────────────────────────────────────── */
  const isAncestorOf = useCallback((ancestorId, nodeId) => {
    const visited = new Set();
    let curr = nodeById[nodeId];
    while (curr?.parentNodeId) {
      if (visited.has(curr.parentNodeId)) break; // cycle guard
      if (curr.parentNodeId === ancestorId) return true;
      visited.add(curr.id);
      curr = nodeById[curr.parentNodeId]; // O(1) lookup
    }
    return false;
  }, [nodeById]);

  const canNestInto = useCallback((childId, parentId) => {
    if (childId === parentId) return false;
    if (isAncestorOf(childId, parentId)) return false;
    const child  = mapNodes.find((n) => n.id === childId);
    const parent = mapNodes.find((n) => n.id === parentId);
    if (child && parent && !canNestType(child.type, parent.type, customNodeTypes)) return false;
    const childHasKids = (nestCounts[childId] || 0) > 0;
    if (childHasKids) {
      const existingSubfolderKids = mapNodes.filter(
        (n) => n.parentNodeId === parentId && (nestCounts[n.id] || 0) > 0
      ).length;
      if (existingSubfolderKids >= MAX_SUBFOLDERS) return false;
    }
    return true;
  }, [isAncestorOf, nestCounts, mapNodes, customNodeTypes]);

  /* ── Pinch-to-zoom (mobile) — native listener, passive:false ───── */
  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;

    const onTouchMove = (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      if (stage.isDragging()) stage.stopDrag();

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const p1 = { x: t1.clientX, y: t1.clientY };
      const p2 = { x: t2.clientX, y: t2.clientY };

      const dist   = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      if (!pinchLastDistRef.current) {
        pinchLastDistRef.current   = dist;
        pinchLastCenterRef.current = center;
        return;
      }

      const oldScale = stage.scaleX();
      const newScale = Math.min(8, Math.max(0.05, oldScale * (dist / pinchLastDistRef.current)));
      const lastC    = pinchLastCenterRef.current;
      const pointTo  = {
        x: (center.x - stage.x()) / oldScale,
        y: (center.y - stage.y()) / oldScale,
      };
      const newPos = {
        x: center.x - pointTo.x * newScale + (center.x - lastC.x),
        y: center.y - pointTo.y * newScale + (center.y - lastC.y),
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      pinchLastDistRef.current   = dist;
      pinchLastCenterRef.current = center;

      if (!wheelRafRef.current) {
        wheelRafRef.current = requestAnimationFrame(() => {
          setStageScale(newScale);
          setStagePos(newPos);
          setViewport(newPos.x, newPos.y, newScale);
          wheelRafRef.current = null;
        });
      }
    };

    const onTouchEnd = () => {
      pinchLastDistRef.current   = 0;
      pinchLastCenterRef.current = null;
    };

    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend',  onTouchEnd);
    return () => {
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend',  onTouchEnd);
    };
  }, [setViewport]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Instant zoom ─────────────────────────────────────────────────── */
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const oldPos   = stage.position();
    const pointer  = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - oldPos.x) / oldScale,
      y: (pointer.y - oldPos.y) / oldScale,
    };

    const rawDelta = e.evt.deltaMode === 1
      ? e.evt.deltaY * 30
      : e.evt.deltaMode === 2
        ? e.evt.deltaY * 300
        : e.evt.deltaY;

    const direction = rawDelta > 0 ? -1 : 1;
    const factor    = Math.min(Math.abs(rawDelta) * 0.001, 0.15);
    const newScale  = Math.max(0.1, Math.min(5, oldScale * (1 + direction * factor)));

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    // Imperatively drive Konva — zero latency
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    stage.batchDraw();

    // RAF-throttle React state sync (max once per ~16ms frame)
    pendingStageState.current = { scale: newScale, pos: newPos };
    if (!wheelRafRef.current) {
      wheelRafRef.current = requestAnimationFrame(() => {
        const p = pendingStageState.current;
        if (p) {
          setStageScale(p.scale);
          setStagePos(p.pos);
          setViewport(p.pos.x, p.pos.y, p.scale);
          pendingStageState.current = null;
        }
        wheelRafRef.current = null;
      });
    }
  }, [setViewport]);

  /* ── Zoom forwarded from widget overlay (flux:canvasWheel) ───────── */
  useEffect(() => {
    const handler = (e) => {
      const { deltaY, deltaMode, clientX, clientY } = e.detail;
      const stage = stageRef.current;
      if (!stage) return;
      const rect      = stage.container().getBoundingClientRect();
      const pointerX  = clientX - rect.left;
      const pointerY  = clientY - rect.top;
      const oldScale  = stage.scaleX();
      const oldPos    = stage.position();
      const mousePointTo = {
        x: (pointerX - oldPos.x) / oldScale,
        y: (pointerY - oldPos.y) / oldScale,
      };
      const rawDelta  = deltaMode === 1 ? deltaY * 30 : deltaMode === 2 ? deltaY * 300 : deltaY;
      const direction = rawDelta > 0 ? -1 : 1;
      const factor    = Math.min(Math.abs(rawDelta) * 0.001, 0.15);
      const newScale  = Math.max(0.1, Math.min(5, oldScale * (1 + direction * factor)));
      const newPos    = {
        x: pointerX - mousePointTo.x * newScale,
        y: pointerY - mousePointTo.y * newScale,
      };
      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();
      pendingStageState.current = { scale: newScale, pos: newPos };
      if (!wheelRafRef.current) {
        wheelRafRef.current = requestAnimationFrame(() => {
          const p = pendingStageState.current;
          if (p) {
            setStageScale(p.scale);
            setStagePos(p.pos);
            setViewport(p.pos.x, p.pos.y, p.scale);
            pendingStageState.current = null;
          }
          wheelRafRef.current = null;
        });
      }
    };
    window.addEventListener('flux:canvasWheel', handler);
    return () => window.removeEventListener('flux:canvasWheel', handler);
  }, [setViewport]);

  /* ── Stage click ─────────────────────────────────────────────────── */
  const handleStageClick = useCallback((e) => {
    const targetName  = e.target?.name?.() || '';
    const isStage     = e.target === e.currentTarget;
    const isBg        = targetName === 'bg-image' || targetName === 'bg-rect';
    const isTerritory = targetName.startsWith('territory-');

    if (!isStage && !isBg && !isTerritory) return;

    const stage = stageRef.current;
    if (!stage) return;
    // Always read live from Konva so coords are accurate even during active zoom
    const liveScale = stage.scaleX();
    const livePos   = stage.position();
    const pointer   = stage.getPointerPosition();
    const x = (pointer.x - livePos.x) / liveScale;
    const y = (pointer.y - livePos.y) / liveScale;

    if (drawingMode === 'polygon') {
      setPolygonPoints((prev) => [...prev, { x, y }]);
    } else if (placingType) {
      const placed = createNode(campaignId, activeMapId, placingType, x, y);
      if (placed?.id) selectNode(placed.id);
      onPlacingDone();
    } else if (isTerritory) {
      const territoryId = targetName.replace('territory-', '');
      setSelectedTerritoryId?.(territoryId);
    } else {
      setSelectedTerritoryId?.(null);
      deselectNode();
    }
  }, [placingType, drawingMode, campaignId, activeMapId, createNode, onPlacingDone, deselectNode, setPolygonPoints, setSelectedTerritoryId]);

  /* ── Node click ──────────────────────────────────────────────────── */
  const handleNodeClick = useCallback((nodeId, e) => {
    e.cancelBubble = true;
    const hasChildren = (nestCounts[nodeId] || 0) > 0;
    if (hasChildren) {
      if (openFolderIds.has(nodeId)) {
        closeFolder(nodeId);
      } else {
        openFolder(nodeId);
      }
    }
    selectNode(nodeId);
  }, [nestCounts, openFolderIds, openFolder, closeFolder, selectNode]);

  /* ── Node double-click: drill into sub-map if one exists ─────────── */
  const handleNodeDblClick = useCallback((nodeId) => {
    const childMap = allMaps.find((m) => m.parentMapId === nodeId);
    if (!childMap) return;
    // Respect depth limit — mapStack.length is current depth (0 = root)
    if (mapStack.length >= MAP_MAX_DEPTH - 1) return;
    drillDownMap(childMap.id);
  }, [allMaps, mapStack, drillDownMap]);

  /* ── Node drag: hover highlight (valid = green, invalid = red) ────── */
  const handleNodeDragMove = useCallback((nodeId, e) => {
    const dragX = e.target.x();
    const dragY = e.target.y();
    const draggedNode = mapNodes.find((n) => n.id === nodeId);
    if (!draggedNode || draggedNode.parentNodeId || openFolderIds.has(nodeId)) {
      setNestTargetId(null);
      setRejectTargetId(null);
      setRejectFolderGridId(null);
      return;
    }

    // 1. Check standalone nodes first
    for (const n of mapNodes) {
      if (n.id === nodeId || n.parentNodeId) continue;
      const dx = dragX - n.x;
      const dy = dragY - n.y;
      if (Math.sqrt(dx * dx + dy * dy) < NEST_HIT_R) {
        if (canNestInto(nodeId, n.id)) {
          setNestTargetId(n.id);
          setRejectTargetId(null);
          setRejectFolderGridId(null);
        } else {
          setNestTargetId(null);
          setRejectTargetId(n.id);
          setRejectFolderGridId(null);
        }
        return;
      }
    }

    // 2. Check open folder grids — show red glow if folder can't accept
    for (const [rootId, state] of Object.entries(folderState)) {
      const rootNode = mapNodes.find((n) => n.id === rootId);
      if (!rootNode) continue;
      const currentFolderId = state.drillPath[state.drillPath.length - 1];
      const kids = mapNodes.filter((n) => n.parentNodeId === currentFolderId);
      const showNav = kids.length > CELLS_PER_PAGE;
      const FH = getFolderBoxH(showNav);
      const HW = FOLDER_BOX_W / 2;
      const HH = FH / 2;
      if (
        dragX >= rootNode.x - HW - 24 && dragX <= rootNode.x + HW + 24 &&
        dragY >= rootNode.y - HH - 24 && dragY <= rootNode.y + HH + 24
      ) {
        setNestTargetId(null);
        setRejectTargetId(null);
        if (!canNestInto(nodeId, currentFolderId)) {
          setRejectFolderGridId(rootId);
        } else {
          setRejectFolderGridId(null);
        }
        return;
      }
    }

    setNestTargetId(null);
    setRejectTargetId(null);
    setRejectFolderGridId(null);
  }, [mapNodes, openFolderIds, folderState, canNestInto]);

  /* ── Node drag end ───────────────────────────────────────────────── */
  const handleNodeDragEnd = useCallback((nodeId, e) => {
    setNestTargetId(null);
    setRejectTargetId(null);
    setRejectFolderGridId(null);
    const dragX = e.target.x();
    const dragY = e.target.y();
    const draggedNode = mapNodes.find((n) => n.id === nodeId);
    if (!draggedNode) { moveNode(campaignId, nodeId, dragX, dragY); return; }

    if (!draggedNode.parentNodeId) {
      // 1. Check standalone nodes — valid nest or reject-shake
      for (const n of mapNodes) {
        if (n.id === nodeId || n.parentNodeId || openFolderIds.has(n.id)) continue;
        const dx = dragX - n.x;
        const dy = dragY - n.y;
        if (Math.sqrt(dx * dx + dy * dy) < NEST_HIT_R) {
          if (canNestInto(nodeId, n.id)) {
            nestNode(campaignId, nodeId, n.id);
            e.target.x(n.x);
            e.target.y(n.y);
            openFolder(n.id);
            return;
          } else {
            // Shake the invalid target
            setRejectShakeId(n.id);
            clearTimeout(shakeNodeTimerRef.current);
            shakeNodeTimerRef.current = setTimeout(() => setRejectShakeId(null), 700);
            break;
          }
        }
      }

      // 2. Check open folder grids
      for (const [rootId, state] of Object.entries(folderState)) {
        const rootNode = mapNodes.find((n) => n.id === rootId);
        if (!rootNode) continue;
        const currentFolderId = state.drillPath[state.drillPath.length - 1];
        const kids = mapNodes.filter((n) => n.parentNodeId === currentFolderId);
        const safePage = state.page || 0;
        const pageKids = kids.slice(safePage * CELLS_PER_PAGE, (safePage + 1) * CELLS_PER_PAGE);
        const showNav = kids.length > CELLS_PER_PAGE;
        const FH = getFolderBoxH(showNav);
        const HW = FOLDER_BOX_W / 2;
        const HH = FH / 2;
        const GOX = -HW + FOLDER_PAD;
        const GOY = -HH + FOLDER_PAD;
        const gridCellCenter = (idx) => ({
          x: rootNode.x + GOX + (idx % GRID_COLS) * FOLDER_CELL + FOLDER_CELL / 2,
          y: rootNode.y + GOY + Math.floor(idx / GRID_COLS) * FOLDER_CELL + FOLDER_CELL / 2,
        });

        if (
          dragX >= rootNode.x - HW - 20 && dragX <= rootNode.x + HW + 20 &&
          dragY >= rootNode.y - HH - 20 && dragY <= rootNode.y + HH + 20
        ) {
          let nestTarget = null;
          for (let i = 0; i < pageKids.length; i++) {
            const other = pageKids[i];
            if (other.id === nodeId) continue;
            if (!canNestInto(nodeId, other.id)) continue;
            const { x: cx, y: cy } = gridCellCenter(i);
            if (Math.sqrt((dragX - cx) ** 2 + (dragY - cy) ** 2) < FOLDER_CHILD_R * 2.5) {
              nestTarget = other.id;
              break;
            }
          }
          if (nestTarget) {
            nestNode(campaignId, nodeId, nestTarget);
            return;
          }
          if (canNestInto(nodeId, currentFolderId)) {
            nestNode(campaignId, nodeId, currentFolderId);
            return;
          }
          // Dropped inside folder but can't nest → shake the folder grid
          setRejectShakeFolderGridId(rootId);
          clearTimeout(shakeFolderTimerRef.current);
          shakeFolderTimerRef.current = setTimeout(() => setRejectShakeFolderGridId(null), 700);
          // Fall through — moveNode will reposition the node outside
        }
      }
    }

    moveNode(campaignId, nodeId, dragX, dragY);
  }, [campaignId, moveNode, nestNode, mapNodes, openFolderIds, folderState, canNestInto, openFolder]);

  /* ── Folder drag ──────────────────────────────────────────────────── */
  const handleFolderDragEnd = useCallback((rootFolderId, newX, newY) => {
    moveNode(campaignId, rootFolderId, newX, newY);
  }, [campaignId, moveNode]);

  /* ── Child unnest (dragged outside folder) ────────────────────────── */
  const handleChildUnnest = useCallback((childId, worldX, worldY) => {
    unnestNode(campaignId, childId, worldX, worldY);
  }, [campaignId, unnestNode]);

  /* ── Child nest (deep-nest within folder) ─────────────────────────── */
  const handleChildNest = useCallback((childId, targetId) => {
    nestNode(campaignId, childId, targetId);
  }, [campaignId, nestNode]);

  /* ── Cross-folder nest ────────────────────────────────────────────── */
  const handleCrossNest = useCallback((childId, targetRootFolderId) => {
    const targetState = folderState[targetRootFolderId];
    if (!targetState) return;
    const targetCurrentFolderId = targetState.drillPath[targetState.drillPath.length - 1];
    if (canNestInto(childId, targetCurrentFolderId)) {
      nestNode(campaignId, childId, targetCurrentFolderId);
    }
  }, [folderState, canNestInto, nestNode, campaignId]);

  /* ── Right-click ─────────────────────────────────────────────────── */
  const handleNodeRightClick = useCallback((nodeId, e) => {
    e.evt.preventDefault();
    e.cancelBubble = true;
    onNodeContextMenu?.(nodeId, e.evt.clientX, e.evt.clientY);
  }, [onNodeContextMenu]);

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        isolation: 'isolate',
        cursor: placingType || drawingMode === 'polygon' ? 'crosshair' : 'default',
        borderRadius: 'var(--radius)',
        willChange: 'transform', // promote canvas container to its own compositor layer
      }}
    >
      {!bgImage && (
        <TopoBackground style={{ zIndex: -1 }} opacity={0.5} />
      )}

      {/* ── Map depth banner — shown when drilled into a sub-map ────────── */}
      {mapStack.length > 0 && (
        <div className="map-depth-banner">
          <button
            className="map-depth-back"
            onClick={drillUpMap}
            title="Go back up one map level"
          >
            ‹ Back
          </button>
          <div className="map-depth-crumbs">
            {[...mapStack, activeMapId]
              .filter(Boolean)
              .map((id, i, arr) => {
                const m = allMaps.find((x) => x.id === id);
                if (!m) return null;
                const isLast = i === arr.length - 1;
                return (
                  <span key={id} className="map-depth-crumb-item">
                    {i > 0 && <span className="map-depth-sep">›</span>}
                    <span
                      className={`map-depth-crumb${isLast ? ' active' : ''}`}
                      onClick={() => !isLast && jumpToMap(id)}
                      title={isLast ? undefined : `Jump to ${m.name}`}
                    >
                      {m.name}
                    </span>
                  </span>
                );
              })}
          </div>
        </div>
      )}

      {stageSize.width > 0 && stageSize.height > 0 && (
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          pixelRatio={window.devicePixelRatio > 1 ? 1.5 : 1}
          draggable={!placingType && drawingMode !== 'polygon'}
          onDragMove={(e) => {
            if (e.target !== stageRef.current) return;
            const tx = e.target.x();
            const ty = e.target.y();
            if (!dragRafRef.current) {
              dragRafRef.current = requestAnimationFrame(() => {
                setViewport(tx, ty, stageScale);
                dragRafRef.current = null;
              });
            }
          }}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
              if (dragRafRef.current) {
                cancelAnimationFrame(dragRafRef.current);
                dragRafRef.current = null;
              }
              const pos = { x: e.target.x(), y: e.target.y() };
              setStagePos(pos);
              setViewport(pos.x, pos.y, stageScale);
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
              <Rect name="bg-rect" x={-3000} y={-3000} width={6000} height={6000} fill="#031012" listening={true} />
            )}

            {/* ── Territories ──
             *  Org view: opacity boosted to 0.65, stroke doubled so they read clearly.
             *  Normal:   use stored territory.opacity (typically 0.15).
             */}
            {territories.map((territory) => {
              const isSel        = territory.id === selectedTerritoryId;
              const baseOpacity  = orgView ? 0.65 : territory.opacity;
              const opacity      = isSel ? 0.45 : baseOpacity;
              const strokeWidth  = isSel
                ? 3
                : orgView
                  ? Math.max((territory.strokeWidth || 1) * 2, 2)
                  : territory.strokeWidth;
              const stroke = isSel ? '#fff' : territory.strokeColor;

              if (territory.shapeType === 'polygon') {
                return (
                  <Line
                    key={territory.id}
                    name={`territory-${territory.id}`}
                    points={territory.points.flatMap((p) => [p.x, p.y])}
                    closed={true}
                    fill={territory.color}
                    opacity={opacity}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    listening={true} perfectDrawEnabled={false} hitStrokeWidth={10}
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
                    opacity={opacity}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
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
                    opacity={opacity}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    listening={true} perfectDrawEnabled={false}
                  />
                );
              }
              return null;
            })}

            {/* Territory point editing handles */}
            {editingTerritoryId && (() => {
              const editTerritory = territories.find((t) => t.id === editingTerritoryId);
              if (!editTerritory?.points) return null;
              const liveScale = stageRef.current?.scaleX() ?? stageScale;
              return editTerritory.points.map((pt, i) => (
                <Circle
                  key={`edit-pt-${i}`}
                  x={pt.x} y={pt.y}
                  radius={7 / liveScale}
                  fill="rgba(255,146,72,0.9)"
                  stroke="#fff"
                  strokeWidth={1.5 / liveScale}
                  draggable
                  listening={true}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    const newPoints = [...editTerritory.points];
                    newPoints[i] = { x: e.target.x(), y: e.target.y() };
                    updateTerritory(campaignId, editingTerritoryId, { points: newPoints });
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt.shiftKey && editTerritory.points.length > 3) {
                      const newPoints = editTerritory.points.filter((_, idx) => idx !== i);
                      updateTerritory(campaignId, editingTerritoryId, { points: newPoints });
                    }
                  }}
                  onTap={(e) => e.cancelBubble = true}
                />
              ));
            })()}

            {/* Polygon territory draw preview */}
            {drawingMode === 'polygon' && polygonPoints.length > 0 && (
              <>
                <Line
                  points={polygonPoints.flatMap((p) => [p.x, p.y])}
                  stroke="#ff9248" strokeWidth={2} opacity={0.7} dash={[8, 4]} listening={false}
                />
                {polygonPoints.length >= 3 && (
                  <Line
                    points={[
                      polygonPoints[polygonPoints.length - 1].x,
                      polygonPoints[polygonPoints.length - 1].y,
                      polygonPoints[0].x,
                      polygonPoints[0].y,
                    ]}
                    stroke="#ff9248" strokeWidth={1} opacity={0.3} dash={[4, 6]} listening={false}
                  />
                )}
              </>
            )}
            {drawingMode === 'polygon' && polygonPoints.map((p, i) => (
              <Circle
                key={`pp-${i}`}
                x={p.x} y={p.y}
                radius={i === 0 ? 7 : 5}
                fill={i === 0 ? '#ff9248' : '#8ea1a4'}
                stroke={i === 0 ? '#fff' : undefined}
                strokeWidth={i === 0 ? 1.5 : 0}
                opacity={0.8} listening={false}
              />
            ))}

            {/* ── Nodes — dimmed in org view so territories dominate ── */}
            <Group opacity={orgView ? 0.18 : 1}>
              {/* Standalone node circles */}
              {regularNodes.map((node) => {
                const color    = getTypeColor(node.type, nodeTypeOverrides, customNodeTypes);
                const iconName = node.icon || getTypeIcon(node.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
                const isSearchDimmed = searchHighlightIds
                  ? !searchHighlightIds.has(node.id)
                  : false;
                return (
                  <MapNode
                    key={node.id}
                    id={node.id}
                    x={node.x}
                    y={node.y}
                    type={node.type}
                    name={node.fields?.name || node.type}
                    color={color}
                    iconName={iconName}
                    isSelected={node.id === selectedNodeId}
                    isInactive={isNodeInactive(node)}
                    isHidden={node.statusFlags ? !node.statusFlags.revealed : false}
                    childCount={nestCounts[node.id] || 0}
                    isSearchDimmed={isSearchDimmed}
                    isNestTarget={node.id === nestTargetId}
                    isRejectTarget={node.id === rejectTargetId}
                    isShaking={node.id === rejectShakeId}
                    hasChildMap={childMapNodeIds.has(node.id)}
                    onDragEnd={handleNodeDragEnd}
                    onDragMove={handleNodeDragMove}
                    onClick={handleNodeClick}
                    onDblClick={handleNodeDblClick}
                    onContextMenu={handleNodeRightClick}
                  />
                );
              })}

              {/* Open folder grids */}
              {Array.from(openFolderIds).map((rootId) => {
                const state = folderState[rootId];
                if (!state) return null;
                return (
                  <FolderGrid
                    key={`folder-${rootId}`}
                    rootFolderId={rootId}
                    drillPath={state.drillPath}
                    page={state.page}
                    allMapNodes={mapNodes}
                    selectedNodeId={selectedNodeId}
                    nestCounts={nestCounts}
                    nodeTypeOverrides={nodeTypeOverrides}
                    customNodeTypes={customNodeTypes}
                    onClose={closeFolder}
                    onCloseComplete={handleFolderCloseComplete}
                    isClosing={!!state.closing}
                    onDrillInto={drillIntoFolder}
                    onDrillUp={drillUpToIndex}
                    onPageChange={setFolderPage}
                    onChildSelect={selectNode}
                    onChildContextMenu={onNodeContextMenu}
                    onChildUnnest={handleChildUnnest}
                    onChildNest={handleChildNest}
                    onFolderDragEnd={handleFolderDragEnd}
                    openFolderBounds={openFolderBounds}
                    onCrossNest={handleCrossNest}
                    isRejectTarget={rootId =