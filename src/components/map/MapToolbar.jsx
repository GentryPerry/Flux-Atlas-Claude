import { useMemo } from 'react';
import {
  UserCircle, MapPin, Shield, Cross, Lightning, Sword, Crown,
  ArrowsOutSimple, Link as LinkIcon, LinkBreak, CaretRight,
  SquareSplitHorizontal, Rows, GearSix,
  Kanban, DownloadSimple, Polygon,
} from '@phosphor-icons/react';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import useSettingsStore from '../../stores/settingsStore';

const NODE_TYPE_BUTTONS = [
  { type: 'character', icon: UserCircle, label: 'NPC', color: 'var(--node-character)' },
  { type: 'location', icon: MapPin, label: 'Location', color: 'var(--node-location)' },
  { type: 'faction', icon: Shield, label: 'Faction', color: 'var(--node-faction)' },
  { type: 'religion', icon: Cross, label: 'Religion', color: 'var(--node-religion)' },
  { type: 'event', icon: Lightning, label: 'Event', color: 'var(--node-event)' },
  { type: 'realm', icon: Crown, label: 'Realm', color: 'var(--node-realm)' },
  { type: 'thing', icon: Sword, label: 'Item', color: 'var(--node-thing)' },
];

export default function MapToolbar({
  placingType, setPlacingType,
  connectingFrom, setConnectingFrom,
  kanbanMode, setKanbanMode,
  onOpenImport,
  drawingMode, setDrawingMode,
}) {
  const allMaps = useMapStore((s) => s.maps);
  const mapStack = useMapStore((s) => s.mapStack);
  const jumpTo = useMapStore((s) => s.jumpTo);
  const activeMapId = useMapStore((s) => s.activeMapId);

  // Derive breadcrumbs with useMemo instead of calling store method in selector
  const breadcrumbs = useMemo(() => {
    return [...mapStack, activeMapId]
      .filter(Boolean)
      .map((id) => allMaps.find((m) => m.id === id))
      .filter(Boolean);
  }, [allMaps, mapStack, activeMapId]);
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign);

  const layout = useSettingsStore((s) => s.layout);
  const showConnections = useSettingsStore((s) => s.showConnections);
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const openSettings = useSettingsStore((s) => s.openSettings);

  return (
    <div className="toolbar">
      {/* Logo & Home */}
      <button className="toolbar-brand" onClick={() => setActiveCampaign(null)} title="Back to campaigns">
        <img src="/logo/text-only.png" alt="Flux Atlas" className="toolbar-logo" />
      </button>

      <div className="toolbar-divider" />

      {/* Breadcrumbs */}
      <div className="breadcrumb">
        {breadcrumbs.map((map, i) => (
          <span key={map.id}>
            {i > 0 && <CaretRight size={12} className="breadcrumb-sep" style={{ margin: '0 2px' }} />}
            <span
              className={`breadcrumb-item ${map.id === activeMapId ? 'active' : ''}`}
              onClick={() => {
                if (map.id !== activeMapId) jumpTo(map.id);
              }}
            >
              {map.name}
            </span>
          </span>
        ))}
      </div>

      <div className="toolbar-spacer" />

      {/* Node type palette */}
      <div className="node-palette">
        {NODE_TYPE_BUTTONS.map(({ type, icon: Icon, label, color }) => (
          <button
            key={type}
            className={`node-palette-btn ${placingType === type ? 'active' : ''}`}
            onClick={() => setPlacingType(placingType === type ? null : type)}
            title={`Place ${label}`}
          >
            <Icon size={18} color={placingType === type ? color : undefined} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      {/* Connection tools */}
      <button
        className={`toggle-btn ${showConnections ? 'on' : ''}`}
        onClick={() => setSetting(campaignId, 'showConnections', !showConnections)}
        title="Toggle connections"
      >
        {showConnections ? <LinkIcon size={16} /> : <LinkBreak size={16} />}
        Lines
      </button>

      <button
        className={`toggle-btn ${connectingFrom ? 'on' : ''}`}
        onClick={() => setConnectingFrom(connectingFrom ? null : '__waiting__')}
        title="Connect two nodes"
      >
        <ArrowsOutSimple size={16} />
        Connect
      </button>

      <div className="toolbar-divider" />

      {/* Territory drawing mode */}
      <button
        className={`toggle-btn ${drawingMode === 'polygon' ? 'on' : ''}`}
        onClick={() => setDrawingMode(drawingMode === 'polygon' ? null : 'polygon')}
        title="Draw territory - click to add points, double-click to finish"
      >
        <Polygon size={16} />
        Territory
      </button>

      <div className="toolbar-divider" />

      {/* Kanban board toggle */}
      <button
        className={`toggle-btn ${kanbanMode ? 'on' : ''}`}
        onClick={() => setKanbanMode?.(!kanbanMode)}
        title="Relationship board"
      >
        <Kanban size={16} />
        Board
      </button>

      {/* Import */}
      <button
        className="toggle-btn"
        onClick={onOpenImport}
        title="Import nodes from markdown"
      >
        <DownloadSimple size={16} />
        Import
      </button>

      <div className="toolbar-divider" />

      {/* Layout quick toggle */}
      <button
        className={`toggle-btn ${layout === 'split' ? 'on' : ''}`}
        onClick={() => setSetting(campaignId, 'layout', layout === 'split' ? 'full' : 'split')}
        title={layout === 'split' ? 'Full canvas mode' : 'Split view mode'}
      >
        {layout === 'split' ? <SquareSplitHorizontal size={16} /> : <Rows size={16} />}
        {layout === 'split' ? 'Split' : 'Full'}
      </button>

      {/* Settings */}
      <button className="btn-icon" onClick={() => openSettings()} title="Settings">
        <GearSix size={18} />
      </button>
    </div>
  );
}
