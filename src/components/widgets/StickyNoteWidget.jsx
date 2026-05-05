import { useState, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { ArrowsInSimple, ArrowsOutSimple, X, List } from '@phosphor-icons/react';

// ── Color palette ─────────────────────────────────────────────────────────────

export const NOTE_COLORS = {
  yellow: { bg: '#2d2700', border: '#f5c842', text: '#f5e89a', dot: '#f5c842' },
  pink:   { bg: '#2d0f18', border: '#e0617a', text: '#f5a0b0', dot: '#e0617a' },
  blue:   { bg: '#0b1e35', border: '#4a8fd4', text: '#93c5fd', dot: '#4a8fd4' },
  green:  { bg: '#0b2218', border: '#3da86b', text: '#86efac', dot: '#3da86b' },
  purple: { bg: '#1c1030', border: '#8b65c9', text: '#c4b5fd', dot: '#8b65c9' },
};
export const COLOR_KEYS = Object.keys(NOTE_COLORS);

// ── Data helpers ──────────────────────────────────────────────────────────────

/** Migrate old single-note format to tabbed format. */
export function normalizeStickyData(data) {
  if (data.tabs) return data; // already new format
  // Legacy single-note → wrap in tabs array
  const tab = { id: uuid(), title: data.title ?? 'Note', content: data.content ?? '', color: data.color ?? 'yellow' };
  return { tabs: [tab], activeTabId: tab.id, width: data.width ?? 260, height: data.height ?? 160 };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StickyTab({ tab, isActive, canClose, onActivate, onClose, onRename }) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(tab.title);
  const inputRef                = useRef(null);
  const scheme = NOTE_COLORS[tab.color] || NOTE_COLORS.yellow;

  useEffect(() => { setDraft(tab.title); }, [tab.title]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    onRename(draft.trim() || 'Note');
  };

  return (
    <div
      className={`widget-tab ${isActive ? 'active' : ''}`}
      style={{ '--tab-dot': scheme.dot, '--tab-border': scheme.border, '--tab-bg': scheme.bg }}
      onClick={onActivate}
      title={tab.title}
    >
      <span className="widget-tab-dot" style={{ background: scheme.dot }} />

      {editing ? (
        <input
          ref={inputRef}
          className="widget-tab-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commit(); }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="widget-tab-title"
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
        >
          {tab.title}
        </span>
      )}

      {canClose && (
        <button
          className="widget-tab-close"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          title="Close tab"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function StickyNoteWidget({
  widget,
  onUpdate,
  onUpdateData,
  onRemove,
  onResizeStart,
  onContextMenu,   // (e) => void
}) {
  const { isMinimized, data: rawData } = widget;

  // Normalise data (handles legacy single-note format)
  const data = normalizeStickyData(rawData);
  const { tabs, activeTabId, width = 260, height = 160 } = data;
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const scheme    = NOTE_COLORS[activeTab?.color] || NOTE_COLORS.yellow;

  // Flush normalised format back to store on first render if it was migrated
  const didMigrateRef = useRef(false);
  useEffect(() => {
    if (!rawData.tabs && !didMigrateRef.current) {
      didMigrateRef.current = true;
      onUpdateData(data);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab overflow detection ──────────────────────────────────────────────────
  const tabsScrollRef              = useRef(null);
  const [tabsOverflow, setTabsOverflow] = useState(false);
  const [tabMenuOpen, setTabMenuOpen]   = useState(false);
  const tabMenuRef                      = useRef(null);

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const check = () => setTabsOverflow(el.scrollWidth > el.clientWidth + 2);
    const obs = new ResizeObserver(check);
    obs.observe(el);
    check();
    return () => obs.disconnect();
  }, [tabs]);

  // Close tab menu on outside click
  useEffect(() => {
    if (!tabMenuOpen) return;
    const handler = (e) => {
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target)) setTabMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tabMenuOpen]);

  // ── Tab helpers ─────────────────────────────────────────────────────────────

  const setTabs = (newTabs, newActiveId) => {
    onUpdateData({ tabs: newTabs, activeTabId: newActiveId ?? activeTabId });
  };

  const addTab = () => {
    const t = { id: uuid(), title: 'New Note', content: '', color: activeTab?.color ?? 'yellow' };
    setTabs([...tabs, t], t.id);
  };

  const closeTab = (tabId) => {
    if (tabs.length <= 1) return;
    const remaining = tabs.filter((t) => t.id !== tabId);
    const newActiveId = tabId === activeTabId
      ? remaining[Math.max(0, tabs.findIndex((t) => t.id === tabId) - 1)].id
      : activeTabId;
    setTabs(remaining, newActiveId);
  };

  const renameTab = (tabId, title) => {
    setTabs(tabs.map((t) => t.id === tabId ? { ...t, title } : t));
  };

  const updateActiveContent = (content) => {
    setTabs(tabs.map((t) => t.id === activeTab.id ? { ...t, content } : t));
  };

  return (
    <div
      className={`widget-shell sticky-note-widget ${isMinimized ? 'widget-minimized' : ''}`}
      style={{
        width: isMinimized ? 'fit-content' : width,
        '--note-bg':     scheme.bg,
        '--note-border': scheme.border,
        '--note-text':   scheme.text,
      }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e); }}
    >
      {/* ── Tab bar (drag handle) ── */}
      <div className="widget-tabbar" data-drag-handle="true">
        <div className="widget-tabs-scroll" ref={tabsScrollRef}>
          {tabs.map((tab) => (
            <StickyTab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              canClose={tabs.length > 1}
              onActivate={() => onUpdateData({ activeTabId: tab.id })}
              onClose={() => closeTab(tab.id)}
              onRename={(title) => renameTab(tab.id, title)}
            />
          ))}
        </div>

        {/* Overflow tab list */}
        {tabsOverflow && (
          <div style={{ position: 'relative' }} ref={tabMenuRef}>
            <button
              className={`widget-tab-overflow-btn ${tabMenuOpen ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setTabMenuOpen((v) => !v); }}
              title="All tabs"
            >
              <List size={12} />
            </button>
            {tabMenuOpen && (
              <div className="widget-tab-overflow-menu">
                {tabs.map((tab) => {
                  const s = NOTE_COLORS[tab.color] || NOTE_COLORS.yellow;
                  return (
                    <button
                      key={tab.id}
                      className={`widget-tab-overflow-item ${tab.id === activeTabId ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateData({ activeTabId: tab.id });
                        setTabMenuOpen(false);
                      }}
                    >
                      <span className="widget-tab-dot" style={{ background: s.dot, flexShrink: 0 }} />
                      {tab.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button className="widget-tab-add" onClick={addTab} title="Add tab">
          +
        </button>

        {/* Widget-level controls */}
        <div className="widget-controls">
          <button
            className="widget-ctrl-btn"
            onClick={() => onUpdate({ isMinimized: !isMinimized })}
            title={isMinimized ? 'Expand' : 'Minimise'}
          >
            {isMinimized ? <ArrowsOutSimple size={11} /> : <ArrowsInSimple size={11} />}
          </button>
          <button className="widget-ctrl-btn close" onClick={onRemove} title="Remove widget">
            <X size={11} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {!isMinimized && (
        <div className="sticky-note-body" style={{ height }}>
          <textarea
            key={activeTab?.id} // remount on tab switch so scroll resets
            className="sticky-note-textarea"
            value={activeTab?.content ?? ''}
            placeholder="Write anything…"
            onChange={(e) => updateActiveContent(e.target.value)}
            style={{ color: scheme.text }}
          />
        </div>
      )}

      {/* ── Resize handle ── */}
      {!isMinimized && (
        <div
          className="widget-resize-handle"
          data-resize-handle="true"
          onMouseDown={onResizeStart}
          title="Drag to resize"
        />
      )}
    </div>
  );
}
