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

export default function WorkspaceView() {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);

  const loadMaps = useMapStore((s) => s.loadMaps);
  const loadNodes = useNodeStore((s) => s.loadNodes);
  const loadTags = useTagStore((s) => s.loadTags);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadTerritories = useTerritoryStore((s) => s.loadTerritories);
  const allNodes = useNodeStore((s) => s.nodes);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const tags = useTagStore((s) => s.tags);
  const createTag = useTagStore((s) => s.createTag);

  // Settings-driven layout
  const layout = useSettingsStore((s) => s.layout);
  const mapSide = useSettingsStore((s) => s.mapSide);
  const showConnections = useSettingsStore((s) => s.showConnections);
  const settingsOpen = useSettingsStore((s) => s.settingsOpen);

  const [placingType, setPlacingType] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [kanbanMode, setKanbanMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState(null);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [territoryOwnerId, setTerritoryOwnerId] = useState(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);

  const activeMapId = useMapStore((s) => s.activeMapId);
  const createTerritory = useTerritoryStore((s) => s.createTerritory);
  const deleteTerritory = useTerritoryStore((s) => s.deleteTerritory);
  const updateTerritory = useTerritoryStore((s) => s.updateTerritory);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { nodeId, x, y }

  const createConnection = useConnectionStore((s) => s.createConnection);

  // Get color from the owner node for territory coloring
  const TYPE_COLORS = { faction: '#fb923c', religion: '#fbbf24', realm: '#e879a8' };

  const handleSetDrawingMode = useCallback((mode) => {
    if (!mode) {
      // Exiting drawing mode — clear polygon points
      setPolygonPoints([]);
      setTerritoryOwnerId(null);
    }
    setDrawingMode(mode);
  }, []);

  const handleFinishDrawing = useCallback(() => {
    if (polygonPoints.length < 3) return;
    const ownerNode = territoryOwnerId ? allNodes.find((n) => n.id === territoryOwnerId) : null;
    const ownerColor = ownerNode ? (TYPE_COLORS[ownerNode.type] || '#8890a0') : '#8890a0';
    createTerritory(campaignId, activeMapId, 'polygon', {
      points: polygonPoints,
      nodeId: territoryOwnerId || null,
      name: ownerNode ? `${ownerNode.fields?.name} Territory` : `Territory ${new Date().toLocaleTimeString()}`,
      color: ownerColor,
      strokeColor: ownerColor,
      opacity: 0.15,
    });
    setPolygonPoints([]);
    setDrawingMode(null);
    setTerritoryOwnerId(null);
  }, [polygonPoints, territoryOwnerId, allNodes, campaignId, activeMapId, createTerritory]);

  // Load campaign data
  useEffect(() => {
    if (!campaignId) return;
    loadMaps(campaignId);
    loadNodes(campaignId);
    loadTags(campaignId);
    loadConnections(campaignId);
    loadSettings(campaignId);
    loadTerritories(campaignId);
  }, [campaignId, loadMaps, loadNodes, loadTags, loadConnections, loadSettings, loadTerritories]);

  const handlePlacingDone = useCallback(() => {
    setPlacingType(null);
  }, []);

  const handleConnectionClick = useCallback((nodeId) => {
    if (connectingFrom === '__waiting__') {
      setConnectingFrom(nodeId);
    } else if (connectingFrom && connectingFrom !== nodeId) {
      createConnection(campaignId, connectingFrom, nodeId);

      // Cross-reference: add each node's name as a tag on the other
      const nodeA = allNodes.find((n) => n.id === connectingFrom);
      const nodeB = allNodes.find((n) => n.id === nodeId);
      if (nodeA && nodeB) {
        // Determine appropriate tag field based on node type
        const getTagField = (targetType, sourceType) => {
          if (sourceType === 'faction') return targetType === 'character' ? 'faction' : targetType === 'location' ? 'controllingFaction' : null;
          if (sourceType === 'religion') return targetType === 'character' ? 'religion' : null;
          if (sourceType === 'location') return targetType === 'character' ? 'notableNPCs' : null;
          return null;
        };

        const addTagRef = (target, source, field) => {
          if (!field) return;
          const name = source.fields?.name;
          if (!name) return;
          let tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
          if (!tag) tag = createTag(campaignId, name);
          const current = Array.isArray(target.fields?.[field]) ? target.fields[field] : [];
          if (!current.includes(tag.id)) {
            updateNodeFields(campaignId, target.id, { [field]: [...current, tag.id] });
          }
        };

        // Try both directions
        const fieldAtoB = getTagField(nodeB.type, nodeA.type);
        const fieldBtoA = getTagField(nodeA.type, nodeB.type);
        addTagRef(nodeB, nodeA, fieldAtoB);
        addTagRef(nodeA, nodeB, fieldBtoA);
      }

      setConnectingFrom(null);
    }
  }, [connectingFrom, campaignId, createConnection, allNodes, tags, createTag, updateNodeFields]);

  const handleNodeContextMenu = useCallback((nodeId, viewportX, viewportY) => {
    setContextMenu({ nodeId, x: viewportX, y: viewportY });
  }, []);

  const handleStartConnect = useCallback((nodeId) => {
    setConnectingFrom(nodeId);
  }, []);

  const mapCanvas = (
    <MapCanvas
      placingType={placingType}
      onPlacingDone={handlePlacingDone}
      showConnections={showConnections}
      connectingFrom={connectingFrom}
      onConnectionClick={handleConnectionClick}
      onNodeContextMenu={handleNodeContextMenu}
      drawingMode={drawingMode}
      setDrawingMode={handleSetDrawingMode}
      polygonPoints={polygonPoints}
      setPolygonPoints={setPolygonPoints}
      selectedTerritoryId={selectedTerritoryId}
      setSelectedTerritoryId={setSelectedTerritoryId}
    />
  );

  const rightPanel = selectedNodeId ? <DetailPanel /> : <CardPanel />;

  return (
    <div className="app-layout">
      <MapSidebar />
      <div className="main-content">
        <MapToolbar
          placingType={placingType}
          setPlacingType={setPlacingType}
          connectingFrom={connectingFrom}
          setConnectingFrom={setConnectingFrom}
          kanbanMode={kanbanMode}
          setKanbanMode={setKanbanMode}
          onOpenImport={() => setImportOpen(true)}
          drawingMode={drawingMode}
          setDrawingMode={handleSetDrawingMode}
        />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {kanbanMode ? (
            <KanbanBoard />
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
        polygonPointCount={polygonPoints.length}
        onFinishDrawing={handleFinishDrawing}
      />

      {/* Territory detail panel (when a territory is selected) */}
      {selectedTerritoryId && !drawingMode && (
        <TerritoryDetailPanel
          territoryId={selectedTerritoryId}
          onClose={() => setSelectedTerritoryId(null)}
        />
      )}

      {/* Connection mode indicator */}
      {connectingFrom && (
        <div className="connection-indicator">
          {connectingFrom === '__waiting__'
            ? 'Click the first node to connect...'
            : 'Now click the second node...'}
          <button
            className="btn-ghost btn-sm"
            onClick={() => setConnectingFrom(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onStartConnect={handleStartConnect}
        />
      )}

      {/* Import modal */}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel />}
    </div>
  );
}
