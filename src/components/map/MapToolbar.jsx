import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  CaretLeft, CaretRight, CaretDown,
  Rows, GearSix,
  Kanban, MagnifyingGlass, Plus,
  ClockCounterClockwise, DotsNine, Tree,
  Note, ChartBar, ArrowsLeftRight, Circle,
  Hourglass, Lightning, Wrench, DiceSix, Camera, StackSimple, Image,
  ArrowCounterClockwise, Eye, UserCircle,
} from '@phosphor-icons/react';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import useSettingsStore from '../../stores/settingsStore';
import useWidgetStore from '../../stores/widgetStore';
import useViewportStore from '../../stores/viewportStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';
import { DEFAULT_TYPE_COLORS } from '../../utils/typeColors';
import { resolveIcon } from '../../utils/iconRegistry';

// How many types to show per toolbar page
const PAGE_SIZE = 7;

// Below this width the right-side tools collapse into the overflow tray
const OVERFLOW_THRESHOLD = 1080;

// Below this width node palette labels are hidden
const CONDENSE_THRESHOLD = 880;

// ── Overflow tray ─────────────────────────────────────────────────────────────

/**
 * A single tool tile inside the overflow tray.
 */
function TrayTile({ onClick, isActive, icon: Icon, label, color }) {
  return (
    <button
      className={`overflow-tray-tile ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={label}
    >
      <Icon size={18} color={isActive && color ? color : undefined} />
      <span>{label}</span>
    </button>
  );
}

// ── Main toolbar ──────────────────────────────────────────────────────────────

// ── View definitions ─────────────────────────────────────────────────────────
const VIEWS = [
  { id: 'map',       label: 'Map',       icon: Rows   },
  { id: 'board',     label: 'Board',     icon: Kanban },
  { id: 'hierarchy', label: 'Hierarchy', icon: Tree   },
];

export default function MapToolbar({
  placingType, setPlacingType,
  activeView, setActiveView,
  drawingMode, setDrawingMode,
  onOpenSearch,
  onOpenFluxSystem,
  onOpenTroubleEngine,
  onToggleHistory, historyOpen,
  onTakeSnapshot,
  onAddMapLayer,
  onUndo, canUndo,
  playerPreviewMode, onTogglePlayerPreview, onOpenInvitePanel,
}) {
  const toolbarRef  = useRef(null);
  const mapLayerInputRef = useRef(null);
  const trayRef     = useRef(null);
  const trayBtnRef      = useRef(null);
  const widgetBtnRef    = useRef(null);
  const widgetPickerRef = useRef(null);
  const viewDropdownRef    = useRef(null);
  const viewDropdownBtnRef = useRef(null);

  const gameToolsRef    = useRef(null);
  const gameToolsBtnRef = useRef(null);

  const [condensed, setCondensed]         = useState(false);
  const [overflow, setOverflow]           = useState(false);
  const [trayOpen, setTrayOpen]           = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [palettePage, setPalettePage]     = useState(0);
  const [viewDropdownOpen, setViewDropdownOpen]     = useState(false);
  const [gameToolsOpen,    setGameToolsOpen]         = useState(false);

  const isMapLike = activeView === 'map' || activeView === 'org';

  // Watch toolbar width — two breakpoints
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setCondensed(el.clientWidth < CONDENSE_THRESHOLD);
      setOverflow(el.clientWidth < OVERFLOW_THRESHOLD);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Close tray on outside click
  useEffect(() => {
    if (!trayOpen) return;
    const handler = (e) => {
      if (
        trayRef.current && !trayRef.current.contains(e.target) &&
        trayBtnRef.current && !trayBtnRef.current.contains(e.target)
      ) {
        setTrayOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [trayOpen]);

  // Close widget picker on outside click
  useEffect(() => {
    if (!widgetPickerOpen) return;
    const handler = (e) => {
      if (
        widgetPickerRef.current && !widgetPickerRef.current.contains(e.target) &&
        widgetBtnRef.current   && !widgetBtnRef.current.contains(e.target)
      ) {
        setWidgetPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [widgetPickerOpen]);

  // Close view dropdown on outside click
  useEffect(() => {
    if (!viewDropdownOpen) return;
    const handler = (e) => {
      if (
        viewDropdownRef.current    && !viewDropdownRef.current.contains(e.target) &&
        viewDropdownBtnRef.current && !viewDropdownBtnRef.current.contains(e.target)
      ) {
        setViewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [viewDropdownOpen]);

  // Close game tools dropdown on outside click
  useEffect(() => {
    if (!gameToolsOpen) return;
    const handler = (e) => {
      if (
        gameToolsRef.current    && !gameToolsRef.current.contains(e.target) &&
        gameToolsBtnRef.current && !gameToolsBtnRef.current.contains(e.target)
      ) {
        setGameToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [gameToolsOpen]);

  const allMaps     = useMapStore((s) => s.maps);
  const mapStack    = useMapStore((s) => s.mapStack);
  const jumpTo      = useMapStore((s) => s.jumpTo);
  const activeMapId = useMapStore((s) => s.activeMapId);

  const breadcrumbs = useMemo(() => {
    return [...mapStack, activeMapId]
      .filter(Boolean)
      .map((id) => allMaps.find((m) => m.id === id))
      .filter(Boolean);
  }, [allMaps, mapStack, activeMapId]);

  const addWidget          = useWidgetStore((s) => s.addWidget);
  // Read viewport imperatively at click time — no subscription, no re-render loop
  const setActiveCampaign  = useCampaignStore((s) => s.setActiveCampaign);
  const campaignId         = useCampaignStore((s) => s.activeCampaignId);
  const openSettings       = useSettingsStore((s) => s.openSettings);
  const nodeTypeOverrides  = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes    = useSettingsStore((s) => s.customNodeTypes)   || [];
  const toolbarLogo        = '/logo/toolbar.svg';

  // Build merged palette: built-in + custom, with overrides applied
  const allTypeButtons = useMemo(() => {
    const builtIn = Object.entries(NODE_TYPES).map(([type, schema]) => {
      const ovr   = nodeTypeOverrides[type] || {};
      const color = ovr.color || DEFAULT_TYPE_COLORS[type] || '#8890a0';
      const label = ovr.label || schema.label;
      const icon  = ovr.icon  || schema.icon;
      return { type, label, color, icon };
    });
    const custom = customNodeTypes.map((ct) => ({
      type:  ct.id,
      label: ct.label,
      color: ct.color || '#8890a0',
      icon:  ct.icon  || 'Star',
    }));
    return [...builtIn, ...custom];
  }, [nodeTypeOverrides, customNodeTypes]);

  const totalPages   = Math.ceil(allTypeButtons.length / PAGE_SIZE);
  const pageStart    = palettePage * PAGE_SIZE;
  const visibleTypes = allTypeButtons.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    if (palettePage >= totalPages && totalPages > 0) {
      setPalettePage(totalPages - 1);
    }
  }, [totalPages, palettePage]);

  // Close tray whenever an action inside it fires
  const wrap = useCallback((fn) => (...args) => {
    fn(...args);
    setTrayOpen(false);
  }, []);

  // Whether any overflow item is "active" (to show a dot on the tray button)
  const overflowHasActive = drawingMode === 'polygon' || historyOpen || activeView !== 'map';

  // Helper: simple labelled button for the inline toolbar
  const ToolBtn = ({ onClick, isActive, icon: Icon, label, title, className = '' }) => (
    <button
      className={`toolbar-tool-btn ${isActive ? 'active' : ''} ${condensed && !isActive ? 'condensed' : ''} ${className}`}
      onClick={onClick}
      title={title || label}
    >
      <Icon size={16} />
      <span className="toolbar-tool-label">{label}</span>
    </button>
  );

  return (
    <div className={`toolbar ${condensed ? 'toolbar-condensed' : ''}`} ref={toolbarRef}>
      {/* Logo */}
      <button className="toolbar-brand" onClick={() => setActiveCampaign(null)} title="Back to campaigns">
        <img src={toolbarLogo} alt="Flux Atlas" className="toolbar-logo" />
      </button>

      <div className="toolbar-divider" />

      {/* Breadcrumbs */}
      <div className="breadcrumb">
        {breadcrumbs.map((map, i) => (
          <span key={map.id}>
            {i > 0 && <CaretRight size={12} className="breadcrumb-sep" style={{ margin: '0 2px' }} />}
            <span
              className={`breadcrumb-item ${map.id === activeMapId ? 'active' : ''}`}
              onClick={() => { if (map.id !== activeMapId) jumpTo(map.id); }}
            >
              {map.name}
            </span>
          </span>
        ))}
      </div>

      {/* ── Node palette (map views only) — left-aligned next to breadcrumb ── */}
      {isMapLike && (
        <>
          <div className="toolbar-divider" />

          {totalPages > 1 && (
            <button
              className="btn-icon"
              onClick={() => setPalettePage((p) => Math.max(0, p - 1))}
              disabled={palettePage === 0}
              title="Previous types"
              style={{ opacity: palettePage === 0 ? 0.3 : 1 }}
            >
              <CaretLeft size={14} />
            </button>
          )}

          <div className="node-palette" data-tour="node-palette">
            {visibleTypes.map(({ type, label, color, icon }) => {
              const isActive = placingType === type;
              const IconComp = resolveIcon(icon);
              return (
                <button
                  key={type}
                  className={`node-palette-btn ${isActive ? 'active' : ''} ${condensed && !isActive ? 'condensed' : ''}`}
                  onClick={() => setPlacingType(isActive ? null : type)}
                  title={`Place ${label}`}
                >
                  <IconComp size={16} color={isActive ? color : undefined} />
                  <span className="toolbar-tool-label">{label}</span>
                </button>
              );
            })}
          </div>

          {totalPages > 1 && (
            <button
              className="btn-icon"
              onClick={() => setPalettePage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={palettePage >= totalPages - 1}
              title="More types"
              style={{ opacity: palettePage >= totalPages - 1 ? 0.3 : 1 }}
            >
              <CaretRight size={14} />
            </button>
          )}

          <button className="btn-icon" onClick={() => openSettings('nodeTypes')} title="Add node type">
            <Plus size={14} />
          </button>
          <button
            className="btn-icon"
            onClick={() => mapLayerInputRef.current?.click()}
            title="Add map layer image"
          >
            <StackSimple size={16} />
          </button>
          <input
            ref={mapLayerInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { onAddMapLayer?.(file); }
              e.target.value = '';
            }}
          />
        </>
      )}

      <div className="toolbar-spacer" />


      {!overflow && isMapLike && (
        <>
          {/* Game Tools dropdown */}
          <div className="game-tools-dropdown" style={{ position: 'relative' }}>
            <button
              ref={gameToolsBtnRef}
              data-tour="history-btn"
              className={`toolbar-tool-btn${gameToolsOpen ? ' active' : ''}`}
              onClick={() => setGameToolsOpen((v) => !v)}
              title="Game Tools"
            >
              <Wrench size={16} />
              <span className="toolbar-tool-label">Game Tools</span>
              <CaretDown size={11} style={{ opacity: 0.6, marginLeft: 1 }} />
            </button>
            {gameToolsOpen && (
              <div ref={gameToolsRef} className="game-tools-menu">
                <button
                  className="game-tools-item"
                  onClick={() => { onOpenFluxSystem(); setGameToolsOpen(false); }}
                >
                  <Hourglass size={14} />
                  <div className="gti-text">
                    <span className="gti-label">Flux System</span>
                    <span className="gti-desc">Generate time-skip proposals</span>
                  </div>
                </button>
                <button
                  className="game-tools-item"
                  onClick={() => { onOpenTroubleEngine(); setGameToolsOpen(false); }}
                >
                  <Lightning size={14} />
                  <div className="gti-text">
                    <span className="gti-label">Trouble Engine</span>
                    <span className="gti-desc">Run downtime trouble procedure</span>
                  </div>
                </button>
                <div className="game-tools-divider" />
                <button
                  className="game-tools-item"
                  onClick={() => { onTakeSnapshot?.(); setGameToolsOpen(false); }}
                >
                  <Camera size={14} />
                  <div className="gti-text">
                    <span className="gti-label">Snapshot</span>
                    <span className="gti-desc">Save current world state</span>
                  </div>
                </button>
                <button
                  className={`game-tools-item${historyOpen ? ' active' : ''}`}
                  onClick={() => { onToggleHistory(); setGameToolsOpen(false); }}
                >
                  <ClockCounterClockwise size={14} />
                  <div className="gti-text">
                    <span className="gti-label">History</span>
                    <span className="gti-desc">Browse timeline snapshots</span>
                  </div>
                </button>
              </div>
            )}
          </div>
          <div className="toolbar-divider" />
        </>
      )}

      {/* ── View dropdown ──────────────────────────────────── */}
      {!overflow && (() => {
        const currentView = VIEWS.find((v) => v.id === activeView) || VIEWS[0];
        const ViewIcon = currentView.icon;
        return (
          <div className="view-dropdown" style={{ position: 'relative' }}>
            <button
              ref={viewDropdownBtnRef}
              className={`toolbar-tool-btn${viewDropdownOpen ? ' active' : ''}`}
              onClick={() => setViewDropdownOpen((v) => !v)}
              title="Switch view"
            >
              <ViewIcon size={16} />
              <span className="toolbar-tool-label">{currentView.label}</span>
              <CaretDown size={11} style={{ opacity: 0.6, marginLeft: 1 }} />
            </button>
            {viewDropdownOpen && (
              <div ref={viewDropdownRef} className="view-dropdown-menu">
                {VIEWS.map(({ id, label, icon: VIcon }) => (
                  <button
                    key={id}
                    className={`view-dropdown-item${activeView === id ? ' active' : ''}`}
                    onClick={() => { setActiveView(id); setViewDropdownOpen(false); }}
                  >
                    <VIcon size={14} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Overflow tray trigger (shown when narrow) ── */}
      {overflow && (
        <div style={{ position: 'relative' }}>
          <button
            ref={trayBtnRef}
            className={`toolbar-tool-btn ${trayOpen ? 'active' : ''} ${overflowHasActive ? 'overflow-has-active' : ''}`}
            onClick={() => setTrayOpen((v) => !v)}
            title="More tools"
            style={{ gap: 4 }}
          >
            <DotsNine size={18} weight={overflowHasActive ? 'fill' : 'regular'} />
          </button>

          {trayOpen && (
            <div ref={trayRef} className="overflow-tray">
              {/* Map tools group */}

              {/* View group */}
              <div className="overflow-tray-group-label">View</div>
              <div className="overflow-tray-grid">
                {VIEWS.map(({ id, label, icon: VIcon }) => (
                  <TrayTile
                    key={id}
                    onClick={wrap(() => setActiveView(id))}
                    isActive={activeView === id}
                    icon={VIcon}
                    label={label}
                  />
                ))}
              </div>

              {/* Game Tools group */}
              {isMapLike && (
                <>
                  <div className="overflow-tray-group-label">Game Tools</div>
                  <div className="overflow-tray-grid">
                    <TrayTile onClick={wrap(onOpenFluxSystem)}          isActive={false}       icon={Hourglass}             label="Flux System" />
                    <TrayTile onClick={wrap(onOpenTroubleEngine)}       isActive={false}       icon={Lightning}             label="Trouble" />
                    <TrayTile onClick={wrap(() => onTakeSnapshot?.())}  isActive={false}       icon={Camera}                label="Snapshot" />
                    <TrayTile onClick={wrap(onToggleHistory)}           isActive={historyOpen} icon={ClockCounterClockwise} label="History" />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Widget picker — always visible */}
      <div style={{ position: 'relative' }}>
        <button
          ref={widgetBtnRef}
          data-tour="widget-btn"
          className={`btn-icon ${widgetPickerOpen ? 'active' : ''}`}
          onClick={() => setWidgetPickerOpen((v) => !v)}
          title="Add widget"
        >
          <Note size={18} />
        </button>

        {widgetPickerOpen && (
          <div ref={widgetPickerRef} className="widget-picker">
            <div className="widget-picker-label">Add Widget</div>
            <button
              className="widget-picker-item"
              onClick={() => { addWidget(campaignId, 'sticky-note', useViewportStore.getState()); setWidgetPickerOpen(false); }}
            >
              <Note size={15} />
              <span>Sticky Note</span>
            </button>
            <button
              className="widget-picker-item"
              onClick={() => { addWidget(campaignId, 'linear-tracker', useViewportStore.getState()); setWidgetPickerOpen(false); }}
            >
              <ChartBar size={15} />
              <span>Linear Tracker</span>
            </button>
            <button
               className="widget-picker-item"
               onClick={() => { addWidget(campaignId, 'thread-tracker', useViewportStore.getState()); setWidgetPickerOpen(false); }}
            >
               <ArrowsLeftRight size={15} />
               <span>Thread Tracker</span>
            </button>
            <button
              className="widget-picker-item"
              onClick={() => { addWidget(campaignId, 'clock-widget', useViewportStore.getState()); setWidgetPickerOpen(false); }}
            >
              <Circle size={15} />
              <span>Clocks</span>
            </button>
            <button
              className="widget-picker-item"
              onClick={() => { addWidget(campaignId, 'trouble-engine', useViewportStore.getState()); setWidgetPickerOpen(false); }}
            >
              <Lightning size={15} />
              <span>Trouble Tracker</span>
            </button>
            <button
              className="widget-picker-item"
              onClick={() => { addWidget(campaignId, 'table-roller', useViewportStore.getState()); setWidgetPickerOpen(false); }}
            >
              <DiceSix size={15} />
              <span>Table Roller</span>
            </button>
            <button
              className="widget-picker-item"
              onClick={() => { addWidget(campaignId, 'image-frame', useViewportStore.getState()); setWidgetPickerOpen(false); }}
            >
              <Image size={15} />
              <span>Image</span>
            </button>
          </div>
        )}
      </div>

      {/* Undo — always visible */}
      <button
        className="btn-icon"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        style={{ opacity: canUndo ? 1 : 0.35 }}
      >
        <ArrowCounterClockwise size={18} />
      </button>

      {/* Player view controls */}
      <button
        className={`btn-icon ${playerPreviewMode ? 'active' : ''}`}
        onClick={onTogglePlayerPreview}
        title={playerPreviewMode ? 'Exit player preview' : 'Preview player view'}
        style={{ color: playerPreviewMode ? 'var(--accent)' : undefined }}
      >
        <Eye size={18} />
      </button>
      <button
        className="btn-icon"
        onClick={onOpenInvitePanel}
        title="Player access &amp; invites"
      >
        <UserCircle size={18} />
      </button>

      {/* Search & settings — always visible, always icon-only */}
      <button className="btn-icon" onClick={onOpenSearch} title="Search nodes (Ctrl+K)">
        <MagnifyingGlass size={18} />
      </button>
      <button className="btn-icon" data-tour="settings-btn" onClick={() => openSettings()} title="Settings">
        <GearSix size={18} />
      </button>
    </div>
  );
}
