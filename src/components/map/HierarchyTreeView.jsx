import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Trash, ArrowUp, ArrowDown, X, Check, PencilSimple,
  Users, MagnifyingGlass, Shield, Star, Crown,
} from '@phosphor-icons/react';
import useHierarchyStore from '../../stores/hierarchyStore';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import useTagStore from '../../stores/tagStore';

// ── Helper: find NPCs that belong to an org node ──────────────────────────────
// Org nodes now own their member list directly in fields.members (noderefs).
// Members are stored as character node IDs. Legacy tag-ID references are resolved
// via allTags as a fallback so old data migrates gracefully.
function findTaggedNpcs(allNodes, campaignId, orgNodeId, allTags) {
  const orgNode = allNodes.find((n) => n.id === orgNodeId && n.campaignId === campaignId);
  if (!orgNode) return [];
  const refs = Array.isArray(orgNode.fields?.members) ? orgNode.fields.members : [];
  return refs.map((ref) => {
    // Primary: ref is a character node ID
    const direct = allNodes.find((n) => n.id === ref && n.type === 'character');
    if (direct) return direct;
    // Fallback: ref might be a tag ID (legacy data not yet migrated)
    const tag = allTags.find((t) => t.id === ref && t.nodeId);
    return tag ? allNodes.find((n) => n.id === tag.nodeId && n.type === 'character') : null;
  }).filter(Boolean);
}

// ── Rank color palette ─────────────────────────────────────────────────────────
const RANK_COLORS = [
  '#f5c842', // gold  — top rank
  '#f59242', // orange
  '#4a8fd4', // blue
  '#3da86b', // green
  '#8b65c9', // purple
  '#e0617a', // red-pink
  '#94a3b8', // slate
  '#60707e', // muted grey
];
function rankColor(i) { return RANK_COLORS[i % RANK_COLORS.length]; }

// ── AddMemberPicker ────────────────────────────────────────────────────────────

function AddMemberPicker({ anchorEl, hierarchy, allNodes, campaignId, onAdd, onClose }) {
  const [query, setQuery] = useState('');
  const [pos, setPos]     = useState({ top: 0, left: 0 });
  const inputRef          = useRef(null);
  const pickerRef         = useRef(null);

  // Position below the element that triggered the picker, smart-aligned to available space
  useEffect(() => {
    const el = anchorEl;
    if (el) {
      const r = el.getBoundingClientRect();
      const pickerWidth = 224;
      // Prefer opening left-aligned to button; if it would clip right, right-align instead
      const spaceRight = window.innerWidth - r.left;
      const left = spaceRight >= pickerWidth + 8
        ? r.left
        : Math.max(8, r.right - pickerWidth);
      setPos({ top: r.bottom + 6, left });
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [anchorEl]);

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target) &&
          anchorEl && !anchorEl.contains(e.target)) onClose();
    };
    const keyHandler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown',  keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown',  keyHandler);
    };
  }, [onClose, anchorEl]);

  const assignedIds = useMemo(() => new Set(hierarchy.members.map((m) => m.nodeId)), [hierarchy.members]);

  const candidates = useMemo(() => {
    return allNodes
      .filter((n) => n.campaignId === campaignId && n.type === 'character')
      .filter((n) => !assignedIds.has(n.id))
      .filter((n) => !query || (n.fields?.name || '').toLowerCase().includes(query.toLowerCase()))
      .slice(0, 12);
  }, [allNodes, campaignId, assignedIds, query]);

  return createPortal(
    <div
      className="hpv-picker"
      ref={pickerRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      <div className="hpv-picker-search">
        <MagnifyingGlass size={12} />
        <input
          ref={inputRef}
          className="hpv-picker-input"
          placeholder="Search NPCs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="hpv-picker-list">
        {candidates.length === 0 ? (
          <div className="hpv-picker-empty">
            {assignedIds.size > 0 && !query ? 'All NPCs assigned to this hierarchy' : 'No NPCs found'}
          </div>
        ) : (
          candidates.map((n) => (
            <button
              key={n.id}
              className="hpv-picker-item"
              onClick={() => { onAdd(n.id); onClose(); }}
            >
              {n.fields?.name || '???'}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  );
}

// ── MemberChip ─────────────────────────────────────────────────────────────────

const DRAG_TYPE = 'hpv/member-node-id';

function MemberChip({ member, node, layerName, onUpdateTitle, onRemove, onSelect }) {
  const [editing, setEditing]     = useState(false);
  const [draft,   setDraft]       = useState(member.title || '');
  const inputRef                  = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const name         = node?.fields?.name || '???';
  const displayTitle = member.title || null;

  const save = () => {
    onUpdateTitle(draft.trim());
    setEditing(false);
  };

  return (
    <div
      className="hpv-chip"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DRAG_TYPE, member.nodeId);
      }}
      style={{ cursor: 'grab' }}
    >
      {editing ? (
        <>
          <span className="hpv-chip-name">{name}</span>
          <input
            ref={inputRef}
            className="hpv-chip-title-input"
            placeholder={`Title (default: ${layerName})`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={save}
          />
          <button className="hpv-chip-btn" onClick={save} title="Save title">
            <Check size={10} weight="bold" />
          </button>
        </>
      ) : (
        <>
          <button className="hpv-chip-inner" onClick={() => onSelect?.(node?.id)} title="Open in detail panel">
            <span className="hpv-chip-name">{name}</span>
            {displayTitle && <span className="hpv-chip-title">{displayTitle}</span>}
          </button>
          <button
            className="hpv-chip-btn hpv-chip-edit"
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title="Set individual title"
          >
            <PencilSimple size={10} />
          </button>
          <button
            className="hpv-chip-btn hpv-chip-remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Remove from hierarchy"
          >
            <X size={10} weight="bold" />
          </button>
        </>
      )}
    </div>
  );
}

// ── UnrankedMemberRow ──────────────────────────────────────────────────────────

function UnrankedMemberRow({ node, layers, onAssign, onSelect }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const name = node?.fields?.name || '???';

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      className="hpv-unranked-chip"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DRAG_TYPE, node.id);
      }}
      style={{ cursor: 'grab' }}
    >
      <button className="hpv-unranked-name" onClick={() => onSelect(node.id)} title="Open detail panel">
        {name}
      </button>
      <div className="hpv-unranked-assign-wrap" ref={menuRef}>
        <button
          className="hpv-unranked-assign-btn"
          onClick={() => setMenuOpen((v) => !v)}
          title="Assign to a rank"
        >
          <Plus size={10} weight="bold" /> Assign
        </button>
        {menuOpen && (
          <div className="hpv-unranked-menu">
            {layers.length === 0 ? (
              <div className="hpv-unranked-menu-empty">No ranks yet</div>
            ) : (
              layers.map((layer, i) => (
                <button
                  key={layer.id}
                  className="hpv-unranked-menu-item"
                  style={{ '--layer-dot': rankColor(i) }}
                  onClick={() => { onAssign(layer.id, node.id); setMenuOpen(false); }}
                >
                  <span className="hpv-unranked-menu-dot" />
                  {layer.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── HierarchyLayer ─────────────────────────────────────────────────────────────

function HierarchyLayer({
  layer, layerIndex, totalLayers, hierarchy, nodeMap, campaignId, allNodes,
  onUpdateLayer, onRemoveLayer, onMoveUp, onMoveDown,
  onAddMember, onUpdateMember, onRemoveMember, onSelectNode,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft,   setNameDraft]   = useState(layer.name);
  const [pickerAnchorEl, setPickerAnchorEl] = useState(null);
  const [dragOver,    setDragOver]    = useState(false);
  const nameInputRef  = useRef(null);

  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);

  const openPicker = (e) => setPickerAnchorEl(e.currentTarget);
  const closePicker = () => setPickerAnchorEl(null);

  const color   = rankColor(layerIndex);
  const members = hierarchy.members.filter((m) => m.layerId === layer.id);

  const handleDragOver = (e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    setDragOver(false);
    const nodeId = e.dataTransfer.getData(DRAG_TYPE);
    if (!nodeId) return;
    e.preventDefault();
    // addMember auto-moves the member if they're already in another rank
    onAddMember(layer.id, nodeId);
  };

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed) onUpdateLayer(layer.id, { name: trimmed });
    setEditingName(false);
  };

  return (
    <div
      className={`hpv-layer${dragOver ? ' hpv-layer-drag-over' : ''}`}
      style={{ '--layer-color': color }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* Layer header */}
      <div className="hpv-layer-header">
        <span className="hpv-layer-rank-badge" style={{ background: color }} title={`Rank ${layerIndex + 1}`}>
          {layerIndex + 1}
        </span>

        {editingName ? (
          <input
            ref={nameInputRef}
            className="hpv-layer-name-input"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
            onBlur={saveName}
          />
        ) : (
          <button
            className="hpv-layer-name"
            onClick={() => { setNameDraft(layer.name); setEditingName(true); }}
            title="Click to rename this rank"
          >
            {layer.name}
          </button>
        )}

        <span className="hpv-layer-member-count">
          {members.length > 0 ? `${members.length}` : ''}
        </span>

        <div className="hpv-layer-controls">
          <button className="hpv-ctrl" disabled={layerIndex === 0} onClick={onMoveUp} title="Move rank up">
            <ArrowUp size={11} weight="bold" />
          </button>
          <button className="hpv-ctrl" disabled={layerIndex === totalLayers - 1} onClick={onMoveDown} title="Move rank down">
            <ArrowDown size={11} weight="bold" />
          </button>
          <button className="hpv-ctrl hpv-ctrl-add" onClick={openPicker} title="Add member">
            <Plus size={11} weight="bold" />
          </button>
          <button className="hpv-ctrl hpv-ctrl-del" onClick={() => onRemoveLayer(layer.id)} title="Remove rank">
            <X size={11} weight="bold" />
          </button>
        </div>
      </div>

      {/* Member picker — portal so it escapes scroll clipping, positioned at clicked button */}
      {pickerAnchorEl && (
        <AddMemberPicker
          anchorEl={pickerAnchorEl}
          hierarchy={hierarchy}
          allNodes={allNodes}
          campaignId={campaignId}
          onAdd={(nodeId) => onAddMember(layer.id, nodeId)}
          onClose={closePicker}
        />
      )}

      {/* Members */}
      <div className="hpv-layer-members">
        {members.length === 0 ? (
          <button className="hpv-layer-empty-prompt" onClick={openPicker}>
            <Plus size={11} /> Add member to this rank
          </button>
        ) : (
          members.map((m) => (
            <MemberChip
              key={m.nodeId}
              member={m}
              node={nodeMap[m.nodeId]}
              layerName={layer.name}
              onUpdateTitle={(title) => onUpdateMember(m.nodeId, { title })}
              onRemove={() => onRemoveMember(m.nodeId)}
              onSelect={onSelectNode}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Hierarchy Panel ────────────────────────────────────────────────────────────

function HierarchyPanel({
  hierarchy, allNodes, campaignId, unrankedMembers,
  onUpdateHierarchy, onDeleteHierarchy,
  addLayer, updateLayer, removeLayer, moveLayer,
  addMember, updateMember, removeMember,
  onSelectNode, isOrgLinked,
}) {
  const [editingName,   setEditingName]  = useState(false);
  const [nameDraft,     setNameDraft]    = useState(hierarchy.name);
  const [newLayerName,  setNewLayerName] = useState('');
  const nameInputRef = useRef(null);

  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);

  const nodeMap = useMemo(() => {
    const m = {};
    for (const n of allNodes) m[n.id] = n;
    return m;
  }, [allNodes]);

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed) onUpdateHierarchy(hierarchy.id, { name: trimmed });
    setEditingName(false);
  };

  const handleAddLayer = () => {
    const name = newLayerName.trim() || `Rank ${hierarchy.layers.length + 1}`;
    addLayer(hierarchy.id, name);
    setNewLayerName('');
  };

  return (
    <div className="hpv-panel">
      {/* Panel header */}
      <div className="hpv-panel-header">
        {editingName ? (
          <input
            ref={nameInputRef}
            className="hpv-hierarchy-name-input"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
            onBlur={saveName}
          />
        ) : (
          <button
            className="hpv-hierarchy-name"
            onClick={() => { setNameDraft(hierarchy.name); setEditingName(true); }}
            title="Click to rename"
          >
            {hierarchy.name}
            <PencilSimple size={12} style={{ opacity: 0.5, marginLeft: 5 }} />
          </button>
        )}

        {isOrgLinked ? (
          <button
            className="hpv-delete-btn"
            onClick={() => { if (window.confirm('Clear all ranks and members? The organization on the map will remain.')) onDeleteHierarchy(hierarchy.id); }}
            title="Clear hierarchy data"
          >
            <Trash size={13} />
          </button>
        ) : (
          <button
            className="hpv-delete-btn"
            onClick={() => { if (window.confirm(`Delete hierarchy "${hierarchy.name}"?`)) onDeleteHierarchy(hierarchy.id); }}
            title="Delete this hierarchy"
          >
            <Trash size={13} />
          </button>
        )}
      </div>

      <div className="hpv-panel-intro">
        Rank 1 is the top (most senior). Click a rank name to rename it. Click a member to open their detail panel. Pencil icon sets an individual title.
      </div>

      {/* Layers */}
      <div className="hpv-layers">
        {hierarchy.layers.length === 0 ? (
          <div className="hpv-empty-layers">No ranks yet. Add a rank below.</div>
        ) : (
          hierarchy.layers.map((layer, i) => (
            <HierarchyLayer
              key={layer.id}
              layer={layer}
              layerIndex={i}
              totalLayers={hierarchy.layers.length}
              hierarchy={hierarchy}
              nodeMap={nodeMap}
              campaignId={campaignId}
              allNodes={allNodes}
              onUpdateLayer={(layerId, ch) => updateLayer(hierarchy.id, layerId, ch)}
              onRemoveLayer={(layerId) => removeLayer(hierarchy.id, layerId)}
              onMoveUp={() => moveLayer(hierarchy.id, layer.id, -1)}
              onMoveDown={() => moveLayer(hierarchy.id, layer.id, 1)}
              onAddMember={(layerId, nodeId) => addMember(hierarchy.id, layerId, nodeId)}
              onUpdateMember={(nodeId, ch) => updateMember(hierarchy.id, nodeId, ch)}
              onRemoveMember={(nodeId) => removeMember(hierarchy.id, nodeId)}
              onSelectNode={onSelectNode}
            />
          ))
        )}
      </div>

      {/* Unranked members (tag-associated but not yet placed in a rank) */}
      {unrankedMembers.length > 0 && (
        <div className="hpv-unranked-section">
          <div className="hpv-unranked-header">
            <Users size={11} />
            <span>Unranked Members</span>
            <span className="hpv-unranked-count">{unrankedMembers.length}</span>
            <span className="hpv-unranked-hint">— tagged with this organization, click Assign to place in a rank</span>
          </div>
          <div className="hpv-unranked-list">
            {unrankedMembers.map((node) => (
              <UnrankedMemberRow
                key={node.id}
                node={node}
                layers={hierarchy.layers}
                onAssign={(layerId, nodeId) => addMember(hierarchy.id, layerId, nodeId)}
                onSelect={onSelectNode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add layer row */}
      <div className="hpv-add-layer-row">
        <input
          className="hpv-add-layer-input"
          placeholder="New rank name…"
          value={newLayerName}
          onChange={(e) => setNewLayerName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddLayer()}
        />
        <button className="hpv-add-layer-btn" onClick={handleAddLayer}>
          <Plus size={13} weight="bold" /> Add Rank
        </button>
      </div>
    </div>
  );
}

// ── Org type config ────────────────────────────────────────────────────────────

const ORG_TYPES = [
  { type: 'faction',  label: 'Factions',  Icon: Shield, color: '#fb923c' },
  { type: 'religion', label: 'Religions', Icon: Star,   color: '#fbbf24' },
  { type: 'polity',   label: 'Polities',  Icon: Crown,  color: '#e879a8' },
];

function orgConfig(type) {
  return ORG_TYPES.find((o) => o.type === type) || { label: type, Icon: Users, color: '#94a3b8' };
}

// ── Main View ──────────────────────────────────────────────────────────────────

export default function HierarchyTreeView() {
  const campaignId          = useCampaignStore((s) => s.activeCampaignId);
  const allNodes            = useNodeStore((s) => s.nodes);
  const selectNode          = useNodeStore((s) => s.selectNode);
  const updateNodeFields    = useNodeStore((s) => s.updateNodeFields);
  const allTags             = useTagStore((s) => s.tags);

  const hierarchies         = useHierarchyStore((s) => s.hierarchies).filter((h) => h.campaignId === campaignId);
  const createHierarchy     = useHierarchyStore((s) => s.createHierarchy);
  const updateHierarchy     = useHierarchyStore((s) => s.updateHierarchy);
  const deleteHierarchy     = useHierarchyStore((s) => s.deleteHierarchy);
  const findOrCreateForNode = useHierarchyStore((s) => s.findOrCreateForNode);
  const addLayer            = useHierarchyStore((s) => s.addLayer);
  const updateLayer         = useHierarchyStore((s) => s.updateLayer);
  const removeLayer         = useHierarchyStore((s) => s.removeLayer);
  const moveLayer           = useHierarchyStore((s) => s.moveLayer);
  const addMember           = useHierarchyStore((s) => s.addMember);
  const updateMember        = useHierarchyStore((s) => s.updateMember);
  const removeMember        = useHierarchyStore((s) => s.removeMember);

  // Org nodes grouped by type
  const orgNodesByType = useMemo(() => {
    const byType = {};
    for (const cfg of ORG_TYPES) byType[cfg.type] = [];
    for (const n of allNodes) {
      if (n.campaignId === campaignId && byType[n.type]) {
        byType[n.type].push(n);
      }
    }
    for (const type of Object.keys(byType)) {
      byType[type].sort((a, b) => (a.fields?.name || '').localeCompare(b.fields?.name || ''));
    }
    return byType;
  }, [allNodes, campaignId]);

  const hasAnyOrgNodes = ORG_TYPES.some((cfg) => orgNodesByType[cfg.type]?.length > 0);

  // Custom (non-node-sourced) hierarchies
  const customHierarchies = useMemo(
    () => hierarchies.filter((h) => !h.sourceNodeId),
    [hierarchies]
  );

  const [activeId,  setActiveId]  = useState(null);
  const [newHName,  setNewHName]  = useState('');
  const [creating,  setCreating]  = useState(false);
  const createInputRef = useRef(null);

  useEffect(() => { if (creating) createInputRef.current?.focus(); }, [creating]);

  const activeHierarchy = useMemo(
    () => hierarchies.find((h) => h.id === activeId) || null,
    [hierarchies, activeId]
  );

  // Unranked members: NPCs in org.fields.members but not yet placed in any rank
  const unrankedMembers = useMemo(() => {
    if (!activeHierarchy?.sourceNodeId) return [];
    const assignedIds = new Set(activeHierarchy.members.map((m) => m.nodeId));
    return findTaggedNpcs(allNodes, campaignId, activeHierarchy.sourceNodeId, allTags).filter(
      (n) => !assignedIds.has(n.id)
    );
  }, [activeHierarchy, allNodes, campaignId, allTags]);

  // Select org node → find or create its hierarchy, auto-populate from tags on first open
  const selectOrgNode = useCallback((node) => {
    const name = node.fields?.name || orgConfig(node.type).label;
    const h = findOrCreateForNode(campaignId, node.id, name);

    // Auto-populate layer 1 from org.fields.members on first open
    if (h.members.length === 0 && h.layers.length > 0) {
      const firstLayerId = h.layers[0].id;
      const tagged = findTaggedNpcs(allNodes, campaignId, node.id, allTags);
      for (const npc of tagged) {
        addMember(h.id, firstLayerId, npc.id);
      }
    }

    setActiveId(h.id);
  }, [campaignId, findOrCreateForNode, allTags, allNodes, addMember]);

  const handleCreate = () => {
    const name = newHName.trim() || 'New Hierarchy';
    const h = createHierarchy(campaignId, name);
    setActiveId(h.id);
    setNewHName('');
    setCreating(false);
  };

  const handleDelete = (id) => {
    deleteHierarchy(id);
    setActiveId(null);
  };

  const isOrgActive = (node) => activeHierarchy?.sourceNodeId === node.id;

  const displayName = (h) => {
    if (h.sourceNodeId) {
      const node = allNodes.find((n) => n.id === h.sourceNodeId);
      return node?.fields?.name || h.name;
    }
    return h.name;
  };

  return (
    <div className="hpv-root">

      {/* ── Left sidebar ── */}
      <div className="hpv-sidebar">
        <div className="hpv-sidebar-header">
          <Users size={13} />
          <span>Hierarchies</span>
        </div>

        <div className="hpv-sidebar-list">

          {/* ── Org nodes grouped by type ── */}
          {ORG_TYPES.map(({ type, label, Icon, color }) => {
            const nodes = orgNodesByType[type] || [];
            if (nodes.length === 0) return null;
            return (
              <div key={type} className="hpv-type-section">
                <div className="hpv-type-section-header" style={{ '--section-color': color }}>
                  <Icon size={13} weight="fill" />
                  <span>{label}</span>
                </div>
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    className={`hpv-sidebar-item-plain${isOrgActive(node) ? ' active' : ''}`}
                    onClick={() => selectOrgNode(node)}
                  >
                    {node.fields?.name || label.slice(0, -1)}
                  </button>
                ))}
              </div>
            );
          })}

          {/* ── Custom hierarchies ── */}
          {customHierarchies.length > 0 && (
            <div className="hpv-type-section">
              <div className="hpv-type-section-header" style={{ '--section-color': 'var(--text-muted)' }}>
                <Users size={13} />
                <span>Custom</span>
              </div>
              {customHierarchies.map((h) => (
                <button
                  key={h.id}
                  className={`hpv-sidebar-item-plain${activeId === h.id ? ' active' : ''}`}
                  onClick={() => setActiveId(h.id)}
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!hasAnyOrgNodes && customHierarchies.length === 0 && !creating && (
            <div className="hpv-sidebar-empty">
              Add Faction, Religion, or Polity nodes to the map and they'll appear here automatically.
            </div>
          )}
        </div>

        {/* Create custom */}
        {creating ? (
          <div className="hpv-create-row">
            <input
              ref={createInputRef}
              className="hpv-create-input"
              placeholder="Hierarchy name…"
              value={newHName}
              onChange={(e) => setNewHName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
            />
            <button className="hpv-create-confirm" onClick={handleCreate}>
              <Check size={12} weight="bold" />
            </button>
            <button className="hpv-create-cancel" onClick={() => setCreating(false)}>
              <X size={12} weight="bold" />
            </button>
          </div>
        ) : (
          <button className="hpv-sidebar-new-btn" onClick={() => setCreating(true)}>
            <Plus size={13} weight="bold" /> New Custom Hierarchy
          </button>
        )}
      </div>

      {/* ── Main panel ── */}
      <div className="hpv-main">
        {!activeHierarchy ? (
          <div className="hpv-empty-state">
            <Users size={36} weight="thin" style={{ opacity: 0.25 }} />
            {hasAnyOrgNodes ? (
              <p>Select an organization from the left to view or edit its hierarchy.</p>
            ) : (
              <>
                <p>No organizations found.</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Faction, Religion, and Polity nodes on the map appear here automatically as hierarchies.
                </p>
              </>
            )}
          </div>
        ) : (
          <HierarchyPanel
            key={activeHierarchy.id}
            hierarchy={{ ...activeHierarchy, name: displayName(activeHierarchy) }}
            allNodes={allNodes}
            campaignId={campaignId}
            unrankedMembers={unrankedMembers}
            onUpdateHierarchy={updateHierarchy}
            onDeleteHierarchy={handleDelete}
            addLayer={addLayer}
            updateLayer={updateLayer}
            removeLayer={removeLayer}
            moveLayer={moveLayer}
            addMember={(hId, layerId, nodeId) => {
              addMember(hId, layerId, nodeId);
              // Keep org.fields.members in sync when a member is added via hierarchy view
              if (activeHierarchy.sourceNodeId) {
                const orgNode = allNodes.find((n) => n.id === activeHierarchy.sourceNodeId);
                if (orgNode) {
                  const cur = Array.isArray(orgNode.fields?.members) ? orgNode.fields.members : [];
                  if (!cur.includes(nodeId)) {
                    updateNodeFields(campaignId, orgNode.id, { members: [...cur, nodeId] });
                  }
                }
              }
            }}
            updateMember={updateMember}
            removeMember={removeMember}
            onSelectNode={selectNode}
            isOrgLinked={!!activeHierarchy.sourceNodeId}
          />
        )}
      </div>

    </div>
  );
}
