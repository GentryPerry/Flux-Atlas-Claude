import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  CaretLeft, CaretRight,
  SquareSplitHorizontal, Rows, GearSix,
  Kanban, DownloadSimple, Polygon, MagnifyingGlass, Tray, Plus,
  ClockCounterClockwise, Clock, Eye, DotsNine,
  Note, ChartBar, ArrowsLeftRight, Circle,
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

export default function MapToolbar({
  placingType, setPlacingType,
  kanbanMode, setKanbanMode,
  onOpenImport,
  drawingMode, setDrawingMode,
  onOpenSearch,
  onToggleStaging, stagingOpen,
  onOpenAdvanceTime,
  onToggleHistory, historyOpen,
  onToggleOrgView, orgView,
}) {
  const toolbarRef  = useRef(null);
  const trayRef     = useRef(null);
  const trayBtnRef      = useRef(null);
  const widgetBtnRef    = useRef(null);
  const widgetPickerRef = useRef(null);

  const [condensed, setCondensed]         = useState(false);
  const [overflow, setOverflow]           = useState(false);
  const [trayOpen, setTrayOpen]           = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [palettePage, setPalettePage]     = useState(0);

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
  const layout             = useSettingsStore((s) => s.layout);
  const campaignId         = useCampaignStore((s) => s.activeCampaignId);
  const setSetting         = useSettingsStore((s) => s.setSetting);
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
  const overflowHasActive = drawingMode === 'polygon' || stagingOpen || historyOpen || orgView || kanbanMode;

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

      <div className="toolbar-spacer" />

      {/* ── Node palette ─────────────────────────────────────── */}
      {!kanbanMode && (
        <>
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

          <div className="node-palette">
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

          <div className="toolbar-divider" />
        </>
      )}

      {/* ── Inline right-side tools (shown when wide enough) ── */}
      {!overflow && !kanbanMode && (
        <>
          <ToolBtn
            onClick={() => setDrawingMode(drawingMode === 'polygon' ? null : 'polygon')}
            isActive={drawingMode === 'polygon'}
            icon={Polygon}
            label="Territory"
            title="Draw a territory polygon"
          />
          <div className="toolbar-divider" />
        </>
      )}

      {!overflow && (
        <>
          {kanbanMode ? (
            <ToolBtn onClick={() => setKanbanMode?.(false)} isActive={false} icon={Rows} label="Map" title="Back to map view" />
          ) : (
            <ToolBtn onClick={() => setKanbanMode?.(true)} isActive={false} icon={Kanban} label="Board" title="Relationship board view" />
          )}
        </>
      )}

      {!overflow && !kanbanMode && (
        <>
          <ToolBtn onClick={onOpenImport} isActive={false} icon={DownloadSimple} label="Import" title="Import nodes from markdown" />
          <ToolBtn onClick={onToggleStaging} isActive={stagingOpen} icon={Tray} label="Staging" title="Off-map staging area" />
          <div className="toolbar-divider" />
          <ToolBtn
            onClick={() => setSetting(campaignId, 'layout', layout === 'split' ? 'full' : 'split')}
            isActive={layout === 'split'}
            icon={layout === 'split' ? SquareSplitHorizontal : Rows}
            label={layout === 'split' ? 'Split' : 'Full'}
            title={layout === 'split' ? 'Switch to full canvas' : 'Switch to split view'}
          />
          <div className="toolbar-divider" />
          <ToolBtn onClick={onOpenAdvanceTime} isActive={false} icon={Clock} label="Advance Time" title="Generate scenario proposals" />
          <button
            className={`btn-icon${historyOpen ? ' active' : ''}`}
            onClick={onToggleHistory}
            title="Timeline history"
          >
            <ClockCounterClockwise size={18} />
          </button>
          <div className="toolbar-divider" />
          <ToolBtn onClick={onToggleOrgView} isActive={orgView} icon={Eye} label="Org View" title="Organizational view" />
        </>
      )}

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
              {!kanbanMode && (
                <>
                  <div className="overflow-tray-group-label">Map Tools</div>
                  <div className="overflow-tray-grid">
                    <TrayTile
                      onClick={wrap(() => setDrawingMode(drawingMode === 'polygon' ? null : 'polygon'))}
                      isActive={drawingMode === 'polygon'}
                      icon={Polygon}
                      label="Territory"
                    />
                    <TrayTile
                      onClick={wrap(onOpenImport)}
                      isActive={false}
                      icon={DownloadSimple}
                      label="Import"
                    />
                    <TrayTile
                      onClick={wrap(onToggleStaging)}
                      isActive={stagingOpen}
                      icon={Tray}
                      label="Staging"
                    />
                  </div>
                </>
              )}

              {/* View group */}
              <div className="overflow-tray-group-label">View</div>
              <div className="overflow-tray-grid">
                {kanbanMode ? (
                  <TrayTile onClick={wrap(() => setKanbanMode?.(false))} isActive={false} icon={Rows} label="Map" />
                ) : (
                  <TrayTile onClick={wrap(() => setKanbanMode?.(true))} isActive={false} icon={Kanban} label="Board" />
                )}
                {!kanbanMode && (
                  <TrayTile
                    onClick={wrap(() => setSetting(campaignId, 'layout', layout === 'split' ? 'full' : 'split'))}
                    isActive={layout === 'split'}
                    icon={layout === 'split' ? SquareSplitHorizontal : Rows}
                    label={layout === 'split' ? 'Split' : 'Full'}
                  />
                )}
                {!kanbanMode && (
                  <TrayTile onClick={wrap(onToggleOrgView)} isActive={orgView} icon={Eye} label="Org View" />
                )}
              </div>

              {/* Time group */}
              {!kanbanMode && (
                <>
                  <div className="overflow-tray-group-label">Time</div>
                  <div className="overflow-tray-grid">
                    <TrayTile onClick={wrap(onOpenAdvanceTime)} isActive={false} icon={Clock} label="Advance" />
                    <TrayTile onClick={wrap(onToggleHistory)} isActive={historyOpen} icon={ClockCounterClockwise} label="History" />
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
          </div>
        )}
      </div>

      {/* Search & settings — always visible, always icon-only */}
      <button className="btn-icon" onClick={onOpenSearch} title="Search nodes (Ctrl+K)">
        <MagnifyingGlass size={18} />
      </button>
      <button className="btn-icon" onClick={() => openSettings()} title="Settings">
        <GearSix size={18} />
      </button>
    </div>
  );
}
