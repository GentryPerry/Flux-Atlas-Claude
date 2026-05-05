import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, MagnifyingGlass, Rows, LinkSimple, Trash, ArrowSquareOut, Tray, ArrowRight } from '@phosphor-icons/react';

// Module-level — persists board column layout across navigation within a session
let _sessionColumns = [];
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import useMapStore from '../../stores/mapStore';
import useSettingsStore from '../../stores/settingsStore';
import {
  NODE_TYPES, NESTING_RULES, canNestType,
  isAbstractType,
} from '../../utils/nodeSchemas';
import { resolveIcon } from '../../utils/iconRegistry';
import { getTypeColor, getTypeLabel, getTypeIcon } from '../../utils/typeColors';

// ── Relationship chip ─────────────────────────────────────────────────────────

function RelChip({ node, nodeTypeOverrides, customNodeTypes, onRemove }) {
  const color    = getTypeColor(node.type, nodeTypeOverrides, customNodeTypes);
  const iconName = getTypeIcon(node.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
  const Icon     = resolveIcon(iconName);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px 2px 5px', borderRadius: 'var(--radius-pill)',
      border: `1px solid ${color}40`, background: `${color}12`,
      fontSize: 10, fontWeight: 600, color, lineHeight: 1.3, flexShrink: 0,
    }}>
      <Icon size={10} weight="fill" />
      {node.fields?.name || '—'}
      {onRemove && (
        <span
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ opacity: 0.5, cursor: 'pointer', marginLeft: 1, lineHeight: 1 }}
        >x</span>
      )}
    </span>
  );
}

// ── Column picker overlay ─────────────────────────────────────────────────────

function ColumnPicker({ campaignNodes, boardColumns, onAdd, onClose, nodeTypeOverrides, customNodeTypes }) {
  const [tab, setTab]       = useState('entity');
  const [filter, setFilter] = useState('');

  const alreadyEntityIds = new Set(boardColumns.filter((c) => c.kind === 'entity').map((c) => c.nodeId));
  const alreadyPoolTypes = new Set(boardColumns.filter((c) => c.kind === 'pool').map((c) => c.nodeType));
  const hasStaging       = boardColumns.some((c) => c.kind === 'staging');

  const allTypes = [...Object.keys(NODE_TYPES), ...customNodeTypes.map((c) => c.id)];

  const entityNodes = useMemo(() => {
    const q = filter.toLowerCase();
    return campaignNodes
      .filter((n) => !alreadyEntityIds.has(n.id) && (!q || (n.fields?.name || '').toLowerCase().includes(q)))
      .sort((a, b) => (a.fields?.name || '').localeCompare(b.fields?.name || ''));
  }, [campaignNodes, alreadyEntityIds, filter]);

  const poolTypes = useMemo(() => {
    const q = filter.toLowerCase();
    return allTypes.filter((t) => {
      if (alreadyPoolTypes.has(t)) return false;
      const label = getTypeLabel(t, NODE_TYPES, nodeTypeOverrides, customNodeTypes).toLowerCase();
      return !q || label.includes(q);
    });
  }, [allTypes, alreadyPoolTypes, filter, nodeTypeOverrides, customNodeTypes]);

  const grouped = useMemo(() => {
    const map = {};
    for (const n of entityNodes) {
      if (!map[n.type]) map[n.type] = [];
      map[n.type].push(n);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [entityNodes]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-xl)', width: 440, maxHeight: '72vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: "sans-serif", fontSize: 18, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Add Column
            </span>
            <button className="btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {[['entity', 'Specific Node'], ['pool', 'Type Pool']].map(([t, label]) => (
              <button
                key={t}
                onClick={() => { setTab(t); setFilter(''); }}
                style={{ flex: 1, padding: '6px 0', borderRadius: 'var(--radius)', border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderColor: tab === t ? 'var(--accent)' : 'var(--border)', background: tab === t ? 'var(--accent-dim)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-secondary)' }}
              >{label}</button>
            ))}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <MagnifyingGlass size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search..." autoFocus style={{ paddingLeft: 32 }} />
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
          {!hasStaging && (
            <button
              onClick={() => onAdd({ kind: 'staging' })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 'var(--radius)', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left', marginBottom: 4 }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 28, height: 28, borderRadius: 'var(--radius)', background: 'rgba(136,144,160,0.12)', color: '#8890a0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Tray size={15} />
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Staging</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Off-map nodes waiting to be placed</div>
              </div>
            </button>
          )}

          {tab === 'entity' && grouped.map(([type, nodes]) => {
            const iconName   = getTypeIcon(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const Icon       = resolveIcon(iconName);
            const color      = getTypeColor(type, nodeTypeOverrides, customNodeTypes);
            const label      = getTypeLabel(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const isAbstract = isAbstractType(type, customNodeTypes);
            return (
              <div key={type}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 10px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {label}
                  {isAbstract && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 700 }}>members</span>}
                </div>
                {nodes.map((n) => (
                  <button key={n.id} onClick={() => onAdd({ kind: 'entity', nodeId: n.id })}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 'var(--radius)', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 'var(--radius)', background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} weight="duotone" />
                    </div>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.fields?.name || 'Unnamed'}</span>
                  </button>
                ))}
              </div>
            );
          })}

          {tab === 'entity' && grouped.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {filter ? 'No matches' : 'All nodes already added'}
            </div>
          )}

          {tab === 'pool' && poolTypes.map((type) => {
            const iconName   = getTypeIcon(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const Icon       = resolveIcon(iconName);
            const color      = getTypeColor(type, nodeTypeOverrides, customNodeTypes);
            const label      = getTypeLabel(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const count      = campaignNodes.filter((n) => n.type === type).length;
            const isAbstract = isAbstractType(type, customNodeTypes);
            return (
              <button key={type} onClick={() => onAdd({ kind: 'pool', nodeType: type })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 'var(--radius)', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 28, height: 28, borderRadius: 'var(--radius)', background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} weight="duotone" />
                </div>
                <span style={{ flex: 1 }}>All {label}s</span>
                {isAbstract && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 700 }}>members</span>}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-inset)', padding: '2px 7px', borderRadius: 'var(--radius-pill)' }}>{count}</span>
              </button>
            );
          })}

          {tab === 'pool' && poolTypes.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {filter ? 'No matches' : 'All type pools already added'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sort selector ─────────────────────────────────────────────────────────────

function SortSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={onChange}
      title="Sort column"
      style={{
        fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '2px 4px', cursor: 'pointer',
        outline: 'none', maxWidth: 76, flexShrink: 0,
      }}
    >
      <option value="default">Default</option>
      <option value="az">A → Z</option>
      <option value="created_asc">Oldest</option>
      <option value="created_desc">Newest</option>
      <option value="updated_asc">Least edited</option>
      <option value="updated_desc">Most edited</option>
    </select>
  );
}

// ── KanbanBoard ───────────────────────────────────────────────────────────────

export default function KanbanBoard() {
  const campaignId         = useCampaignStore((s) => s.activeCampaignId);
  const allNodes           = useNodeStore((s) => s.nodes);
  const selectNode         = useNodeStore((s) => s.selectNode);
  const deleteNode         = useNodeStore((s) => s.deleteNode);
  const nestNode           = useNodeStore((s) => s.nestNode);
  const unnestNode         = useNodeStore((s) => s.unnestNode);
  const updateNode         = useNodeStore((s) => s.updateNode);
  const updateNodeFields   = useNodeStore((s) => s.updateNodeFields);
  const nodeTypeOverrides  = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes    = useSettingsStore((s) => s.customNodeTypes)   || [];

  const [boardColumns, setBoardColumnsRaw] = useState(_sessionColumns);
  const [showPicker, setShowPicker]        = useState(false);
  const [dragState, setDragState]          = useState(null);
  const [contextMenu, setContextMenu]      = useState(null); // { nodeId, x, y }

  // Keep module-level cache in sync so columns survive unmount/remount
  const setBoardColumns = useCallback((updater) => {
    setBoardColumnsRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      _sessionColumns = next;
      return next;
    });
  }, []);

  // Close context menu on outside click
  const menuRef = useRef(null);
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);
  const [columnSorts, setColumnSorts]     = useState({});

  // Stable key for a column's sort state
  const colSortKey = (col) =>
    col.kind === 'staging' ? 'staging'
    : col.kind === 'entity' ? `entity:${col.nodeId}`
    : `pool:${col.nodeType}`;

  const getColSort = (col) => columnSorts[colSortKey(col)] || 'default';
  const setColSort = (col, sort) =>
    setColumnSorts((prev) => ({ ...prev, [colSortKey(col)]: sort }));

  const sortMembers = (members, sort) => {
    if (!sort || sort === 'default') return members;
    const arr = [...members];
    switch (sort) {
      case 'az':
        return arr.sort((a, b) => (a.fields?.name || '').localeCompare(b.fields?.name || ''));
      case 'created_asc':
        return arr.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      case 'created_desc':
        return arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      case 'updated_asc':
        return arr.sort((a, b) =>
          new Date(a.updatedAt || a.createdAt || 0) - new Date(b.updatedAt || b.createdAt || 0));
      case 'updated_desc':
        return arr.sort((a, b) =>
          new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      default:
        return members;
    }
  };

  const campaignNodes = useMemo(
    () => allNodes.filter((n) => n.campaignId === campaignId),
    [allNodes, campaignId]
  );

  const addColumn    = useCallback((colDef) => { setBoardColumns((prev) => [...prev, colDef]); setShowPicker(false); }, []);
  const removeColumn = useCallback((idx)    => setBoardColumns((prev) => prev.filter((_, i) => i !== idx)), []);

  const handleDragStart = (nodeId) => setDragState({ nodeId });
  const handleDragEnd   = () => setDragState(null);

  const handleDrop = useCallback((targetCol) => {
    if (!dragState || !campaignId) return;
    const { nodeId } = dragState;
    const draggedNode = allNodes.find((n) => n.id === nodeId);
    if (!draggedNode) return;

    if (targetCol.kind === 'staging') {
      updateNode(campaignId, nodeId, { mapId: '__staging__' });
      setDragState(null);
      return;
    }

    if (targetCol.kind === 'entity') {
      const orgNode = allNodes.find((n) => n.id === targetCol.nodeId);
      if (!orgNode || orgNode.id === draggedNode.id) return;
      const orgIsAbstract = isAbstractType(orgNode.type, customNodeTypes);
      if (orgIsAbstract) {
        const orgSchema    = NODE_TYPES[orgNode.type];
        const membersField = orgSchema?.fields?.find((f) => f.key === 'members' && f.type === 'noderefs');
        if (!membersField) return;
        const rawCurrent = orgNode.fields?.members;
        const current = Array.isArray(rawCurrent) ? rawCurrent : [];
        if (current.includes(nodeId)) return;
        updateNodeFields(campaignId, orgNode.id, { members: [...current, nodeId] });
      } else {
        if (!canNestType(draggedNode.type, orgNode.type, customNodeTypes)) return;
        if (draggedNode.parentNodeId === orgNode.id) return;
        nestNode(campaignId, nodeId, orgNode.id);
      }
    } else if (targetCol.kind === 'pool') {
      if (draggedNode.parentNodeId) {
        unnestNode(campaignId, nodeId, draggedNode.x ?? 0, draggedNode.y ?? 0);
      }
    }
    setDragState(null);
  }, [dragState, allNodes, campaignId, updateNode, nestNode, unnestNode, updateNodeFields, customNodeTypes]);

  const handleRemoveMember = useCallback((orgNodeId, memberNodeId) => {
    const orgNode = allNodes.find((n) => n.id === orgNodeId);
    if (!orgNode) return;
    const rawCurrent = orgNode.fields?.members;
    const current = Array.isArray(rawCurrent) ? rawCurrent : [];
    updateNodeFields(campaignId, orgNodeId, { members: current.filter((id) => id !== memberNodeId) });
  }, [allNodes, campaignId, updateNodeFields]);

  const handleRemoveTag = useCallback((nodeId, fieldKey, refId) => {
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const current = node.fields?.[fieldKey] || [];
    updateNodeFields(campaignId, nodeId, { [fieldKey]: current.filter((id) => id !== refId) });
  }, [allNodes, campaignId, updateNodeFields]);

  const handleRestoreToMap = useCallback((nodeId) => {
    const activeMapId = useMapStore.getState().activeMapId;
    const x = 200 + Math.random() * 400;
    const y = 200 + Math.random() * 300;
    updateNode(campaignId, nodeId, { mapId: activeMapId, x, y });
  }, [campaignId, updateNode]);

  const renderCard = (memberNode, orgNodeId = null, onRemove = null) => {
    const mColor    = getTypeColor(memberNode.type, nodeTypeOverrides, customNodeTypes);
    const mIconName = getTypeIcon(memberNode.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
    const MIcon     = resolveIcon(mIconName);
    const schema    = NODE_TYPES[memberNode.type];
    const relChips  = [];
    if (schema?.fields) {
      for (const field of schema.fields) {
        if (field.type !== 'tags' || !field.filterTypes?.length) continue;
        const refs = memberNode.fields?.[field.key];
        if (!Array.isArray(refs) || refs.length === 0) continue;
        for (const refId of refs) {
          const refNode = allNodes.find((n) => n.id === refId);
          if (!refNode || (orgNodeId && refId === orgNodeId)) continue;
          relChips.push({ refNode, fieldKey: field.key });
        }
      }
    }
    return (
      <div
        key={memberNode.id}
        className={`kanban-card ${dragState?.nodeId === memberNode.id ? 'dragging' : ''}`}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; handleDragStart(memberNode.id); }}
        onDragEnd={handleDragEnd}
        onClick={() => selectNode(memberNode.id)}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ nodeId: memberNode.id, x: e.clientX, y: e.clientY, onRemove }); }}
        style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="mini-icon" style={{ background: `${mColor}18`, color: mColor, flexShrink: 0 }}>
            <MIcon size={14} weight="duotone" />
          </div>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500 }}>
            {memberNode.fields?.name || 'Unnamed'}
          </span>
          {memberNode.mapId === '__staging__' && (
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>stg</span>
          )}
          {onRemove && (
            <button className="kanban-card-remove" title="Remove" onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ opacity: 0.5, flexShrink: 0 }}>
              <X size={11} weight="bold" />
            </button>
          )}
        </div>
        {relChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 2 }}>
            {relChips.map(({ refNode, fieldKey: fk }) => (
              <RelChip key={`${fk}:${refNode.id}`} node={refNode} nodeTypeOverrides={nodeTypeOverrides} customNodeTypes={customNodeTypes} onRemove={() => handleRemoveTag(memberNode.id, fk, refNode.id)} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (boardColumns.length === 0 && !showPicker) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-muted)', position: 'relative', zIndex: 1 }}>
        <Rows size={40} opacity={0.3} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Board is empty</div>
          <div style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.5, color: 'var(--text-muted)' }}>
            Add a specific node or a type pool as a column. Drag cards to assign membership or nesting. Add a Staging column to track off-map nodes.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowPicker(true)} style={{ gap: 6 }}>
          <Plus size={16} /> Add column
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <div className="kanban-view">
        {boardColumns.map((col, colIdx) => {

          if (col.kind === 'staging') {
            const stagedNodes = sortMembers(campaignNodes.filter((n) => n.mapId === '__staging__'), getColSort(col));
            return (
              <div
                key={`staging-${colIdx}`}
                className="kanban-column"
                style={{ borderStyle: 'dashed', borderColor: 'rgba(136,144,160,0.4)' }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={() => handleDrop(col)}
              >
                <div className="kanban-column-header" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div className="mini-icon" style={{ background: 'rgba(136,144,160,0.12)', color: '#8890a0', flexShrink: 0 }}>
                      <Tray size={14} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Staging</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>Off-map nodes</div>
                    </div>
                    <span className="count">{stagedNodes.length}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <SortSelect value={getColSort(col)} onChange={(e) => { e.stopPropagation(); setColSort(col, e.target.value); }} />
                    <button className="kanban-card-remove" onClick={() => removeColumn(colIdx)} title="Remove column"><X size={13} weight="bold" /></button>
                  </div>
                </div>
                <div className="kanban-column-body">
                  {stagedNodes.length === 0 ? (
                    <div className="kanban-unassigned" style={{ padding: '12px 8px', fontSize: 12 }}>Drag nodes here or right-click a map node and choose Remove from Map</div>
                  ) : stagedNodes.map((node) => {
                    const color    = getTypeColor(node.type, nodeTypeOverrides, customNodeTypes);
                    const iconName = getTypeIcon(node.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
                    const Icon     = resolveIcon(iconName);
                    const isHov    = hoveredCardId === node.id;
                    return (
                      <div
                        key={node.id}
                        className={`kanban-card ${dragState?.nodeId === node.id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; handleDragStart(node.id); }}
                        onDragEnd={handleDragEnd}
                        onMouseEnter={() => setHoveredCardId(node.id)}
                        onMouseLeave={() => setHoveredCardId(null)}
                        style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, position: 'relative' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="mini-icon" style={{ background: `${color}18`, color, flexShrink: 0 }}><Icon size={14} weight="duotone" /></div>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500 }}>{node.fields?.name || 'Unnamed'}</span>
                        </div>
                        {isHov && (
                          <div style={{ display: 'flex', gap: 4, paddingTop: 2, borderTop: '1px solid var(--border)', marginTop: 2 }}>
                            <button onClick={(e) => { e.stopPropagation(); selectNode(node.id); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '3px 6px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                              <ArrowSquareOut size={11} /> Open
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleRestoreToMap(node.id); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '3px 6px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--accent)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                              <ArrowRight size={11} /> To Map
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this node?')) deleteNode(campaignId, node.id); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '3px 6px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--danger, #ef4444)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                              <Trash size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (col.kind === 'entity') {
            const entityNode = campaignNodes.find((n) => n.id === col.nodeId);
            if (!entityNode) return null;
            const color      = getTypeColor(entityNode.type, nodeTypeOverrides, customNodeTypes);
            const iconName   = getTypeIcon(entityNode.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const Icon       = resolveIcon(iconName);
            const typeLabel  = getTypeLabel(entityNode.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const isAbstract = isAbstractType(entityNode.type, customNodeTypes);
            let members;
            if (isAbstract) {
              const rawMemberIds = entityNode.fields?.members;
              const memberIds = Array.isArray(rawMemberIds) ? rawMemberIds : [];
              members = memberIds.map((id) => allNodes.find((n) => n.id === id)).filter(Boolean);
            } else {
              members = campaignNodes.filter((n) => n.parentNodeId === entityNode.id);
            }
            members = sortMembers(members, getColSort(col));
            const canAcceptDrop = (dn) => {
              if (!dn) return false;
              if (isAbstract) {
                const orgSchema    = NODE_TYPES[entityNode.type];
                const membersField = orgSchema?.fields?.find((f) => f.key === 'members' && f.type === 'noderefs');
                if (!membersField) return false;
                const rawMIds = entityNode.fields?.members;
                return !(Array.isArray(rawMIds) ? rawMIds : []).includes(dn.id);
              }
              return canNestType(dn.type, entityNode.type, customNodeTypes);
            };
            const validHint = isAbstract
              ? (NODE_TYPES[entityNode.type]?.fields?.find((f) => f.key === 'members' && f.type === 'noderefs')?.filterTypes || [])
              : NESTING_RULES[entityNode.type] || null;
            return (
              <div
                key={`entity-${col.nodeId}-${colIdx}`}
                className="kanban-column"
                style={isAbstract ? { borderColor: `${color}40` } : undefined}
                onDragOver={(e) => { if (!dragState) return; const dn = allNodes.find((n) => n.id === dragState.nodeId); if (canAcceptDrop(dn)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                onDrop={() => handleDrop(col)}
              >
                <div className="kanban-column-header" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div className="mini-icon" style={{ background: `${color}18`, color, flexShrink: 0 }}><Icon size={14} weight="duotone" /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{entityNode.fields?.name || 'Unnamed'}</div>
                      <div style={{ fontSize: 10, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {typeLabel}{isAbstract && <LinkSimple size={9} weight="bold" />}
                      </div>
                    </div>
                    <span className="count">{members.length}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <SortSelect value={getColSort(col)} onChange={(e) => { e.stopPropagation(); setColSort(col, e.target.value); }} />
                    <button className="kanban-card-remove" onClick={() => removeColumn(colIdx)} title="Remove column"><X size={13} weight="bold" /></button>
                  </div>
                </div>
                {validHint && validHint.length > 0 && (
                  <div style={{ padding: '4px 12px 0', fontSize: 10, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    {isAbstract ? <LinkSimple size={9} /> : null}
                    {isAbstract ? 'Accepts:' : 'Nests:'}
                    {validHint.map((t, i) => (
                      <span key={t} style={{ color: `var(--node-${t}, var(--text-muted))`, fontWeight: 600 }}>
                        {getTypeLabel(t, NODE_TYPES, nodeTypeOverrides, customNodeTypes)}{i < validHint.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                )}
                <div className="kanban-column-body">
                  {members.length === 0 && <div className="kanban-unassigned" style={{ padding: '12px 8px', fontSize: 12 }}>{isAbstract ? 'Drag nodes here to add members' : 'Drop here to nest'}</div>}
                  {members.map((m) => renderCard(m, entityNode.id, isAbstract ? () => handleRemoveMember(entityNode.id, m.id) : null))}
                </div>
              </div>
            );
          }

          if (col.kind === 'pool') {
            const { nodeType } = col;
            const color     = getTypeColor(nodeType, nodeTypeOverrides, customNodeTypes);
            const iconName  = getTypeIcon(nodeType, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const Icon      = resolveIcon(iconName);
            const typeLabel = getTypeLabel(nodeType, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const members   = sortMembers(campaignNodes.filter((n) => n.type === nodeType), getColSort(col));
            return (
              <div
                key={`pool-${nodeType}-${colIdx}`}
                className="kanban-column"
                style={{ borderStyle: 'dashed' }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={() => handleDrop(col)}
              >
                <div className="kanban-column-header" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div className="mini-icon" style={{ background: `${color}18`, color, flexShrink: 0 }}><Icon size={14} weight="duotone" /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>All {typeLabel}s</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>Source pool</div>
                    </div>
                    <span className="count">{members.length}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <SortSelect value={getColSort(col)} onChange={(e) => { e.stopPropagation(); setColSort(col, e.target.value); }} />
                    <button className="kanban-card-remove" onClick={() => removeColumn(colIdx)} title="Remove column"><X size={13} weight="bold" /></button>
                  </div>
                </div>
                <div className="kanban-column-body">
                  {members.length === 0 && <div className="kanban-unassigned" style={{ padding: '12px 8px', fontSize: 12 }}>No {typeLabel}s in this campaign</div>}
                  {members.map((m) => renderCard(m))}
                </div>
              </div>
            );
          }

          return null;
        })}

        <div
          onClick={() => setShowPicker(true)}
          style={{ minWidth: 180, width: 180, border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, flexShrink: 0, transition: 'color var(--transition), border-color var(--transition)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
        >
          <Plus size={22} />
          <span>Add column</span>
        </div>
      </div>

      {showPicker && (
        <ColumnPicker
          campaignNodes={campaignNodes}
          boardColumns={boardColumns}
          onAdd={addColumn}
          onClose={() => setShowPicker(false)}
          nodeTypeOverrides={nodeTypeOverrides}
          customNodeTypes={customNodeTypes}
        />
      )}

      {/* Right-click context menu — rendered in a portal so CSS transforms don't offset it */}
      {contextMenu && (() => {
        const ctxNode = allNodes.find((n) => n.id === contextMenu.nodeId);
        if (!ctxNode) return null;
        return createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 999,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-lg)',
              minWidth: 160,
              overflow: 'hidden',
              animation: 'fadeIn 100ms var(--ease)',
            }}
          >
            <button
              onClick={() => { selectNode(contextMenu.nodeId); setContextMenu(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <ArrowSquareOut size={14} /> Open Details
            </button>
            {contextMenu.onRemove && (
              <button
                onClick={() => { contextMenu.onRemove(); setContextMenu(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <X size={14} /> Remove from Column
              </button>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
            <button
              onClick={() => {
                setContextMenu(null);
                if (confirm(`Delete "${ctxNode.fields?.name || 'this node'}"? This cannot be undone.`)) {
                  deleteNode(campaignId, contextMenu.nodeId);
                }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Trash size={14} /> Delete Node
            </button>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
