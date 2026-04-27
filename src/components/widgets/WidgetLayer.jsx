import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowsInSimple, ArrowsOutSimple, X } from '@phosphor-icons/react';
import useWidgetStore from '../../stores/widgetStore';
import useCampaignStore from '../../stores/campaignStore';
import useViewportStore from '../../stores/viewportStore';
import StickyNoteWidget, { NOTE_COLORS, COLOR_KEYS, normalizeStickyData } from './StickyNoteWidget';
import LinearTrackerWidget from './LinearTrackerWidget';
import ThreadTrackerWidget from './ThreadTrackerWidget';
import ClockWidget from './ClockWidget';
import TroubleEngineWidget from './TroubleEngineWidget';

// ── Context Menu ──────────────────────────────────────────────────────────────

function WidgetContextMenu({ menu, widgets, updateWidget, updateWidgetData, removeWidget, onClose }) {
  const menuRef = useRef(null);
  const widget  = widgets.find((w) => w.id === menu.widgetId);
  if (!widget) return null;

  const data        = widget.type === 'sticky-note' ? normalizeStickyData(widget.data) : widget.data;
  const activeTab   = data.tabs?.find((t) => t.id === data.activeTabId) ?? data.tabs?.[0];
  const activeColor = activeTab?.color ?? 'yellow';

  // Close on outside click or Escape
  useEffect(() => {
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    const onKey  = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown',   onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown',   onKey);
    };
  }, [onClose]);

  const act = (fn) => { fn(); onClose(); };

  // Clamp menu position so it doesn't overflow the viewport
  const menuW = 190, menuH = 220;
  const x = Math.min(menu.x, window.innerWidth  - menuW - 8);
  const y = Math.min(menu.y, window.innerHeight - menuH - 8);

  const changeColor = (color) => {
    if (!data.tabs) return;
    const newTabs = data.tabs.map((t) => t.id === data.activeTabId ? { ...t, color } : t);
    updateWidgetData(widget.id, { tabs: newTabs });
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="widget-context-menu"
      style={{ left: x, top: y }}
    >
      {/* Minimize / Expand */}
      <button
        className="wcm-item"
        onClick={() => act(() => updateWidget(widget.id, { isMinimized: !widget.isMinimized }))}
      >
        {widget.isMinimized
          ? <><ArrowsOutSimple size={13} /> Expand</>
          : <><ArrowsInSimple size={13} /> Minimise</>}
      </button>

      {/* Color picker (sticky notes only) */}
      {widget.type === 'sticky-note' && (
        <>
          <div className="wcm-divider" />
          <div className="wcm-label">Note Color</div>
          <div className="wcm-colors">
            {COLOR_KEYS.map((k) => (
              <button
                key={k}
                className={`wcm-color-dot ${k === activeColor ? 'active' : ''}`}
                style={{ background: NOTE_COLORS[k].dot }}
                onClick={() => changeColor(k)}
                title={k}
              />
            ))}
          </div>
        </>
      )}

      <div className="wcm-divider" />

      {/* Delete */}
      <button
        className="wcm-item danger"
        onClick={() => act(() => removeWidget(widget.id))}
      >
        <X size={13} /> Delete Widget
      </button>
    </div>
  );
}

// ── Widget Layer ──────────────────────────────────────────────────────────────

export default function WidgetLayer() {
  const campaignId       = useCampaignStore((s) => s.activeCampaignId);
  const allWidgets       = useWidgetStore((s) => s.widgets);
  const updateWidget     = useWidgetStore((s) => s.updateWidget);
  const updateWidgetData = useWidgetStore((s) => s.updateWidgetData);
  const removeWidget     = useWidgetStore((s) => s.removeWidget);

  // Live viewport so we can transform canvas coords → screen coords
  const vpX     = useViewportStore((s) => s.x);
  const vpY     = useViewportStore((s) => s.y);
  const vpScale = useViewportStore((s) => s.scale);

  const widgets = allWidgets.filter((w) => w.campaignId === campaignId);

  // ── Context menu state ───────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState(null); // { widgetId, x, y }

  const openContextMenu = useCallback((e, widgetId) => {
    e.preventDefault();
    setContextMenu({ widgetId, x: e.clientX, y: e.clientY });
  }, []);

  // ── Drag / resize ────────────────────────────────────────────────────────
  // interactionRef stores either:
  //   { mode: 'drag',   id, startCanvasX, startCanvasY, startMouseX, startMouseY }
  //   { mode: 'resize', id, startW, startH, startMouseX, startMouseY }
  const interactionRef = useRef(null);
  const layerRef       = useRef(null);

  // Works for both MouseEvent and TouchEvent
  const getClientXY = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  // Shared move logic used by both mouse and touch handlers
  const handlePointerMove = useCallback((clientX, clientY) => {
    const ia = interactionRef.current;
    if (!ia) return;

    const scale = useViewportStore.getState().scale;
    if (ia.mode === 'drag') {
      // Convert delta from screen space to canvas space
      const dx = (clientX - ia.startMouseX) / scale;
      const dy = (clientY - ia.startMouseY) / scale;
      updateWidget(ia.id, {
        position: {
          x: ia.startCanvasX + dx,
          y: ia.startCanvasY + dy,
        },
      });
    } else if (ia.mode === 'resize') {
      // Resize delta also in canvas space
      updateWidgetData(ia.id, {
        width:  Math.round(Math.max(180, ia.startW + (clientX - ia.startMouseX) / scale)),
        height: Math.round(Math.max(80,  ia.startH + (clientY - ia.startMouseY) / scale)),
      });
    }
  }, [updateWidget, updateWidgetData]);

  const handleMouseMove = useCallback((e) => {
    handlePointerMove(e.clientX, e.clientY);
  }, [handlePointerMove]);

  const handleTouchMove = useCallback((e) => {
    if (!interactionRef.current) return;
    e.preventDefault(); // prevent page scroll / Konva pan while dragging a widget
    const t = e.touches[0];
    handlePointerMove(t.clientX, t.clientY);
  }, [handlePointerMove]);

  const handleEnd = useCallback(() => { interactionRef.current = null; }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup',   handleEnd);
    // passive: false is required so we can call preventDefault in handleTouchMove
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend',  handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup',   handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend',  handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [handleMouseMove, handleTouchMove, handleEnd]);

  // ── Native (non-passive) touch-start handler on the layer ────────────────
  // React's synthetic onTouchStart is passive — e.preventDefault() is a no-op,
  // so the Konva stage can steal the gesture and pan the map.
  // Attaching directly to the DOM with { passive: false } lets us call both
  // preventDefault() (stops browser scroll / Konva pan) and stopPropagation().
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      const isDragHandle   = e.target.closest('[data-drag-handle]');
      const isResizeHandle = e.target.closest('[data-resize-handle]');
      if (!isDragHandle && !isResizeHandle) return;

      // Find which widget this touch belongs to via the data-widget-id wrapper
      const wrapperEl = e.target.closest('[data-widget-id]');
      if (!wrapperEl) return;

      e.preventDefault();    // stop browser pan / Konva stage drag
      e.stopPropagation();   // don't let it bubble to the canvas container

      const widgetId = wrapperEl.dataset.widgetId;
      const widget   = useWidgetStore.getState().widgets.find((w) => w.id === widgetId);
      if (!widget) return;

      const touch = e.touches[0];

      if (isDragHandle && !e.target.closest('button,input,textarea')) {
        interactionRef.current = {
          mode:         'drag',
          id:           widget.id,
          startCanvasX: widget.position.x,
          startCanvasY: widget.position.y,
          startMouseX:  touch.clientX,
          startMouseY:  touch.clientY,
        };
      } else if (isResizeHandle) {
        const d = widget.type === 'sticky-note' ? normalizeStickyData(widget.data) : widget.data;
        interactionRef.current = {
          mode:       'resize',
          id:          widget.id,
          startMouseX: touch.clientX,
          startMouseY: touch.clientY,
          startW:      d.width  ?? 260,
          startH:      d.height ?? 160,
        };
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => el.removeEventListener('touchstart', onTouchStart);
  }, []); // stable — only refs, no reactive deps

  const startDrag = useCallback((e, widget) => {
    // Mouse-only path (touch is handled by the native listener above)
    if (e.type === 'touchstart') return;
    if (e.target.closest('button,input,textarea')) return;
    interactionRef.current = {
      mode: 'drag',
      id:   widget.id,
      startCanvasX: widget.position.x,
      startCanvasY: widget.position.y,
      startMouseX:  e.clientX,
      startMouseY:  e.clientY,
    };
  }, []);

  const startResize = useCallback((e, widget) => {
    // Mouse-only path (touch is handled by the native listener above)
    if (e.type === 'touchstart') return;
    e.stopPropagation();
    const d = widget.type === 'sticky-note' ? normalizeStickyData(widget.data) : widget.data;
    interactionRef.current = {
      mode: 'resize', id: widget.id,
      startMouseX: e.clientX, startMouseY: e.clientY,
      startW: d.width ?? 260, startH: d.height ?? 160,
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!campaignId) return null;

  // Helper to render any widget type
  const renderWidget = (widget) => {
    const wrapperStyle = { position: 'absolute', left: widget.position.x, top: widget.position.y };
    const onPointerDown = (e) => {
      if (e.target.closest('[data-drag-handle]'))   startDrag(e, widget);
      if (e.target.closest('[data-resize-handle]')) startResize(e, widget);
    };
    const shared = {
      widget,
      onUpdate:      (ch) => updateWidget(widget.id, ch),
      onUpdateData:  (ch) => updateWidgetData(widget.id, ch),
      onRemove:      ()   => removeWidget(widget.id),
      onContextMenu: (e)  => openContextMenu(e, widget.id),
    };
    let inner = null;
    switch (widget.type) {
      case 'sticky-note':
        inner = <StickyNoteWidget   {...shared} onResizeStart={(e) => startResize(e, widget)} />; break;
      case 'linear-tracker':
        inner = <LinearTrackerWidget {...shared} onResizeStart={(e) => startResize(e, widget)} />; break;
      case 'thread-tracker':
        inner = <ThreadTrackerWidget {...shared} onResizeStart={(e) => startResize(e, widget)} />; break;
      case 'clock-widget':
        inner = <ClockWidget            {...shared} onResizeStart={(e) => startResize(e, widget)} />; break;
      case 'trouble-engine':
        inner = <TroubleEngineWidget    {...shared} />; break;
      default: return null;
    }
    return (
      <div key={widget.id} data-widget-id={widget.id} style={wrapperStyle} onMouseDown={onPointerDown}>
        {inner}
      </div>
    );
  };

  return (
    <>
      {/* Mirror the Konva stage transform exactly: translate then scale from origin.
          Children use raw canvas coords for left/top — no double-scaling. */}
      <div
        ref={layerRef}
        className="widget-layer"
        style={{
          transform:       `translate(${vpX}px, ${vpY}px) scale(${vpScale})`,
          transformOrigin: '0 0',
        }}
        aria-label="Map widgets"
        onWheel={(e) => {
          window.dispatchEvent(new CustomEvent('flux:canvasWheel', {
            detail: { deltaY: e.deltaY, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY },
          }));
        }}
      >
        {widgets.map(renderWidget)}
      </div>

      {contextMenu && (
        <WidgetContextMenu
          menu={contextMenu}
          widgets={widgets}
          updateWidget={updateWidget}
          updateWidgetData={updateWidgetData}
          removeWidget={removeWidget}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
    