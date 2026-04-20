import { useState, useMemo, useCallback } from 'react';
import { X, Plus, MagnifyingGlass, Rows, LinkSimple, Users } from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import useSettingsStore from '../../stores/settingsStore';
import {
  NODE_TYPES, NESTING_RULES, canNestType,
  isAbstractType, getTagAssignmentField, getTagMembers,
} from '../../utils/nodeSchemas';
import { resolveIcon } from '../../utils/iconRegistry';
import { getTypeColor, getTypeLabel, getTypeIcon } from '../../utils/typeColors';

/**
 * Board columns come in two flavours:
 *
 *  { kind: 'entity', nodeId: string }
 *    Shows a specific node as the column header.
 *    - SPATIAL entities: body = spatially nested children (parentNodeId === nodeId)
 *      Dropping here → nestNode(child, nodeId)
 *    - ABSTRACT entities (faction, religion, polity, …): body = nodes that reference
 *      this entity via a tag field.
 *      Dropping here → assign tag field on the dragged node
 *
 *  { kind: 'pool', nodeType: string }
 *    Shows ALL nodes of that type as a draggable pool.
 *    Dropping a card here → unnestNode (remove from parent) for spatial;
 *    no-op for abstract pool targets (pools are drag-sources only).
 */

/* ─── Relationship chip ──────────────────────────────────────────── */
/**
 * Compact chip showing a tag-reference to another node.
 * Used on cards to show faction membership, religion, etc.
 */
function RelChip({ node, nodeTypeOverrides, customNodeTypes, onRemove }) {
  const color    = getTypeColor(node.type, nodeTypeOverrides, customNodeTypes);
  const iconName = getTypeIcon(node.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
  const Icon     = resolveIcon(iconName);
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 7px 2px 5px', borderRadius: 'var(--radius-pill)',
        border: `1px solid ${color}40`, background: `${color}12`,
        fontSize: 10, fontWeight: 600, color,
        lineHeight: 1.3, flexShrink: 0,
      }}
    >
      <Icon size={10} weight="fill" />
      {node.fields?.name || '—'}
      {onRemove && (
        <span
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ opacity: 0.5, cursor: 'pointer', marginLeft: 1, lineHeight: 1 }}
        >×</span>
      )}
    </span>
  );
}

/* ─── Column picker overlay ──────────────────────────────────────── */
function ColumnPicker({ mapNodes, boardColumns, onAdd, onClose, nodeTypeOverrides, customNodeTypes }) {
  const [tab, setTab]       = useState('entity');
  const [filter, setFilter] = useState('');

  const alreadyEntityIds = new Set(boardColumns.filter((c) => c.kind === 'entity').map((c) => c.nodeId));
  const alreadyPoolTypes = new Set(boardColumns.filter((c) => c.kind === 'pool').map((c) => c.nodeType));

  const allTypes = [
    ...Object.keys(NODE_TYPES),
    ...customNodeTypes.map((c) => c.id),
  ];

  const entityNodes = useMemo(() => {
    const q = filter.toLowerCase();
    return mapNodes
      .filter((n) => !alreadyEntityIds.has(n.id) && (!q || (n.fields?.name || '').toLowerCase().includes(q)))
      .sort((a, b) => (a.fields?.name || '').localeCompare(b.fields?.name || ''));
  }, [mapNodes, alreadyEntityIds, filter]);

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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, animation: 'fadeIn 150ms var(--ease)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-xl)', width: 440, maxHeight: '72vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', animation: 'modalIn 200ms var(--ease)', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: "'Cal Sans', sans-serif", fontSize: 18, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
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
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search…" autoFocus style={{ paddingLeft: 32 }} />
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 8px' }}>
          {tab === 'entity' && (
            <>
              {grouped.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {filter ? 'No matches' : 'All nodes already added'}
                </div>
              )}
              {grouped.map(([type, nodes]) => {
                const iconName = getTypeIcon(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
                const Icon     = resolveIcon(iconName);
                const color    = getTypeColor(type, nodeTypeOverrides, customNodeTypes);
                const label    = getTypeLabel(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
                const isAbstract = isAbstractType(type, customNodeTypes);
                return (
                  <div key={type}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 10px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {label}
                      {isAbstract && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 700 }}>
                          tag-based
                        </span>
                      )}
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
            </>
          )}

          {tab === 'pool' && (
            <>
              {poolTypes.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {filter ? 'No matches' : 'All type pools already added'}
                </div>
              )}
              {poolTypes.map((type) => {
                const iconName   = getTypeIcon(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
                const Icon       = resolveIcon(iconName);
                const color      = getTypeColor(type, nodeTypeOverrides, customNodeTypes);
                const label      = getTypeLabel(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
                const count      = mapNodes.filter((n) => n.type === type).length;
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
                    {isAbstract && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 700 }}>tag</span>}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-inset)', padding: '2px 7px', borderRadius: 'var(--radius-pill)' }}>{count}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── KanbanBoard ─────────────────────────────────────────────────── */
export default function KanbanBoard() {
  const campaignId  = useCampaignStore((s) => s.activeCampaignId);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const allNodes    = useNodeStore((s) => s.nodes);
  const selectNode  = useNodeStore((s) => s.selectNode);
  const nestNode    = useNodeStore((s) => s.nestNode);
  const unnestNode  = useNodeStore((s) => s.unnestNode);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];

  const [boardColumns, setBoardColumns] = useState([]);
  const [showPicker, setShowPicker]     = useState(false);
  const [dragState, setDragState]       = useState(null);

  const mapNodes = useMemo(
    () => allNodes.filter((n) => n.mapId === activeMapId),
    [allNodes, activeMapId]
  );

  const addColumn    = useCallback((colDef) => { setBoardColumns((prev) => [...prev, colDef]); setShowPicker(false); }, []);
  const removeColumn = useCallback((idx)   => setBoardColumns((prev) => prev.filter((_, i) => i !== idx)), []);

  /* ── Drag handlers ────────────────────────────────────────────────── */
  const handleDragStart = (nodeId, sourceKind, sourceRef) => setDragState({ nodeId, sourceKind, sourceRef });
  const handleDragEnd   = () => setDragState(null);

  const handleDrop = useCallback((targetCol) => {
    if (!dragState || !campaignId) return;
    const { nodeId } = dragState;
    const draggedNode = allNodes.find((n) => n.id === nodeId);
    if (!draggedNode) return;

    if (targetCol.kind === 'entity') {
      const parentNode = allNodes.find((n) => n.id === targetCol.nodeId);
      if (!parentNode || parentNode.id === draggedNode.id) return;

      const parentIsAbstract = isAbstractType(parentNode.type, customNodeTypes);

      if (parentIsAbstract) {
        // Tag assignment — find a tag field on the dragged node that accepts the parent's type
        const draggedSchema = NODE_TYPES[draggedNode.type];
        const field = getTagAssignmentField(draggedSchema, parentNode.type);
        if (!field) return; // no compatible field
        const current = draggedNode.fields?.[field.key] || [];
        if (current.includes(parentNode.id)) return; // already assigned
        updateNodeFields(campaignId, nodeId, { [field.key]: [...current, parentNode.id] });
      } else {
        // Spatial nesting — enforce rules
        if (!canNestType(draggedNode.type, parentNode.type, customNodeTypes)) return;
        if (draggedNode.parentNodeId === parentNode.id) return;
        nestNode(campaignId, nodeId, parentNode.id);
      }

    } else if (targetCol.kind === 'pool') {
      // Dropping into a pool = unnest (spatial only)
      if (draggedNode.parentNodeId) {
        unnestNode(campaignId, nodeId, draggedNode.x ?? 0, draggedNode.y ?? 0);
      }
    }
    setDragState(null);
  }, [dragState, allNodes, campaignId, nestNode, unnestNode, updateNodeFields, customNodeTypes]);

  /* ── Relationship chip removal ────────────────────────────────────── */
  const handleRemoveTag = useCallback((nodeId, fieldKey, refId) => {
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const current = node.fields?.[fieldKey] || [];
    updateNodeFields(campaignId, nodeId, { [fieldKey]: current.filter((id) => id !== refId) });
  }, [allNodes, campaignId, updateNodeFields]);

  /* ── Card rendering ───────────────────────────────────────────────── */
  const renderCard = (memberNode, entityNodeId = null, fieldKey = null) => {
    const mColor    = getTypeColor(memberNode.type, nodeTypeOverrides, customNodeTypes);
    const mIconName = getTypeIcon(memberNode.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
    const MIcon     = resolveIcon(mIconName);

    // Relationship chips: fields with filterTypes on this node (excluding the hosting column's type)
    const schema = NODE_TYPES[memberNode.type];
    const relChips = [];
    if (schema?.fields) {
      for (const field of schema.fields) {
        if (field.type !== 'tags' || !field.filterTypes?.length) continue;
        const refs = memberNode.fields?.[field.key];
        if (!Array.isArray(refs) || refs.length === 0) continue;
        for (const refId of refs) {
          const refNode = allNodes.find((n) => n.id === refId);
          if (!refNode) continue;
          // Don't show a chip for the column we're already in
          if (entityNodeId && refId === entityNodeId) continue;
          relChips.push({ refNode, fieldKey: field.key });
        }
      }
    }

    return (
      <div
        key={memberNode.id}
        className={`kanban-card ${dragState?.nodeId === memberNode.id ? 'dragging' : ''}`}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; handleDragStart(memberNode.id, 'entity', null); }}
        onDragEnd={handleDragEnd}
        onClick={() => selectNode(memberNode.id)}
        title={memberNode.fields?.name || 'Unnamed'}
        style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
      >
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="mini-icon" style={{ background: `${mColor}18`, color: mColor, flexShrink: 0 }}>
            <MIcon size={14} weight="duotone" />
          </div>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500 }}>
            {memberNode.fields?.name || 'Unnamed'}
          </span>
          {/* Remove from abstract column button */}
          {entityNodeId && fieldKey && (
            <button
              className="kanban-card-remove"
              title="Remove from this column"
              onClick={(e) => { e.stopPropagation(); handleRemoveTag(memberNode.id, fieldKey, entityNodeId); }}
              style={{ opacity: 0.5, flexShrink: 0 }}
            >
              <X size={11} weight="bold" />
            </button>
          )}
        </div>
        {/* Relationship chiplets */}
        {relChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 2 }}>
            {relChips.map(({ refNode, fieldKey: fk }) => (
              <RelChip
                key={`${fk}:${refNode.id}`}
                node={refNode}
                nodeTypeOverrides={nodeTypeOverrides}
                customNodeTypes={customNodeTypes}
                onRemove={() => handleRemoveTag(memberNode.id, fk, refNode.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ── Empty state ──────────────────────────────────────────────────── */
  if (boardColumns.length === 0 && !showPicker) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-muted)', position: 'relative', zIndex: 1 }}>
        <Rows size={40} opacity={0.3} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Board is empty</div>
          <div style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>
            Add a specific node (e.g. "The Iron Wolves faction") or a type pool (e.g. "All NPCs"). Drag nodes into spatial columns to nest them, or into abstract columns (faction, religion, polity) to assign the relationship.
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
          if (col.kind === 'entity') {
            const entityNode = mapNodes.find((n) => n.id === col.nodeId);
            if (!entityNode) return null;
            const color      = getTypeColor(entityNode.type, nodeTypeOverrides, customNodeTypes);
            const iconName   = getTypeIcon(entityNode.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const Icon       = resolveIcon(iconName);
            const typeLabel  = getTypeLabel(entityNode.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const isAbstract = isAbstractType(entityNode.type, customNodeTypes);

            // Members: for abstract types, nodes that tag-reference this entity
            // For spatial types, nodes that are spatially nested inside it
            let members, memberFieldKey;
            if (isAbstract) {
              const tagMembers = getTagMembers(entityNode.id, entityNode.type, mapNodes, NODE_TYPES, customNodeTypes);
              members = tagMembers.map((r) => r.node);
              // All members will have the same fieldKey pattern, keep a default
              memberFieldKey = tagMembers[0]?.fieldKey || null;
            } else {
              members = mapNodes.filter((n) => n.parentNodeId === entityNode.id);
              memberFieldKey = null;
            }

            // Drop acceptance check
            const canAcceptDrop = (dn) => {
              if (!dn) return false;
              if (isAbstract) {
                const schema = NODE_TYPES[dn.type];
                return !!getTagAssignmentField(schema, entityNode.type);
              }
              return canNestType(dn.type, entityNode.type, customNodeTypes);
            };

            // Valid-types hint
            const validHint = isAbstract
              ? Object.entries(NODE_TYPES)
                  .filter(([, s]) => s.fields?.some((f) => f.type === 'tags' && f.filterTypes?.includes(entityNode.type)))
                  .map(([k]) => k)
              : NESTING_RULES[entityNode.type] || null;

            return (
              <div
                key={`entity-${col.nodeId}-${colIdx}`}
                className="kanban-column"
                style={isAbstract ? { borderColor: `${color}40` } : undefined}
                onDragOver={(e) => {
                  if (!dragState) return;
                  const dn = allNodes.find((n) => n.id === dragState.nodeId);
                  if (canAcceptDrop(dn)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
                }}
                onDrop={() => handleDrop(col)}
              >
                {/* Column header */}
                <div className="kanban-column-header" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div className="mini-icon" style={{ background: `${color}18`, color, flexShrink: 0 }}>
                      <Icon size={14} weight="duotone" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {entityNode.fields?.name || 'Unnamed'}
                      </div>
                      <div style={{ fontSize: 10, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {typeLabel}
                        {isAbstract && <LinkSimple size={9} weight="bold" />}
                      </div>
                    </div>
                    <span className="count">{members.length}</span>
                  </div>
                  <button className="kanban-card-remove" onClick={() => removeColumn(colIdx)} title="Remove column" style={{ flexShrink: 0 }}>
                    <X size={13} weight="bold" />
                  </button>
                </div>

                {/* Drop hint */}
                {validHint && validHint.length > 0 && (
                  <div style={{ padding: '4px 12px 0', fontSize: 10, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    {isAbstract ? <LinkSimple size={9} /> : null}
                    {isAbstract ? 'Assigns:' : 'Accepts:'}
                    {validHint.map((t, i) => (
                      <span key={t} style={{ color: `var(--node-${t}, var(--text-muted))`, fontWeight: 600 }}>
                        {getTypeLabel(t, NODE_TYPES, nodeTypeOverrides, customNodeTypes)}{i < validHint.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Cards */}
                <div className="kanban-column-body">
                  {members.length === 0 && (
                    <div className="kanban-unassigned" style={{ padding: '12px 8px', fontSize: 12 }}>
                      {isAbstract ? 'Drag nodes here to assign' : 'Drop here to nest'}
                    </div>
                  )}
                  {members.map((m) => {
                    // For abstract columns, find this specific member's fieldKey
                    let fk = memberFieldKey;
                    if (isAbstract) {
                      const schema = NODE_TYPES[m.type];
                      const field = getTagAssignmentField(schema, entityNode.type);
                      fk = field?.key || null;
                    }
                    return renderCard(m, entityNode.id, fk);
                  })}
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
            const members   = mapNodes.filter((n) => n.type === nodeType);

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
                    <div className="mini-icon" style={{ background: `${color}18`, color, flexShrink: 0 }}>
                      <Icon size={14} weight="duotone" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        All {typeLabel}s
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                        Source pool — drag into entity columns
                      </div>
                    </div>
                    <span className="count">{members.length}</span>
                  </div>
                  <button className="kanban-card-remove" onClick={() => removeColumn(colIdx)} title="Remove column" style={{ flexShrink: 0 }}>
                    <X size={13} weight="bold" />
                  </button>
                </div>
                <div className="kanban-column-body">
                  {members.length === 0 && (
                    <div className="kanban-unassigned" style={{ padding: '12px 8px', fontSize: 12 }}>
                      No {typeLabel}s on this map
                    </div>
                  )}
                  {members.map((m) => renderCard(m))}
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* Add column */}
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
          mapNodes={mapNodes}
          boardColumns={boardColumns}
          onAdd={addColumn}
          onClose={() => setShowPicker(false)}
          nodeTypeOverrides={nodeTypeOverrides}
          customNodeTypes={customNodeTypes}
        />
      )}
    </div>
  );
}
