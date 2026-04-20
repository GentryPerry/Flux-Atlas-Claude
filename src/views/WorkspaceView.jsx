import { useState, useCallback, useEffect, useMemo } from 'react';
import useCampaignStore from '../stores/campaignStore';
import useMapStore from '../stores/mapStore';
import useNodeStore from '../stores/nodeStore';
import useTagStore from '../stores/tagStore';
import useConnectionStore from '../stores/connectionStore';
import useSettingsStore from '../stores/settingsStore';
import useTerritoryStore from '../stores/territoryStore';
import MapSidebar from '../components/map/MapSidebar';
import MapToolbar from '../components/map/MapToolbar';
import MapCanvas from '../components/map/MapCanvas';
import DetailPanel from '../components/nodes/DetailPanel';
import CardPanel from '../components/map/CardPanel';
import SettingsPanel from '../components/settings/SettingsPanel';
import MapLegend from '../components/map/MapLegend';
import NodeContextMenu from '../components/map/NodeContextMenu';
import KanbanBoard from '../components/map/KanbanBoard';
import ImportModal from '../components/import/ImportModal';
import TerritoryToolbar from '../components/map/TerritoryToolbar';
import TerritoryDetailPanel from '../components/map/TerritoryDetailPanel';
import SearchOverlay from '../components/map/SearchOverlay';
import StagingPanel from '../components/map/StagingPanel';
import TopoBackground from '../components/common/TopoBackground';
import AdvanceTimeModal from '../components/time/AdvanceTimeModal';
import SnapshotSidebar from '../components/time/SnapshotSidebar';
import WidgetLayer from '../components/widgets/WidgetLayer';
import useSnapshotStore from '../stores/snapshotStore';
import useWidgetStore from '../stores/widgetStore';

export default function WorkspaceView() {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);

  const loadMaps = useMapStore((s) => s.loadMaps);
  const loadNodes = useNodeStore((s) => s.loadNodes);
  const allNodes = useNodeStore((s) => s.nodes);
  const loadTags = useTagStore((s) => s.loadTags);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadTerritories = useTerritoryStore((s) => s.loadTerritories);
  const deselectNode = useNodeStore((s) => s.deselectNode);
  const loadSnapshots = useSnapshotStore((s) => s.loadSnapshots);
  const loadWidgets   = useWidgetStore((s) => s.loadWidgets);

  // Settings-driven layout
  const layout = useSettingsStore((s) => s.layout);
  const mapSide = useSettingsStore((s) => s.mapSide);
  const settingsOpen = useSettingsStore((s) => s.settingsOpen);

  // Close detail panel when switching to full-canvas mode
  useEffect(() => {
    if (layout === 'full') deselectNode();
  }, [layout, deselectNode]);

  const [placingType, setPlacingType] = useState(null);
  const [kanbanMode, setKanbanMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState(null);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [territoryOwnerId, setTerritoryOwnerId] = useState(null);
  const [territoryColor, setTerritoryColor] = useState('#8890a0');
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);
  const [editingTerritoryId, setEditingTerritoryId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlightIds, setSearchHighlightIds] = useState(null);
  const [stagingOpen, setStagingOpen]             = useState(false);
  const [advanceTimeOpen, setAdvanceTimeOpen]     = useState(false);
  const [historyOpen, setHistoryOpen]             = useState(false);
  const [orgView, setOrgView]                     = useState(false);

  const activeMapId = useMapStore((s) => s.activeMapId);
  const createTerritory = useTerritoryStore((s) => s.createTerritory);
  const deleteTerritory = useTerritoryStore((s) => s.deleteTerritory);
  const updateTerritory = useTerritoryStore((s) => s.updateTerritory);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { nodeId, x, y }

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

  // Load campaign data — snapshots MUST be loaded here so the store is populated
  // before AdvanceTimeModal runs handleCommit (avoids cold-store overwrite bug)
  useEffect(() => {
    if (!campaignId) return;
    loadMaps(campaignId);
    loadNodes(campaignId);
    loadTags(campaignId);
    loadConnections(campaignId);
    loadSettings(campaignId);
    loadTerritories(campaignId);
    loadSnapshots(campaignId);
    loadWidgets(campaignId);
  }, [campaignId, loadMaps, loadNodes, loadTags, loadConnections, loadSettings, loadTerritories, loadSnapshots, loadWidgets]);

  const handlePlacingDone = useCallback(() => {
    setPlacingType(null);
  }, []);

  const handleNodeContextMenu = useCallback((nodeId, viewportX, viewportY) => {
    setContextMenu({ nodeId, x: viewportX, y: viewportY });
  }, []);

  const mapCanvas = (
    <MapCanvas
      placingType={placingType}
      onPlacingDone={handlePlacingDone}
      onNodeContextMenu={handleNodeContextMenu}
      drawingMode={drawingMode}
      setDrawingMode={handleSetDrawingMode}
      polygonPoints={polygonPoints}
      setPolygonPoints={setPolygonPoints}
      selectedTerritoryId={selectedTerritoryId}
      setSelectedTerritoryId={setSelectedTerritoryId}
      editingTerritoryId={editingTerritoryId}
      searchHighlightIds={searchHighlightIds}
      orgView={orgView}
    />
  );

  const rightPanel = selectedNodeId ? <DetailPanel /> : <CardPanel />;

  // Apply node type color overrides + custom type colors as CSS variables
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];
  const colorOverrideStyle = useMemo(() => {
    const style = {};
    // Built-in type overrides
    for (const [type, overrides] of Object.entries(nodeTypeOverrides)) {
      if (overrides.color) {
        style[`--node-${type}`] = overrides.color;
      }
    }
    // Custom type colors
    for (const ct of customNodeTypes) {
      if (ct.color) {
        style[`--node-${ct.id}`] = ct.color;
      }
    }
    return style;
  }, [nodeTypeOverrides, customNodeTypes]);

  return (
    <div className="app-layout" style={colorOverrideStyle}>
      <MapSidebar />
      <div className="main-content">
        <MapToolbar
          placingType={placingType}
          setPlacingType={setPlacingType}
          kanbanMode={kanbanMode}
          setKanbanMode={setKanbanMode}
          onOpenImport={() => setImportOpen(true)}
          drawingMode={drawingMode}
          setDrawingMode={handleSetDrawingMode}
          onOpenSearch={() => setSearchOpen(true)}
          onToggleStaging={() => setStagingOpen(!stagingOpen)}
          stagingOpen={stagingOpen}
          onOpenAdvanceTime={() => setAdvanceTimeOpen(true)}
          onToggleHistory={() => setHistoryOpen((v) => !v)}
          historyOpen={historyOpen}
          onToggleOrgView={() => setOrgView((v) => !v)}
          orgView={orgView}
        />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Topo background fills the workspace area behind map and panels */}
          <TopoBackground style={{ position: 'absolute', inset: 0, zIndex: 0 }} opacity={0.35} />
          {/* Widget layer must live here so its coordinate space starts at the same
              origin as the Konva canvas (after sidebar). position: fixed would be
              offset by the sidebar width and toolbar height. */}
          {!kanbanMode && <WidgetLayer />}
          {kanbanMode ? (
            <div className="view-enter" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <KanbanBoard />
            </div>
          ) : layout === 'full' ? (
            <>
              <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {mapCanvas}
                <MapLegend />
              </div>
              {selectedNodeId && <DetailPanel />}
            </>
          ) : (
            <>
              {mapSide === 'left' ? (
                <>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                    {mapCanvas}
                    <MapLegend />
                  </div>
                  <div className="split-divider" />
                  {rightPanel}
                </>
              ) : (
                <>
                  {rightPanel}
                  <div className="split-divider" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                    {mapCanvas}
                    <MapLegend />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Territory drawing toolbar */}
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

      {/* Territory detail panel (when a territory is selected) */}
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

      {/* Right-click context menu */}
      {contextMenu && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Import modal */}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}

      {/* Advance Time modal */}
      {advanceTimeOpen && (
        <AdvanceTimeModal
          campaignId={campaignId}
          onClose={() => setAdvanceTimeOpen(false)}
        />
      )}

      {/* Snapshot / history sidebar */}
      {historyOpen && (
        <SnapshotSidebar
          campaignId={campaignId}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel />}

      {/* Staging panel */}
      {stagingOpen && <StagingPanel onClose={() => setStagingOpen(false)} />}

      {/* Search overlay */}
      {searchOpen && (
        <SearchOverlay
          onClose={() => { setSearchOpen(false); setSearchHighlightIds(null); }}
          onHighlight={setSearchHighlightIds}
        />
      )}

    </div>
  );
}
