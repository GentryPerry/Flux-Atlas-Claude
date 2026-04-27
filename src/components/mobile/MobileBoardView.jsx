import { useState, useMemo, useCallback } from 'react';
import { ArrowRight, X, Check } from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import useSettingsStore from '../../stores/settingsStore';
import NodeIcon from '../common/NodeIcon';
import { getTypeColor } from '../../utils/typeColors';
import { NODE_TYPES } from '../../utils/nodeSchemas';

// ── Status columns ────────────────────────────────────────────────────────────
const STATUS_COLS = [
  { id: 'active', label: 'Active', color: '#4ade80' },
  { id: 'hidden', label: 'Hidden', color: '#fbbf24' },
  { id: 'dead',   label: 'Dead',   color: '#ef4444' },
];

function nodeStatusColId(node) {
  const f = node.statusFlags || {};
  if (f.alive === false)    return 'dead';
  if (f.revealed === false) return 'hidden';
  return 'active';
}

const ORG_TYPES = new Set(['faction', 'religion', 'polity']);

// ── Main component ─────────────────────────────────────────────────────────────
export default function MobileBoardView() {
  const campaignId       = useCampaignStore((s) => s.activeCampaignId);
  const nodes            = useNodeStore((s) => s.nodes);
  const selectNode       = useNodeStore((s) => s.selectNode);
  const updateNode       = useNodeStore((s) => s.updateNode);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const customNodeTypes  = useSettingsStore((s) => s.customNodeTypes)   || [];
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};

  const [groupBy,      setGroupBy]      = useState('status');
  const [pinnedCols,   setPinnedCols]   = useState(null); // null = auto first 2
  const [pickedNodeId, setPickedNodeId] = useState(null);

  // ── Build column list from groupBy ──────────────────────────────────────────
  const columns = useMemo(() => {
    if (groupBy === 'status') return STATUS_COLS;

    if (groupBy === 'type') {
      const built = Object.entries(NODE_TYPES).map(([id, schema]) => {
        const ovr = nodeTypeOverrides[id] || {};
        return { id, label: ovr.label || schema.label, color: getTypeColor(id) };
      });
      const custom = customNodeTypes.map((ct) => ({
        id: ct.id, label: ct.label, color: ct.color || '#8890a0',
      }));
      return [...built, ...custom];
    }

    if (groupBy === 'faction') {
      const orgs = nodes.filter((n) => ORG_TYPES.has(n.type));
      const cols = orgs.map((n) => ({
        id: n.id,
        label: n.fields?.name || 'Unnamed',
        color: getTypeColor(n.type),
      }));
      return [...cols, { id: '__none__', label: 'Unaffiliated', color: '#8890a0' }];
    }

    return [];
  }, [groupBy, nodes, customNodeTypes, nodeTypeOverrides]);

  // ── Effective pinned columns (default: first 2) ─────────────────────────────
  const effectivePinned = useMemo(() => {
    if (pinnedCols !== null) return pinnedCols;
    return columns.slice(0, 2).map((c) => c.id);
  }, [pinnedCols, columns]);

  const handleGroupBy = useCallback((g) => {
    setGroupBy(g);
    setPinnedCols(null);
    setPickedNodeId(null);
  }, []);

  const togglePin = useCallback((colId) => {
    setPinnedCols((prev) => {
      const cur = prev ?? columns.slice(0, 2).map((c) => c.id);
      if (cur.includes(colId)) {
        return cur.length <= 1 ? cur : cur.filter((c) => c !== colId);
      }
      return [...cur, colId];
    });
  }, [columns]);

  // ── Nodes for a column ──────────────────────────────────────────────────────
  const nodesForCol = useCallback((colId) => {
    if (groupBy === 'status') {
      return nodes.filter((n) => nodeStatusColId(n) === colId);
    }
    if (groupBy === 'type') {
      return nodes.filter((n) => (n.type || 'character') === colId);
    }
    if (groupBy === 'faction') {
      if (colId === '__none__') {
        const orgNodes = nodes.filter((n) => ORG_TYPES.has(n.type));
        const allMembered = new Set(orgNodes.flatMap((n) => n.fields?.members || []));
        return nodes.filter((n) => !ORG_TYPES.has(n.type) && !allMembered.has(n.id));
      }
      const org = nodes.find((n) => n.id === colId);
      return nodes.filter((n) => (org?.fields?.members || []).includes(n.id));
    }
    return [];
  }, [groupBy, nodes]);

  // ── Move node to column ─────────────────────────────────────────────────────
  const moveNode = useCallback((nodeId, toColId) => {
    if (groupBy === 'status') {
      const flags = toColId === 'dead'
        ? { alive: false, revealed: true }
        : toColId === 'hidden'
          ? { alive: true, revealed: false }
          : { alive: true, revealed: true };
      updateNode(campaignId, nodeId, { statusFlags: flags });
    } else if (groupBy === 'faction') {
      const orgNodes = nodes.filter((n) => ORG_TYPES.has(n.type));
      orgNodes.forEach((org) => {
        const members = org.fields?.members || [];
        const has = members.includes(nodeId);
        if (org.id === toColId && !has) {
          updateNodeFields(campaignId, org.id, { members: [...members, nodeId] });
        } else if (org.id !== toColId && has) {
          updateNodeFields(campaignId, org.id, { members: members.filter((m) => m !== nodeId) });
        }
      });
    }
    setPickedNodeId(null);
  }, [groupBy, nodes, campaignId, updateNode, updateNodeFields]);

  const pinnedColumns = columns.filter((c) => effectivePinned.includes(c.id));
  const pickedNode    = pickedNodeId ? nodes.find((n) => n.id === pickedNodeId) : null;
  const canMove       = groupBy === 'status' || groupBy === 'faction';

  return (
    <div className="mbv2-root">

      {/* ── Top controls ── */}
      <div className="mbv2-controls">
        {/* Group by tabs */}
        <div className="mbv2-groupby">
          {['status', 'type', 'faction'].map((g) => (
            <button
              key={g}
              className={`mbv2-groupby-btn${groupBy === g ? ' active' : ''}`}
              onClick={() => handleGroupBy(g)}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>

        {/* Column picker chips */}
        <div className="mbv2-col-picker">
          {columns.map((col) => {
            const pinned = effectivePinned.includes(col.id);
            return (
              <button
                key={col.id}
                className={`mbv2-col-chip${pinned ? ' pinned' : ''}`}
                style={{ '--chip-col': col.color }}
                onClick={() => togglePin(col.id)}
              >
                {pinned && <Check size={10} weight="bold" />}
                {col.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Move banner ── */}
      {pickedNode && (
        <div className="mbv2-move-banner">
          <span>Tap a column header to move <strong>{pickedNode.fields?.name || 'node'}</strong></span>
          <button className="mbv2-move-cancel" onClick={() => setPickedNodeId(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Columns ── */}
      <div className="mbv2-cols">
        {pinnedColumns.map((col) => {
          const colNodes = nodesForCol(col.id);
          const isTarget = !!pickedNodeId;
          return (
            <div key={col.id} className={`mbv2-col${isTarget ? ' is-target' : ''}`}>

              {/* Column header — tap to drop when in move mode */}
              <div
                className={`mbv2-col-header${isTarget ? ' drop-target' : ''}`}
                style={{ '--col-accent': col.color }}
                onClick={() => { if (pickedNodeId) moveNode(pickedNodeId, col.id); }}
              >
                <div className="mbv2-col-accent-bar" />
                <span className="mbv2-col-title">{col.label}</span>
                <span className="mbv2-col-count">{colNodes.length}</span>
                {isTarget && <span className="mbv2-drop-hint">↓ Drop</span>}
              </div>

              {/* Cards */}
              <div className="mbv2-cards">
                {colNodes.map((node) => {
                  const name     = node.fields?.name || 'Unnamed';
                  const type     = node.type || 'character';
                  const isPicked = pickedNodeId === node.id;
                  return (
                    <div
                      key={node.id}
                      className={`mbv2-card${isPicked ? ' picked' : ''}`}
                      onClick={() => {
                        if (pickedNodeId) return; // in move mode, only column headers work
                        selectNode(node.id);
                      }}
                    >
                      <div className="mbv2-card-icon" style={{ background: `var(--node-${type}, #8890a0)22` }}>
                        <NodeIcon node={node} size={13} showOverlays={false} />
                      </div>
                      <span className="mbv2-card-name">{name}</span>
                      {canMove && (
                        <button
                          className={`mbv2-card-move-btn${isPicked ? ' active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPickedNodeId(isPicked ? null : node.id);
                          }}
                          title="Move to another column"
                        >
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {colNodes.length === 0 && (
                  <div className="mbv2-empty">
                    {isTarget ? 'Tap header above to drop here' : 'Empty'}
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
