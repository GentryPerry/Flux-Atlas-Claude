import { useState, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import {
  X, ArrowsInSimple, ArrowsOutSimple, Plus, Link, LinkBreak,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import { resolveIcon } from '../../utils/iconRegistry';
import { DEFAULT_TYPE_COLORS } from '../../utils/typeColors';

// ── Constants ─────────────────────────────────────────────────────────────────

const THREAD_COLORS = ['#4a8fd4', '#f59242', '#3da86b', '#e0617a', '#8b65c9', '#f5c842', '#94a3b8'];

// Three milestone states: dim = upcoming/future, active = current focus, solid = completed
const MILESTONE_STATES = ['dim', 'active', 'solid'];

// ── Node Picker ───────────────────────────────────────────────────────────────

function NodePicker({ nodes, exclude, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const ref      = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = nodes
    .filter((n) => !exclude.includes(n.id))
    .filter((n) => !query.trim() || (n.fields?.name ?? '').toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  return (
    <div className="lt-node-picker" ref={ref}>
      <input
        ref={inputRef}
        className="lt-node-picker-input"
        placeholder="Search nodes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="lt-node-picker-list">
        {filtered.length === 0 && <div className="lt-node-picker-empty">No nodes found</div>}
        {filtered.map((n) => {
          const color    = DEFAULT_TYPE_COLORS[n.type] || '#8890a0';
          const IconComp = resolveIcon(n.fields?.icon || n.type);
          return (
            <button key={n.id} className="lt-node-picker-item" onClick={() => onSelect(n)}>
              <span className="lt-npi-icon" style={{ color }}><IconComp size={12} /></span>
              <span className="lt-npi-name">{n.fields?.name ?? '(unnamed)'}</span>
              <span className="lt-npi-type">{n.type}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Node Chip ─────────────────────────────────────────────────────────────────

function NodeChip({ node, onUnlink, onSelect }) {
  const [hovering, setHovering] = useState(false);
  const color    = DEFAULT_TYPE_COLORS[node.type] || '#8890a0';
  const IconComp = resolveIcon(node.fields?.icon || node.type);

  return (
    <div
      className="tt-node-chip"
      style={{ '--chip-color': color }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        className="tt-node-chip-btn"
        onClick={() => onSelect(node.id)}
        title={`Go to ${node.fields?.name ?? '(unnamed)'}`}
      >
        <IconComp size={10} />
        <span>{node.fields?.name ?? '(unnamed)'}</span>
      </button>
      {hovering && (
        <button className="tt-node-chip-unlink" onClick={onUnlink} title="Unlink">
          <LinkBreak size={9} />
        </button>
      )}
    </div>
  );
}

// ── Flow Milestone Card ───────────────────────────────────────────────────────
// Single click → cycle state (dim → active → solid → dim)
// Double-click or right-click → rename inline
// Blur with empty label → delete self

function FlowMilestone({ milestone, threadColor, onUpdate, onDelete }) {
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState(milestone.label);
  const clickTimer = useRef(null);

  useEffect(() => { setDraft(milestone.label); }, [milestone.label]);
  useEffect(() => () => { if (clickTimer.current) clearTimeout(clickTimer.current); }, []);

  const cycleState = () => {
    const nextIdx = (MILESTONE_STATES.indexOf(milestone.status) + 1) % MILESTONE_STATES.length;
    onUpdate({ status: MILESTONE_STATES[nextIdx] });
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (editing) return;
    if (clickTimer.current) {
      // Second click within threshold → edit
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setEditing(true);
    } else {
      // First click — wait to see if double
      clickTimer.current = setTimeout(() => {
        cycleState();
        clickTimer.current = null;
      }, 240);
    }
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed) onDelete();
    else onUpdate({ label: trimmed });
  };

  const isSolid  = milestone.status === 'solid';
  const isActive = milestone.status === 'active';

  return (
    <div
      className={`tt-flow-card ${milestone.status}`}
      style={{
        '--thread-color': threadColor,
        borderColor: isActive ? threadColor : undefined,
        background:  isActive ? `${threadColor}1A` : undefined,
        boxShadow:   isActive ? `0 0 8px ${threadColor}30` : undefined,
      }}
      onClick={handleClick}
      onContextMenu={handleRightClick}
      title={
        isSolid  ? 'Completed — click to reopen' :
        isActive ? 'Active focus — click to complete' :
        'Upcoming — click to activate, double-click to rename'
      }
    >
      {editing ? (
        <input
          className="tt-flow-card-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  e.target.blur();
            if (e.key === 'Escape') { setDraft(milestone.label); setEditing(false); }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="tt-flow-card-label">{milestone.label}</span>
      )}
    </div>
  );
}

// ── Thread Row ────────────────────────────────────────────────────────────────

function ThreadRow({ thread, allNodes, onUpdate, onRemove, onSelectNode }) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft,   setNameDraft]   = useState(thread.label);
  const [pickerOpen,  setPickerOpen]  = useState(false);

  useEffect(() => { setNameDraft(thread.label); }, [thread.label]);

  const cycleColor = () => {
    const idx = THREAD_COLORS.indexOf(thread.color);
    onUpdate({ color: THREAD_COLORS[(idx + 1) % THREAD_COLORS.length] });
  };

  const linkedNodes = (thread.linkedNodeIds ?? [])
    .map((id) => allNodes.find((n) => n.id === id))
    .filter(Boolean);

  const linkNode   = (id) => {
    if ((thread.linkedNodeIds ?? []).includes(id)) return;
    onUpdate({ linkedNodeIds: [...(thread.linkedNodeIds ?? []), id] });
  };
  const unlinkNode = (id) =>
    onUpdate({ linkedNodeIds: (thread.linkedNodeIds ?? []).filter((x) => x !== id) });

  const milestones      = thread.milestones ?? [];
  const updateMilestone = (msId, ch) =>
    onUpdate({ milestones: milestones.map((m) => (m.id === msId ? { ...m, ...ch } : m)) });
  const removeMilestone = (msId) =>
    onUpdate({ milestones: milestones.filter((m) => m.id !== msId) });
  const addMilestone = () =>
    onUpdate({ milestones: [...milestones, { id: uuid(), label: 'New Event', status: 'dim' }] });

  // Connector colour: solid if the preceding milestone is 'solid', thread-tinted if 'active', faint otherwise
  const connectorColor = (prevStatus) =>
    prevStatus === 'solid'  ? 'var(--border-strong)' :
    prevStatus === 'active' ? `${thread.color ?? '#4a8fd4'}88` :
    'rgba(255,255,255,0.10)';

  return (
    <div className="tt-thread">
      {/* ── Header ── */}
      <div className="tt-thread-header">
        <button
          className="tt-color-dot"
          style={{ background: thread.color ?? '#4a8fd4' }}
          onClick={cycleColor}
          title="Change color"
        />

        {editingName ? (
          <input
            className="tt-name-input"
            value={nameDraft}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => { setEditingName(false); onUpdate({ label: nameDraft.trim() || 'Thread' }); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
          />
        ) : (
          <span
            className="tt-thread-name"
            onDoubleClick={() => setEditingName(true)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setEditingName(true); }}
            title="Double-click to rename"
          >
            {thread.label}
          </span>
        )}

        {/* Linked node chips + picker */}
        <div className="tt-chips-row">
          {linkedNodes.map((n) => (
            <NodeChip key={n.id} node={n} onUnlink={() => unlinkNode(n.id)} onSelect={onSelectNode} />
          ))}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              className="tt-tag-btn"
              onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
              title="Link a node"
            >
              <Link size={10} />
              {linkedNodes.length === 0 && <span>Tag</span>}
            </button>
            {pickerOpen && (
              <NodePicker
                nodes={allNodes}
                exclude={thread.linkedNodeIds ?? []}
                onSelect={(n) => { linkNode(n.id); setPickerOpen(false); }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        </div>

        <button className="tt-thread-remove" onClick={onRemove} title="Remove thread">
          <X size={11} />
        </button>
      </div>

      {/* ── Timeline ── */}
      <div className="tt-timeline">
        {milestones.length === 0 && (
          <span className="tt-timeline-empty">No events — click + to add one</span>
        )}

        {milestones.map((ms, i) => (
          <div key={ms.id} className="tt-milestone-item">
            {/* Connector from previous milestone */}
            {i > 0 && (
              <div
                className="tt-connector"
                style={{ background: connectorColor(milestones[i - 1].status) }}
              />
            )}
            <FlowMilestone
              milestone={ms}
              threadColor={thread.color ?? '#4a8fd4'}
              onUpdate={(ch) => updateMilestone(ms.id, ch)}
              onDelete={() => removeMilestone(ms.id)}
            />
          </div>
        ))}

        {/* Trailing stub + add button */}
        <div className="tt-milestone-item">
          {milestones.length > 0 && (
            <div className="tt-connector" style={{ background: 'rgba(255,255,255,0.08)' }} />
          )}
          <button className="tt-add-milestone" onClick={addMilestone} title="Add event">
            <Plus size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────

export default function ThreadTrackerWidget({
  widget, onUpdate, onUpdateData, onRemove, onContextMenu,
}) {
  const { isMinimized, data } = widget;
  const width   = data.width   ?? 600;
  const title   = data.title   ?? 'Narrative Arc';
  const threads = data.threads ?? [];

  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const allNodes   = useNodeStore((s) => s.nodes).filter((n) => n.campaignId === campaignId);
  const selectNode = useNodeStore((s) => s.selectNode);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft,   setTitleDraft]   = useState(title);
  useEffect(() => { setTitleDraft(title); }, [title]);

  const updateThread = (threadId, ch) =>
    onUpdateData({ threads: threads.map((t) => (t.id === threadId ? { ...t, ...ch } : t)) });
  const removeThread = (threadId) =>
    onUpdateData({ threads: threads.filter((t) => t.id !== threadId) });

  const addThread = () => {
    const color = THREAD_COLORS[threads.length % THREAD_COLORS.length];
    onUpdateData({
      threads: [...threads, {
        id: uuid(),
        label: 'New Thread',
        color,
        linkedNodeIds: [],
        milestones: [{ id: uuid(), label: 'Opening', status: 'dim' }],
      }],
    });
  };

  return (
    <div
      className={`widget-shell thread-tracker-widget ${isMinimized ? 'widget-minimized' : ''}`}
      style={{ width: isMinimized ? 240 : width }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e); }}
    >
      {/* ── Title bar ── */}
      <div className="tt-titlebar" data-drag-handle="true">
        {editingTitle ? (
          <input
            className="tt-title-input"
            value={titleDraft}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => { setEditingTitle(false); onUpdateData({ title: titleDraft.trim() || 'Narrative Arc' }); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
          />
        ) : (
          <span className="tt-title" onDoubleClick={() => setEditingTitle(true)}>
            {title}
          </span>
        )}
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
        <div className="tt-body">
          {threads.length === 0 && (
            <div className="tt-empty-state">
              No threads yet — add one below
            </div>
          )}

          {threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              allNodes={allNodes}
              onUpdate={(ch) => updateThread(thread.id, ch)}
              onRemove={() => removeThread(thread.id)}
              onSelectNode={(nodeId) => selectNode(nodeId)}
            />
          ))}

          <button className="tt-add-thread-btn" onClick={addThread}>
            <Plus size={12} /> Add thread
          </button>
        </div>
      )}

      {/* ── Resize handle ── */}
      {!isMinimized && (
        <div className="widget-resize-handle" data-resize-handle="true" title="Drag to resize" />
      )}
    </div>
  );
}
