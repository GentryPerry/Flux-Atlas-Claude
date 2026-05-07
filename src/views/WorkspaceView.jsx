import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import polygonClipping from 'polygon-clipping';
import { SquareSplitHorizontal, Rows, Eye, EyeSlash } from '@phosphor-icons/react';
import useViewportStore from '../stores/viewportStore';
import useCampaignStore from '../stores/campaignStore';
import useMapStore from '../stores/mapStore';
import useNodeStore from '../stores/nodeStore';
import useTagStore from '../stores/tagStore';
import useSettingsStore from '../stores/settingsStore';
import useTerritoryStore from '../stores/territoryStore';
import useMapOverlayStore from '../stores/mapOverlayStore';
import MapSidebar from '../components/map/MapSidebar';
import MapToolbar from '../components/map/MapToolbar';
import MapCanvas from '../components/map/MapCanvas';
import DetailPanel from '../components/nodes/DetailPanel';
import CardPanel from '../components/map/CardPanel';
import SettingsPanel from '../components/settings/SettingsPanel';
import MapLegend from '../components/map/MapLegend';
import NodeContextMenu from '../components/map/NodeContextMenu';
import KanbanBoard from '../components/map/KanbanBoard';
import HierarchyTreeView from '../components/map/HierarchyTreeView';
import TerritoryToolbar from '../components/map/TerritoryToolbar';
import TerritoryDetailPanel from '../components/map/TerritoryDetailPanel';
import SearchOverlay from '../components/map/SearchOverlay';
import TopoBackground from '../components/common/TopoBackground';
import AdvanceTimeModal from '../components/time/AdvanceTimeModal';
import TroubleEngineModal from '../components/time/TroubleEngineModal';
import SnapshotSidebar from '../components/time/SnapshotSidebar';
import WidgetLayer from '../components/widgets/WidgetLayer';
import ResetModal from '../components/common/ResetModal';
import OnboardingTour from '../components/onboarding/OnboardingTour';
import OnboardingTourMobile from '../components/onboarding/OnboardingTourMobile';
import useSnapshotStore from '../stores/snapshotStore';
import useUndoStore from '../stores/undoStore';
import usePlayerRevealStore from '../stores/playerRevealStore';
import { uploadImage } from '../utils/api';
import InvitePanel from '../components/player/InvitePanel';
import useWidgetStore from '../stores/widgetStore';
import useHierarchyStore from '../stores/hierarchyStore';
import useMobile from '../hooks/useMobile';
import ErrorBoundary from '../components/common/ErrorBoundary';
import MobileHeader from '../components/mobile/MobileHeader';
import MobileBottomNav from '../components/mobile/MobileBottomNav';
import MobileNodeSheet from '../components/mobile/MobileNodeSheet';
import MobileCampaignSheet from '../components/mobile/MobileCampaignSheet';
import MobileNodePlacer from '../components/mobile/MobileNodePlacer';
import MobileBoardView from '../components/mobile/MobileBoardView';
import MobileSettingsPanel from '../components/mobile/MobileSettingsPanel';

export default function WorkspaceView() {
  const isMobile = useMobile();

  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);

  const loadMaps = useMapStore((s) => s.loadMaps);
  const loadNodes = useNodeStore((s) => s.loadNodes);
  const allNodes   = useNodeStore((s) => s.nodes);
  const updateNode = useNodeStore((s) => s.updateNode);
  const loadTags = useTagStore((s) => s.loadTags);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadTerritories  = useTerritoryStore((s) => s.loadTerritories);
  const allTerritories   = useTerritoryStore((s) => s.territories);
  const deselectNode = useNodeStore((s) => s.deselectNode);
  const loadSnapshots    = useSnapshotStore((s) => s.loadSnapshots);
  const takeSnapshot     = useSnapshotStore((s) => s.takeSnapshot);
  const loadWidgets      = useWidgetStore((s) => s.loadWidgets);
  const loadHierarchies  = useHierarchyStore((s) => s.loadHierarchies);

  const loadReveal       = usePlayerRevealStore((s) => s.loadReveal);
  const revealedNodeIds  = usePlayerRevealStore((s) => s.revealedNodeIds);

  // Map layer overlay store
  const loadOverlays   = useMapOverlayStore((s) => s.loadOverlays);
  const addOverlay     = useMapOverlayStore((s) => s.addOverlay);
  const updateOverlay  = useMapOverlayStore((s) => s.updateOverlay);
  const deleteOverlay  = useMapOverlayStore((s) => s.deleteOverlay);
  const mapOverlays    = useMapOverlayStore((s) => s.overlays);

  // Settings-driven layout
  const layout = useSettingsStore((s) => s.layout);
  const mapSide = useSettingsStore((s) => s.mapSide);
  const settingsOpen = useSettingsStore((s) => s.settingsOpen);

  // Close detail panel when switching to full-canvas mode
  useEffect(() => {
    if (layout === 'full') deselectNode();
  }, [layout, deselectNode]);

  const [placingType, setPlacingType] = useState(null);
  const [activeView, setActiveView] = useState('map'); // 'map' | 'board' | 'hierarchy'
  const [orgView, setOrgView] = useState(false); // overlay toggle
  const [drawingMode, setDrawingMode] = useState(null);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [territoryOwnerId, setTerritoryOwnerId] = useState(null);
  const [territoryColor, setTerritoryColor] = useState('#8890a0');
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);
  const [editingTerritoryId, setEditingTerritoryId] = useState(null);
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState([]); // multi-select
  const [overlapPicker, setOverlapPicker] = useState(null); // { x, y, ids[] }
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlightIds, setSearchHighlightIds] = useState(null);
  const [advanceTimeOpen,    setAdvanceTimeOpen]    = useState(false);
  const [troubleEngineOpen,  setTroubleEngineOpen]  = useState(false);
  const [historyOpen,        setHistoryOpen]         = useState(false);
  const [resetOpen,          setResetOpen]           = useState(false);
  const [playerPreviewMode,  setPlayerPreviewMode]   = useState(false);
  const [invitePanelOpen,    setInvitePanelOpen]     = useState(false);

  // Mobile-specific state
  const [mobileDetailOpen,    setMobileDetailOpen]    = useState(false);
  const [mobileCampaignOpen,  setMobileCampaignOpen]  = useState(false);

  // Panel exit animation
  const [panelExiting, setPanelExiting] = useState(false);
  const prevLayoutRef = useRef(layout);
  useEffect(() => {
    const prev = prevLayoutRef.current;
    prevLayoutRef.current = layout;
    if (prev === 'split' && layout === 'full') {
      setPanelExiting(true);
      const t = setTimeout(() => setPanelExiting(false), 160);
      return () => clearTimeout(t);
    }
  }, [layout]);

  // Hidden reset shortcut: Ctrl+Shift+Backspace
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Backspace') {
        e.preventDefault();
        setResetOpen(true);
      }
      // Shift+/ (?) — relaunch onboarding tour
      if (e.shiftKey && e.key === '?') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('flux:startTour'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Undo (Ctrl+Z) ─────────────────────────────────────────────────────────
  const undoHistory  = useUndoStore((s) => s.history);
  const canUndo      = undoHistory.length > 0;
  const handleUndo   = useCallback(() => {
    if (campaignId) useUndoStore.getState().undo(campaignId);
  }, [campaignId]);

  // Clear undo history when the campaign changes so old state can't bleed across
  useEffect(() => {
    useUndoStore.getState().clearHistory();
  }, [campaignId]);

  // Ctrl+Z keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Don't intercept if focus is inside an input or contenteditable
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo]);

  // Allow the TroubleEngineWidget on the canvas to open the modal
  useEffect(() => {
    const handler = () => setTroubleEngineOpen(true);
    window.addEventListener('flux:openTroubleEngine', handler);
    return () => window.removeEventListener('flux:openTroubleEngine', handler);
  }, []);

  const activeMapId = useMapStore((s) => s.activeMapId);
  const createTerritory = useTerritoryStore((s) => s.createTerritory);
  const deleteTerritory = useTerritoryStore((s) => s.deleteTerritory);
  const updateTerritory = useTerritoryStore((s) => s.updateTerritory);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);

  const handleSetDrawingMode = useCallback((mode) => {
    if (!mode) {
      setPolygonPoints([]);
      setTerritoryOwnerId(null);
      setTerritoryColor('#8890a0');
    }
    setDrawingMode(mode);
  }, []);

  const handleFinishDrawing = useCallback(() => {
    if (polygonPoints.length < 3) return;
    const ownerNode = territoryOwnerId ? allNodes.find((n) => n.id === territoryOwnerId) : null;
    createTerritory(campaignId, activeMapId, 'polygon', {
      points: polygonPoints,
      nodeId: territoryOwnerId || null,
      name: ownerNode ? `${ownerNode.fields?.name} Territory` : `Territory ${new Date().toLocaleTimeString()}`,
      color: territoryColor,
      strokeColor: territoryColor,
      opacity: 0.15,
    });
    setPolygonPoints([]);
    setDrawingMode(null);
    setTerritoryOwnerId(null);
    setTerritoryColor('#8890a0');
  }, [polygonPoints, territoryOwnerId, territoryColor, allNodes, campaignId, activeMapId, createTerritory]);

  // ── Territory overlap picker ──────────────────────────────────────────────────
  const handleTerritoryOverlapPick = useCallback((x, y, ids) => {
    setOverlapPicker({ x, y, ids });
    setSelectedTerritoryIds([]);
  }, []);

  const handleOverlapSelect = useCallback((id) => {
    setSelectedTerritoryId(id);
    setSelectedTerritoryIds([]);
    setOverlapPicker(null);
  }, []);

  // ── Territory shift-click multi-select ───────────────────────────────────────
  const handleTerritoryShiftClick = useCallback((id) => {
    setOverlapPicker(null);
    setSelectedTerritoryId(null);
    setSelectedTerritoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  // ── Territory merge (polygon-clipping union) ──────────────────────────────────
  const handleMergeTerritories = useCallback(() => {
    const toMerge  = allTerritories.filter((t) => selectedTerritoryIds.includes(t.id));
    const polygons = toMerge.filter((t) => t.shapeType === 'polygon' && t.points?.length >= 3);
    if (polygons.length < 2) return;

    // Convert {x,y}[] → polygon-clipping ring format [[[x,y], ...]]
    const rings = polygons.map((t) => [t.points.map((p) => [p.x, p.y])]);

    let result;
    try {
      result = polygonClipping.union(...rings);
    } catch (err) {
      console.warn('Polygon union failed:', err);
      return;
    }

    if (!result?.length) return;

    const base = polygons[0];

    // union() returns a MultiPolygon — one entry per disconnected region.
    // If the territories overlap/touch we get 1; if they're separate we get N.
    for (const outputPoly of result) {
      // outputPoly[0] = outer ring; subsequent rings = holes (rare in this context)
      const outerRing = outputPoly[0];
      // polygon-clipping closes the ring (last pt === first pt) — drop the duplicate
      const points = outerRing
        .slice(0, -1)
        .map(([x, y]) => ({ x, y }));

      createTerritory(campaignId, activeMapId, 'polygon', {
        points,
        nodeId:      base.nodeId,
        name:        base.name,
        color:       base.color,
        strokeColor: base.strokeColor,
        strokeWidth: base.strokeWidth,
        opacity:     base.opacity,
      });
    }

    // Remove the original territories
    for (const t of polygons) deleteTerritory(campaignId, t.id);
    setSelectedTerritoryIds([]);
  }, [allTerritories, selectedTerritoryIds, campaignId, activeMapId, createTerritory, deleteTerritory]);

  useEffect(() => {
    if (!campaignId) return;
    loadMaps(campaignId);
    loadNodes(campaignId);
    loadTags(campaignId);
    loadSettings(campaignId);
    loadTerritories(campaignId);
    loadSnapshots(campaignId);
    loadWidgets(campaignId);
    loadHierarchies(campaignId);
    loadOverlays(campaignId);
    loadReveal(campaignId);
  }, [campaignId, loadMaps, loadNodes, loadTags, loadSettings, loadTerritories, loadSnapshots, loadWidgets, loadHierarchies, loadOverlays, loadReveal]);

  const handlePlacingDone = useCallback(() => {
    setPlacingType(null);
  }, []);

  const handleNodeContextMenu = useCallback((nodeId, viewportX, viewportY) => {
    setContextMenu({ nodeId, x: viewportX, y: viewportY });
  }, []);

  const handleAddMapLayer = useCallback(async (file) => {
    if (!campaignId || !activeMapId) return;
    try {
      const url = await uploadImage(file);
      // Read natural dimensions from the file before placing, to avoid squishing
      const { naturalW, naturalH } = await new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve({ naturalW: img.naturalWidth, naturalH: img.naturalHeight });
        img.onerror = () => resolve({ naturalW: 600, naturalH: 450 });
        img.src = URL.createObjectURL(file);
      });
      // Fit within ~700px on the longest axis while preserving aspect ratio
      const MAX_SIDE = 700;
      const ratio = naturalW / (naturalH || 1);
      let w, h;
      if (naturalW >= naturalH) {
        w = Math.min(naturalW, MAX_SIDE);
        h = w / ratio;
      } else {
        h = Math.min(naturalH, MAX_SIDE);
        w = h * ratio;
      }
      // Place overlay at the center of the current viewport in world coordinates
      const { x: vpX, y: vpY, scale } = useViewportStore.getState();
      const worldCX = (window.innerWidth  / 2 - vpX) / scale;
      const worldCY = (window.innerHeight / 2 - vpY) / scale;
      addOverlay(campaignId, activeMapId, url, {
        x: worldCX - w / 2,
        y: worldCY - h / 2,
        width:  Math.round(w),
        height: Math.round(h),
      });
    } catch (err) {
      console.warn('Map layer upload failed:', err);
    }
  }, [campaignId, activeMapId, addOverlay]);

  const mapCanvas = (
    <ErrorBoundary fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: 1, color: '#f87171', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14 }}>
        Canvas error — try reloading the page.
      </div>
    }>
      <MapCanvas
        placingType={placingType}
        onPlacingDone={handlePlacingDone}
        onNodeContextMenu={handleNodeContextMenu}
        drawingMode={drawingMode}
        setDrawingMode={handleSetDrawingMode}
        polygonPoints={polygonPoints}
        setPolygonPoints={setPolygonPoints}
        selectedTerritoryId={selectedTerritoryId}
        setSelectedTerritoryId={(id) => { setSelectedTerritoryId(id); setSelectedTerritoryIds([]); setOverlapPicker(null); }}
        selectedTerritoryIds={selectedTerritoryIds}
        onTerritoryShiftClick={handleTerritoryShiftClick}
        onTerritoryOverlapPick={handleTerritoryOverlapPick}
        editingTerritoryId={editingTerritoryId}
        searchHighlightIds={searchHighlightIds}
        orgView={orgView}
        mapOverlays={mapOverlays}
        onUpdateOverlay={updateOverlay}
        onDeleteOverlay={deleteOverlay}
        playerPreviewMode={playerPreviewMode}
        revealedNodeIds={revealedNodeIds}
      />
    </ErrorBoundary>
  );

  const rightPanel = (
    <ErrorBoundary fallback={
      <div style={{ padding: 24, color: '#f87171', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14 }}>
        Panel error — select another node to recover.
      </div>
    }>
      {selectedNodeId ? <DetailPanel /> : <CardPanel />}
    </ErrorBoundary>
  );

  const setSetting    = useSettingsStore((s) => s.setSetting);

  // Split/Full toggle
  const splitToggle = (
    <button
      className="split-toggle-btn"
      data-tour="split-toggle"
      onClick={() => setSetting(campaignId, 'layout', layout === 'split' ? 'full' : 'split')}
      title={layout === 'split' ? 'Switch to full canvas' : 'Switch to split view'}
    >
      {layout === 'split'
        ? <SquareSplitHorizontal size={14} />
        : <Rows size={14} />
      }
      <span>{layout === 'split' ? 'Split' : 'Full'}</span>
    </button>
  );

  // Drag-from-staging drop zone
  const mapContainerRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes('staging-node-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e) => {
    const nodeId = e.dataTransfer.getData('staging-node-id');
    if (!nodeId) return;
    e.preventDefault();
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x: vpX, y: vpY, scale } = useViewportStore.getState();
    const canvasX = (e.clientX - rect.left - vpX) / scale;
    const canvasY = (e.clientY - rect.top  - vpY) / scale;
    updateNode(campaignId, nodeId, { mapId: activeMapId, x: canvasX, y: canvasY });
  }, [campaignId, activeMapId, updateNode]);

  // Org View floating toggle — pinned top-right of the map canvas column.
  // Lives inside mapColumn so it tracks the map's right edge when the
  // detail panel slides in and shrinks the map area.
  const orgViewToggle = activeView === 'map' && (
    <button
      className={`org-view-toggle-btn${orgView ? ' active' : ''}`}
      onClick={() => setOrgView((v) => !v)}
      title={orgView ? 'Hide Org View overlay' : 'Show Org View overlay'}
    >
      {orgView ? <EyeSlash size={14} /> : <Eye size={14} />}
      <span>Org View</span>
    </button>
  );

  // Shared map column
  const mapColumn = (
    <div
      ref={mapContainerRef}
      data-tour="canvas"
      style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {mapCanvas}
      {orgViewToggle}
      <div className="map-corner-stack">
        <TerritoryToolbar
          drawingMode={drawingMode}
          setDrawingMode={handleSetDrawingMode}
          territoryOwnerId={territoryOwnerId}
          setTerritoryOwnerId={setTerritoryOwnerId}
          territoryColor={territoryColor}
          setTerritoryColor={setTerritoryColor}
          polygonPointCount={polygonPoints.length}
          onFinishDrawing={handleFinishDrawing}
        />
        <MapLegend />
      </div>
      {splitToggle}
    </div>
  );

  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];
  const colorOverrideStyle = useMemo(() => {
    const style = {};
    for (const [type, overrides] of Object.entries(nodeTypeOverrides)) {
      if (overrides.color) style[`--node-${type}`] = overrides.color;
    }
    for (const ct of customNodeTypes) {
      if (ct.color) style[`--node-${ct.id}`] = ct.color;
    }
    return style;
  }, [nodeTypeOverrides, customNodeTypes]);

  // ── Mobile layout ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="app-layout-mobile" style={colorOverrideStyle}>
        <MobileHeader
          onOpenSearch={() => setSearchOpen(true)}
          onOpenCampaignSheet={() => setMobileCampaignOpen(true)}
        />

        {/* Main content area */}
        <div className="mobile-content">
          <TopoBackground style={{ position: 'absolute', inset: 0, zIndex: 0 }} opacity={0.35} />

          {activeView === 'board' ? (
            <MobileBoardView />
          ) : activeView === 'nodes' ? (
            <div className="mobile-nodes-pane">
              <CardPanel />
            </div>
          ) : activeView === 'hierarchy' ? (
            <HierarchyTreeView />
          ) : activeView === 'settings' ? null : (
            <>
              <ErrorBoundary fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flex: 1, color: '#f87171', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14 }}>
                  Canvas error — try reloading.
                </div>
              }>
                <MapCanvas
                  placingType={placingType}
                  onPlacingDone={handlePlacingDone}
                  onNodeContextMenu={handleNodeContextMenu}
                  drawingMode={drawingMode}
                  setDrawingMode={handleSetDrawingMode}
                  polygonPoints={polygonPoints}
                  setPolygonPoints={setPolygonPoints}
                  selectedTerritoryId={selectedTerritoryId}
                  setSelectedTerritoryId={(id) => { setSelectedTerritoryId(id); setSelectedTerritoryIds([]); setOverlapPicker(null); }}
                  selectedTerritoryIds={selectedTerritoryIds}
                  onTerritoryShiftClick={handleTerritoryShiftClick}
                  onTerritoryOverlapPick={handleTerritoryOverlapPick}
                  editingTerritoryId={editingTerritoryId}
                  searchHighlightIds={searchHighlightIds}
                  orgView={orgView}
                  playerPreviewMode={playerPreviewMode}
                  revealedNodeIds={revealedNodeIds}
                />
              </ErrorBoundary>
              {/* Widgets render but are non-interactive on mobile (CSS: pointer-events:none) */}
              <WidgetLayer />
              {/* FAB for placing node types */}
              <MobileNodePlacer placingType={placingType} setPlacingType={setPlacingType} />
            </>
          )}
        </div>

        {/* Bottom nav */}
        <MobileBottomNav activeView={activeView} setActiveView={setActiveView} />

        {/* Node bottom sheet — only when not in full-screen detail */}
        {selectedNodeId && !mobileDetailOpen && (
          <MobileNodeSheet
            key={selectedNodeId}
            nodeId={selectedNodeId}
            onClose={deselectNode}
            onOpenDetail={() => setMobileDetailOpen(true)}
          />
        )}

        {/* Full-screen detail overlay */}
        {selectedNodeId && mobileDetailOpen && (
          <div className="mobile-detail-overlay">
            <div className="mobile-detail-back-bar">
              <button
                className="mobile-back-btn"
                onClick={() => setMobileDetailOpen(false)}
              >
                ← Back
              </button>
            </div>
            <div className="mobile-detail-scroll">
              <ErrorBoundary fallback={
                <div style={{ padding: 24, color: '#f87171', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14 }}>
                  Panel error — go back and select another node.
                </div>
              }>
                <DetailPanel />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {/* Campaign / map sheet */}
        {mobileCampaignOpen && (
          <MobileCampaignSheet onClose={() => setMobileCampaignOpen(false)} />
        )}

        {/* Context menu */}
        {contextMenu && (
          <NodeContextMenu
            nodeId={contextMenu.nodeId}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onClose={() => setContextMenu(null)}
          />
        )}

        {activeView === 'settings' && (
          <MobileSettingsPanel onBack={() => setActiveView('map')} />
        )}


        {searchOpen && (
          <SearchOverlay
            onClose={() => { setSearchOpen(false); setSearchHighlightIds(null); }}
          />
        )}

        {resetOpen && <ResetModal onClose={() => setResetOpen(false)} />}

        <OnboardingTourMobile />
      </div>
    );
  }

  // ── Desktop layout ──────────────────────────────
  return (
    <div className="app-layout" style={colorOverrideStyle}>
      <MapSidebar />
      <div className="main-content">
        <MapToolbar
          placingType={placingType}
          setPlacingType={setPlacingType}
          activeView={activeView}
          setActiveView={setActiveView}
          drawingMode={drawingMode}
          setDrawingMode={handleSetDrawingMode}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenFluxSystem={() => setAdvanceTimeOpen(true)}
          onOpenTroubleEngine={() => setTroubleEngineOpen(true)}
          onToggleHistory={() => setHistoryOpen((v) => !v)}
          historyOpen={historyOpen}
          onAddMapLayer={handleAddMapLayer}
          onTakeSnapshot={() => takeSnapshot(
            campaignId,
            `Snapshot ${new Date().toLocaleString()}`,
            { nodes: allNodes ?? [], territories: allTerritories ?? [] },
          )}
          onUndo={handleUndo}
          canUndo={canUndo}
          playerPreviewMode={playerPreviewMode}
          onTogglePlayerPreview={() => setPlayerPreviewMode((v) => !v)}
          onOpenInvitePanel={() => setInvitePanelOpen((v) => !v)}
        />

        {invitePanelOpen && (
          <InvitePanel campaignId={campaignId} onClose={() => setInvitePanelOpen(false)} />
        )}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          <TopoBackground style={{ position: 'absolute', inset: 0, zIndex: 0 }} opacity={0.35} />
          {activeView === 'map' && <WidgetLayer />}
          {activeView === 'board' ? (
            <div className="view-enter" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <KanbanBoard />
              {selectedNodeId && (
                <>
                  <div className="split-divider" />
                  <DetailPanel />
                </>
              )}
            </div>
          ) : activeView === 'hierarchy' ? (
            <div className="view-enter" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <HierarchyTreeView />
              {selectedNodeId && (
                <>
                  <div className="split-divider" />
                  <DetailPanel />
                </>
              )}
            </div>
          ) : layout === 'full' && !panelExiting ? (
            <>
              {mapColumn}
              {selectedNodeId && <DetailPanel />}
            </>
          ) : (
            <>
              {mapSide === 'left' ? (
                <>
                  {mapColumn}
                  <div className="split-divider" style={panelExiting ? { opacity: 0 } : {}} />
                  <div style={panelExiting ? { animation: 'slideOut 150ms var(--ease) both', pointerEvents: 'none', display: 'flex' } : { display: 'flex' }}>
                    {rightPanel}
                  </div>
                </>
              ) : (
                <>
                  <div style={panelExiting ? { animation: 'slideOut 150ms var(--ease) both', pointerEvents: 'none', display: 'flex' } : { display: 'flex' }}>
                    {rightPanel}
                  </div>
                  <div className="split-divider" style={panelExiting ? { opacity: 0 } : {}} />
                  {mapColumn}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {selectedTerritoryId && !drawingMode && (
        <TerritoryDetailPanel
          territoryId={selectedTerritoryId}
          onClose={() => { setSelectedTerritoryId(null); setEditingTerritoryId(null); }}
          editingPoints={editingTerritoryId === selectedTerritoryId}
          onToggleEditPoints={() => setEditingTerritoryId(
            editingTerritoryId === selectedTerritoryId ? null : selectedTerritoryId
          )}
        />
      )}

      {/* ── Territory overlap picker ───────────────────── */}
      {overlapPicker && (
        <div
          className="territory-overlap-picker"
          style={{ left: overlapPicker.x + 8, top: overlapPicker.y + 8 }}
          onMouseLeave={() => setOverlapPicker(null)}
        >
          <div className="territory-overlap-header">Select territory</div>
          {overlapPicker.ids.map((id) => {
            const t = allTerritories.find((t) => t.id === id);
            if (!t) return null;
            return (
              <button
                key={id}
                className="territory-overlap-item"
                onClick={() => handleOverlapSelect(id)}
              >
                <span className="territory-overlap-dot" style={{ background: t.color }} />
                <span className="territory-overlap-name">{t.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Territory combine bar (shown when 2+ are shift-selected) ─── */}
      {selectedTerritoryIds.length >= 2 && (
        <div className="territory-combine-bar">
          <span className="territory-combine-label">
            {selectedTerritoryIds.length} territories selected
          </span>
          {allTerritories.filter((t) => selectedTerritoryIds.includes(t.id) && t.shapeType === 'polygon').length >= 2 && (
            <button className="territory-combine-btn" onClick={handleMergeTerritories}>
              Combine into one
            </button>
          )}
          <button className="territory-combine-cancel" onClick={() => setSelectedTerritoryIds([])}>
            ✕
          </button>
        </div>
      )}

      {contextMenu && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {advanceTimeOpen && (
        <AdvanceTimeModal
          campaignId={campaignId}
          onClose={() => setAdvanceTimeOpen(false)}
        />
      )}

      {troubleEngineOpen && (
        <TroubleEngineModal onClose={() => setTroubleEngineOpen(false)} />
      )}

      {historyOpen && (
        <SnapshotSidebar
          campaignId={campaignId}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {settingsOpen && <SettingsPanel />}

      {resetOpen && <ResetModal onClose={() => setResetOpen(false)} />}

      {searchOpen && (
        <SearchOverlay
          onClose={() => { setSearchOpen(false); setSearchHighlightIds(null); }}
        />
      )}

      <OnboardingTour />
    </div>
  );
}
