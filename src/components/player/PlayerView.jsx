import { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KImage, Circle, Text, Group, Rect } from 'react-konva';
import { ArrowsOut, ArrowCounterClockwise, X } from '@phosphor-icons/react';
import { playerGetView, playerGetNotes, clearPlayerSession } from '../../utils/api';
import PlayerNotePanel from './PlayerNotePanel';

const NODE_RADIUS = 14;

function PlayerNode({ node, onClick }) {
  const color = node.color || '#60a5fa';
  return (
    <Group
      x={node.x}
      y={node.y}
      listening={true}
      onClick={(e) => { e.cancelBubble = true; onClick(node); }}
      onTap={(e)   => { e.cancelBubble = true; onClick(node); }}
    >
      <Circle radius={NODE_RADIUS + 4} fill={color} opacity={0.18} />
      <Circle radius={NODE_RADIUS} fill={color} opacity={0.9} />
      <Text
        text={node.name}
        fontSize={11}
        fill="#fff"
        stroke="#00000088"
        strokeWidth={2}
        fillAfterStrokeEnabled
        align="center"
        offsetX={60}
        width={120}
        y={NODE_RADIUS + 4}
        listening={false}
      />
    </Group>
  );
}

export default function PlayerView({ session, onLogout }) {
  const containerRef   = useRef(null);
  const stageRef       = useRef(null);
  const dragRafRef     = useRef(null);

  const [stageSize,  setStageSize]  = useState({ width: 800, height: 600 });
  const [stagePos,   setStagePos]   = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null);

  const [viewData,   setViewData]   = useState(null);
  const [myNotes,    setMyNotes]    = useState([]);
  const [bgImages,   setBgImages]   = useState({}); // mapId → HTMLImageElement
  const [overlayImgs, setOverlayImgs] = useState({}); // url → HTMLImageElement
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [activeMapId, setActiveMapId] = useState(null);

  // Load view data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [view, notes] = await Promise.all([playerGetView(), playerGetNotes()]);
        if (cancelled) return;
        setViewData(view);
        setMyNotes(notes.notes || []);
        setActiveMapId(view.maps?.[0]?.id || null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Load background images when maps change
  useEffect(() => {
    if (!viewData?.maps) return;
    viewData.maps.forEach((map) => {
      if (!map.image || bgImages[map.id]) return;
      const img = new window.Image();
      img.onload = () => setBgImages((prev) => ({ ...prev, [map.id]: img }));
      img.src = map.image;
    });
  }, [viewData?.maps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load overlay images
  useEffect(() => {
    if (!viewData?.overlays) return;
    viewData.overlays.forEach((o) => {
      if (!o.url || overlayImgs[o.url] !== undefined) return;
      const img = new window.Image();
      img.onload  = () => setOverlayImgs((prev) => ({ ...prev, [o.url]: img }));
      img.onerror = () => setOverlayImgs((prev) => ({ ...prev, [o.url]: null }));
      img.src = o.url;
    });
  }, [viewData?.overlays]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Pan (drag canvas)
  const handleMouseDown = useCallback((e) => {
    if (e.target !== e.currentTarget && e.target.name?.() !== 'player-bg') return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.evt.clientX,
      mouseY: e.evt.clientY,
      stageX: stageRef.current?.x() ?? stagePos.x,
      stageY: stageRef.current?.y() ?? stagePos.y,
    };
  }, [stagePos]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.evt.clientX - dragStartRef.current.mouseX;
    const dy = e.evt.clientY - dragStartRef.current.mouseY;
    const nx = dragStartRef.current.stageX + dx;
    const ny = dragStartRef.current.stageY + dy;
    stageRef.current?.position({ x: nx, y: ny });
    cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = requestAnimationFrame(() => setStagePos({ x: nx, y: ny }));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.08;
    const oldScale = stage.scaleX();
    const pointer  = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clamped  = Math.max(0.05, Math.min(8, newScale));
    const newPos = {
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    };
    stage.scale({ x: clamped, y: clamped });
    stage.position(newPos);
    setStageScale(clamped);
    setStagePos(newPos);
  }, []);

  const handleNoteUpdated = (nodeId, text) => {
    setMyNotes((prev) => {
      const existing = prev.find((n) => n.node_id === nodeId);
      if (existing) return prev.map((n) => n.node_id === nodeId ? { ...n, text } : n);
      return [...prev, { node_id: nodeId, text }];
    });
  };

  const activeMap    = viewData?.maps?.find((m) => m.id === activeMapId);
  const activeNodes  = viewData?.nodes?.filter((n) => n.mapId === activeMapId) || [];
  const activeOverlays = viewData?.overlays?.filter((o) => o.mapId === activeMapId) || [];

  if (loading) {
    return (
      <div className="player-view-loading">
        <div className="player-loading-spinner" />
        <span>Loading your campaign…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="player-view-loading">
        <div style={{ color: '#f87171', marginBottom: 12 }}>{error}</div>
        <button className="player-join-btn" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="player-view">
      {/* Header */}
      <div className="player-view-header">
        <span className="player-view-logo">Flux Atlas</span>
        <div className="player-view-maps">
          {viewData?.maps?.map((map) => (
            <button
              key={map.id}
              className={`player-map-tab ${map.id === activeMapId ? 'active' : ''}`}
              onClick={() => { setActiveMapId(map.id); setSelectedNode(null); }}
            >
              {map.name}
            </button>
          ))}
        </div>
        <div className="player-view-header-right">
          <span className="player-session-chip" style={{ borderColor: session.color }}>
            <span className="player-session-dot" style={{ background: session.color }} />
            {session.displayName}
          </span>
          <button
            className="btn-icon"
            title="Leave player view"
            onClick={() => { clearPlayerSession(); onLogout(); }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Canvas + note panel */}
      <div className="player-view-body">
        <div
          ref={containerRef}
          className="player-canvas-container"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onClick={(e) => {
              if (e.target === e.currentTarget || e.target.name?.() === 'player-bg') {
                setSelectedNode(null);
              }
            }}
          >
            <Layer>
              {/* Background */}
              {bgImages[activeMapId] ? (
                <KImage
                  name="player-bg"
                  image={bgImages[activeMapId]}
                  x={activeMap?.imageX ?? 0}
                  y={activeMap?.imageY ?? 0}
                  width={activeMap?.imageWidth ?? bgImages[activeMapId]?.naturalWidth}
                  height={activeMap?.imageHeight ?? bgImages[activeMapId]?.naturalHeight}
                  listening={true}
                  perfectDrawEnabled={false}
                />
              ) : (
                <Rect name="player-bg" x={-4000} y={-4000} width={8000} height={8000} fill="#031012" listening={true} />
              )}

              {/* Overlays */}
              {activeOverlays.map((o) => {
                const img = overlayImgs[o.url];
                if (!img) return null;
                return (
                  <KImage
                    key={o.id}
                    image={img}
                    x={o.x} y={o.y}
                    width={o.width} height={o.height}
                    opacity={o.opacity}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                );
              })}

              {/* Revealed nodes */}
              {activeNodes.map((node) => (
                <PlayerNode
                  key={node.id}
                  node={node}
                  onClick={setSelectedNode}
                />
              ))}
            </Layer>
          </Stage>
        </div>

        {/* Note panel */}
        {selectedNode && (
          <PlayerNotePanel
            node={selectedNode}
            session={session}
            allNotes={viewData?.allNotes || []}
            myNotes={myNotes}
            onClose={() => setSelectedNode(null)}
            onNoteSaved={handleNoteUpdated}
          />
        )}
      </div>

      {activeNodes.length === 0 && (
        <div className="player-empty-state">
          No locations revealed yet — check back after your GM unveils some!
        </div>
      )}
    </div>
  );
}
