import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import {
  X, ArrowsInSimple, ArrowsOutSimple, Plus,
  ArrowsHorizontal, ArrowRight, Link, LinkBreak,
  Minus,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import { resolveIcon } from '../../utils/iconRegistry';
import { DEFAULT_TYPE_COLORS } from '../../utils/typeColors';

// ── Track color palette ───────────────────────────────────────────────────────
const TRACK_COLORS = ['#f59242', '#4a8fd4', '#3da86b', '#e0617a', '#8b65c9', '#f5c842', '#94a3b8'];

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// ── Inline node picker popup ──────────────────────────────────────────────────
function NodePicker({ nodes, onSelect, onClose, alignRight }) {
  const [query, setQuery] = useState('');
  const ref      = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = query.trim()
    ? nodes.filter((n) => (n.fields?.name ?? '').toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : nodes.slice(0, 8);

  return (
    <div className={`lt-node-picker ${alignRight ? 'align-right' : ''}`} ref={ref}>
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

// ── End cap — editable label or linked node (shown for all bar modes) ─────────
function EndCap({ label, linkedNodeId, allNodes, alignRight, onChangeLabel, onLink, onUnlink, onSelectNode }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(label);
  const [hovering, setHovering] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { setDraft(label); }, [label]);

  const linkedNode = linkedNodeId ? allNodes.find((n) => n.id === linkedNodeId) : null;
  const nodeColor  = linkedNode ? (DEFAULT_TYPE_COLORS[linkedNode.type] || '#8890a0') : null;
  const NodeIcon   = linkedNode ? resolveIcon(linkedNode.fields?.icon || linkedNode.type) : null;

  if (linkedNode) {
    return (
      <div
        className={`lt-endcap linked ${alignRight ? 'right' : 'left'}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{ position: 'relative' }}
      >
        <button
          className="lt-linked-node-chip"
          style={{ '--chip-color': nodeColor }}
          onClick={() => onSelectNode(linkedNode.id)}
          title={`Go to ${linkedNode.fields?.name}`}
        >
          {NodeIcon && <NodeIcon size={11} />}
          <span>{linkedNode.fields?.name ?? '(unnamed)'}</span>
        </button>
        {hovering && (
          <button className="lt-endcap-unlink" onClick={onUnlink} title="Unlink">
            <LinkBreak size={10} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`lt-endcap ${alignRight ? 'right' : 'left'}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{ position: 'relative' }}
    >
      {editing ? (
        <input
          className="lt-end-label-input"
          value={draft}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setEditing(false); onChangeLabel(draft.trim()); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
        />
      ) : (
        <span
        className={`lt-end-label${!label ? ' lt-end-label-empty' : ''}`}
        onClick={() => setEditing(true)}
        title={label ? 'Click to edit' : 'Click to add label'}
      >
        {label || <span className="lt-end-label-placeholder">label</span>}
        {hovering && label && <span className="lt-end-label-edit-hint">✎</span>}
      </span>
      )}

      {hovering && !editing && (
        <button
          className="lt-endcap-link-btn"
          onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
          title="Link a node to this end"
        >
          <Link size={10} />
        </button>
      )}

      {pickerOpen && (
        <NodePicker
          nodes={allNodes}
          alignRight={alignRight}
          onSelect={(n) => { onLink(n.id); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ── Single track bar ──────────────────────────────────────────────────────────
function TrackBar({ track, allNodes, onUpdate, onRemove, onSelectNode }) {
  const isBipolar = track.mode === 'bipolar';
  const value     = clamp(track.value ?? 0, isBipolar ? -100 : 0, 100);
  const barRef    = useRef(null);
  const dragging  = useRef(false);

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft,   setLabelDraft]   = useState(track.label);
  const [editingValue, setEditingValue] = useState(false);
  const [valueDraft,   setValueDraft]   = useState(String(value));

  useEffect(() => { setLabelDraft(track.label); }, [track.label]);

  // Bar fill geometry
  const fillLeft  = isBipolar ? (value >= 0 ? 50 : 50 + value / 2) : 0;
  const fillWidth = isBipolar ? Math.abs(value) / 2 : value;

  // Drag to set value
  const applyMouse = useCallback((clientX) => {
    if (!barRef.current) return;
    const rect  = barRef.current.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const raw   = isBipolar ? (ratio * 200 - 100) : ratio * 100;
    onUpdate({ value: Math.round(raw) });
  }, [isBipolar, onUpdate]);

  const handleBarMouseDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    applyMouse(e.clientX);
    const onMove = (ev) => { if (dragging.current) applyMouse(ev.clientX); };
    const onUp   = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  };

  const cycleColor = () => {
    const idx = TRACK_COLORS.indexOf(track.color);
    onUpdate({ color: TRACK_COLORS[(idx + 1) % TRACK_COLORS.length] });
  };

  return (
    <div className="lt-track">
      {/* ── Track header ── */}
      <div className="lt-track-header">
        <button className="lt-color-dot-btn" style={{ background: track.color }} onClick={cycleColor} title="Change color" />

        {editingLabel ? (
          <input
            className="lt-inline-input"
            value={labelDraft}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={() => { setEditingLabel(false); onUpdate({ label: labelDraft.trim() || 'Track' }); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
          />
        ) : (
          <span className="lt-track-label" onDoubleClick={() => setEditingLabel(true)}>
            {track.label}
          </span>
        )}

        {/* Bipolar / Unipolar toggle */}
        <button
          className={`lt-mode-btn ${isBipolar ? 'active' : ''}`}
          onClick={() => onUpdate({ mode: isBipolar ? 'unipolar' : 'bipolar', value: 0 })}
          title={isBipolar ? 'Bipolar ±100 — click for 0–100' : 'Unipolar 0–100 — click for ±100'}
        >
          {isBipolar ? <ArrowsHorizontal size={11} /> : <ArrowRight size={11} />}
        </button>

        {/* −10 / value / +10 */}
        <div className="lt-stepper">
          <button
            className="lt-step-btn"
            onClick={() => onUpdate({ value: clamp(value - 10, isBipolar ? -100 : 0, 100) })}
            title="-10"
          >
            <Minus size={9} />
          </button>

          {editingValue ? (
            <input
              className="lt-value-input"
              value={valueDraft}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setValueDraft(e.target.value)}
              onBlur={() => {
                setEditingValue(false);
                const p = parseInt(valueDraft, 10);
                if (!isNaN(p)) onUpdate({ value: clamp(p, isBipolar ? -100 : 0, 100) });
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
            />
          ) : (
            <span
              className="lt-value"
              style={{ color: track.color }}
              onDoubleClick={() => { setValueDraft(String(value)); setEditingValue(true); }}
            >
              {isBipolar && value > 0 ? `+${value}` : value}
            </span>
          )}

          <button
            className="lt-step-btn"
            onClick={() => onUpdate({ value: clamp(value + 10, isBipolar ? -100 : 0, 100) })}
            title="+10"
          >
            <Plus size={9} />
          </button>
        </div>

        <button className="lt-track-remove" onClick={onRemove} title="Remove bar">
          <X size={10} />
        </button>
      </div>

      {/* ── End caps: always visible, labels optional for unipolar bars ── */}
      <div className="lt-end-caps">
        <EndCap
          label={track.labelLeft ?? (isBipolar ? 'Low' : '')}
          linkedNodeId={track.linkedNodeLeft}
          allNodes={allNodes}
          alignRight={false}
          onChangeLabel={(v) => onUpdate({ labelLeft: v })}
          onLink={(id) => onUpdate({ linkedNodeLeft: id })}
          onUnlink={() => onUpdate({ linkedNodeLeft: null })}
          onSelectNode={onSelectNode}
        />
        <EndCap
          label={track.labelRight ?? (isBipolar ? 'High' : '')}
          linkedNodeId={track.linkedNodeRight}
          allNodes={allNodes}
          alignRight={true}
          onChangeLabel={(v) => onUpdate({ labelRight: v })}
          onLink={(id) => onUpdate({ linkedNodeRight: id })}
          onUnlink={() => onUpdate({ linkedNodeRight: null })}
          onSelectNode={onSelectNode}
        />
      </div>

      {/* ── Bar ── */}
      <div className="lt-bar-track" ref={barRef} onMouseDown={handleBarMouseDown}>
        {isBipolar && <div className="lt-center-line" />}
        <div
          className="lt-bar-fill"
          style={{ left: `${fillLeft}%`, width: `${fillWidth}%`, background: track.color }}
        />
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function LinearTrackerWidget({
  widget, onUpdate, onUpdateData, onRemove, onContextMenu,
}) {
  const { isMinimized, data } = widget;
  const width  = data.width  ?? 300;
  const title  = data.title  ?? 'Tracker';
  const tracks = data.tracks ?? [];

  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const allNodes   = useNodeStore((s) => s.nodes).filter((n) => n.campaignId === campaignId);
  const selectNode = useNodeStore((s) => s.selectNode);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft,   setTitleDraft]   = useState(title);
  useEffect(() => { setTitleDraft(title); }, [title]);

  const updateTrack = (trackId, changes) =>
    onUpdateData({ tracks: tracks.map((t) => (t.id === trackId ? { ...t, ...changes } : t)) });

  const removeTrack = (trackId) => {
    if (tracks.length <= 1) return;
    onUpdateData({ tracks: tracks.filter((t) => t.id !== trackId) });
  };

  const addTrack = () => {
    const color = TRACK_COLORS[tracks.length % TRACK_COLORS.length];
    onUpdateData({
      tracks: [...tracks, { id: uuid(), label: 'New Track', value: 0, mode: 'unipolar', color }],
    });
  };

  return (
    <div
      className={`widget-shell linear-tracker-widget ${isMinimized ? 'widget-minimized' : ''}`}
      style={{ width: isMinimized ? 240 : width }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e); }}
    >
      {/* ── Title bar ── */}
      <div className="lt-titlebar" data-drag-handle="true">
        {editingTitle ? (
          <input
            className="lt-title-input"
            value={titleDraft}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => { setEditingTitle(false); onUpdateData({ title: titleDraft.trim() || 'Tracker' }); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
          />
        ) : (
          <span className="lt-title" onDoubleClick={() => setEditingTitle(true)}>{title}</span>
        )}
        <div className="widget-controls">
          <button className="widget-ctrl-btn" onClick={() => onUpdate({ isMinimized: !isMinimized })}
            title={isMinimized ? 'Expand' : 'Minimise'}>
            {isMinimized ? <ArrowsOutSimple size={11} /> : <ArrowsInSimple size={11} />}
          </button>
          <button className="widget-ctrl-btn close" onClick={onRemove} title="Remove widget">
            <X size={11} />
          </button>
        </div>
      </div>

      {/* ── Track list ── */}
      {!isMinimized && (
        <div className="lt-body">
          {tracks.map((track) => (
            <TrackBar
              key={track.id}
              track={track}
              allNodes={allNodes}
              onUpdate={(ch) => updateTrack(track.id, ch)}
              onRemove={() => removeTrack(track.id)}
              onSelectNode={(nodeId) => selectNode(nodeId)}
            />
          ))}
          <button className="lt-add-track-btn" onClick={addTrack}>
            <Plus size={12} /> Add bar
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
