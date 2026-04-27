import { useMemo } from 'react';
import { NODE_TYPES } from '../../utils/nodeSchemas';
import { getTypeColor, getTypeIcon } from '../../utils/typeColors';
import { resolveIcon } from '../../utils/iconRegistry';

// ── Per-type config ───────────────────────────────────────────────────────────

const HIER_CONFIG = {
  faction: {
    parentField:  'parentFaction',
    leaderField:  'leader',
    memberField:  'faction',   // field on character nodes that references this type
    leaderLabel:  'Leader',
  },
  religion: {
    parentField:  'parentReligion',
    leaderField:  'leadership',
    memberField:  'religion',
    leaderLabel:  'Leadership',
  },
  polity: {
    parentField:  'parentPolity',
    leaderField:  'ruler',
    memberField:  null,        // polity membership isn't tracked on character directly
    leaderLabel:  'Ruler',
  },
};

// ── Small node chip — used throughout the tree ────────────────────────────────

function NodeChip({ node, isCurrent, typeOverrides, customNodeTypes, onSelect }) {
  const color    = getTypeColor(node.type, typeOverrides, customNodeTypes);
  const iconName = getTypeIcon(node.type, NODE_TYPES, typeOverrides, customNodeTypes);
  const Icon     = resolveIcon(iconName);
  const name     = node.fields?.name  || '—';
  const title    = node.fields?.title || '';

  return (
    <button
      className={`hier-chip${isCurrent ? ' hier-chip-current' : ''}`}
      style={{ '--hier-color': color }}
      onClick={() => !isCurrent && onSelect(node.id)}
      disabled={isCurrent}
      title={isCurrent ? name : `Open ${name}`}
    >
      <Icon size={10} weight={isCurrent ? 'fill' : 'regular'} />
      <span className="hier-chip-name">{name}</span>
      {title && <span className="hier-chip-title">{title}</span>}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Derive hierarchy config for a custom abstract node type.
 * Pulls fields from nodeFieldOverrides (the added array for that type).
 * Looks for:
 *  - parentField: a tags field with filterTypes including its own type (singular preferred)
 *  - leaderField: any tags field filtering for 'character'
 */
function deriveCustomConfig(nodeType, customNodeTypes, nodeFieldOverrides) {
  const ct = customNodeTypes?.find((c) => c.id === nodeType);
  if (!ct) return null;

  // Merge default custom fields with any added overrides
  const DEFAULT_FIELDS = [
    { key: 'name', label: 'Name', type: 'text', default: '' },
    { key: 'description', label: 'Description', type: 'textarea', default: '' },
    { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
  ];
  const addedFields = nodeFieldOverrides?.[nodeType]?.added || [];
  const allFields   = [...DEFAULT_FIELDS, ...addedFields];

  // Parent: prefer singular tags field pointing to own type
  const parentF =
    allFields.find((f) => f.type === 'tags' && f.filterTypes?.includes(nodeType) && f.singular) ||
    allFields.find((f) => f.type === 'tags' && f.filterTypes?.includes(nodeType));

  if (!parentF) return null;

  // Leader: first tags field pointing to character
  const leaderF = allFields.find((f) => f.type === 'tags' && f.filterTypes?.includes('character'));

  return {
    parentField:  parentF.key,
    leaderField:  leaderF?.key || null,
    memberField:  null,
    leaderLabel:  leaderF?.label || 'Leader',
  };
}

export default function HierarchyView({ node, allNodes, onSelectNode, nodeTypeOverrides, customNodeTypes, nodeFieldOverrides }) {
  const cfg = HIER_CONFIG[node.type] ?? deriveCustomConfig(node.type, customNodeTypes, nodeFieldOverrides);
  if (!cfg) return null;

  const { parentField, leaderField, memberField, leaderLabel } = cfg;

  // Build a fast id→node lookup
  const nodeMap = useMemo(() => {
    const m = {};
    for (const n of allNodes) m[n.id] = n;
    return m;
  }, [allNodes]);

  // ── Ancestors (walk parent chain up to 4 levels) ────────────────────────────
  const ancestors = useMemo(() => {
    const chain = [];
    const visited = new Set([node.id]);
    let cur = node;
    for (let i = 0; i < 4; i++) {
      const ids = cur.fields?.[parentField];
      if (!ids?.length) break;
      const parent = nodeMap[ids[0]];
      if (!parent || visited.has(parent.id)) break;
      visited.add(parent.id);
      chain.unshift(parent);
      cur = parent;
    }
    return chain;
  }, [node, nodeMap, parentField]);

  // ── Direct children (same type, parent field points to this node) ───────────
  const children = useMemo(() =>
    allNodes.filter((n) =>
      n.type === node.type &&
      n.id   !== node.id  &&
      n.fields?.[parentField]?.includes(node.id)
    ),
    [allNodes, node, parentField]
  );

  // ── Siblings (same type, same parent — only if node has a parent) ───────────
  const parentId = node.fields?.[parentField]?.[0] ?? null;
  const siblings = useMemo(() => {
    if (!parentId) return [];
    return allNodes.filter((n) =>
      n.type === node.type &&
      n.id   !== node.id  &&
      n.fields?.[parentField]?.includes(parentId)
    );
  }, [allNodes, node, parentId, parentField]);

  // ── Leaders (from the node's own leader field) ──────────────────────────────
  const leaders = useMemo(() => {
    const ids = node.fields?.[leaderField] || [];
    return ids.map((id) => nodeMap[id]).filter(Boolean);
  }, [node, nodeMap, leaderField]);

  // ── Members (characters who reference this node via their faction/religion) ──
  const members = useMemo(() => {
    if (!memberField) return [];
    return allNodes.filter(
      (n) => n.type === 'character' && n.fields?.[memberField]?.includes(node.id)
    );
  }, [allNodes, node, memberField]);

  // Don't render the section at all if there's nothing to show
  const hasTree    = ancestors.length > 0 || children.length > 0 || siblings.length > 0;
  const hasPeople  = leaders.length > 0 || members.length > 0;
  if (!hasTree && !hasPeople) return null;

  const chipProps = { typeOverrides: nodeTypeOverrides, customNodeTypes, onSelect: onSelectNode };

  return (
    <div className="hier-root">
      <div className="hier-section-label">Hierarchy</div>

      {/* ── Org tree ──────────────────────────────────────────────────── */}
      {hasTree && (
        <div className="hier-tree">
          {/* Ancestor rows — each indented one level deeper */}
          {ancestors.map((anc, depth) => (
            <div key={anc.id} className="hier-row" style={{ '--depth': depth }}>
              <div className="hier-row-indent" />
              <div className="hier-row-line" />
              <NodeChip node={anc} {...chipProps} />
            </div>
          ))}

          {/* Current node row */}
          <div className="hier-row hier-row-current" style={{ '--depth': ancestors.length }}>
            <div className="hier-row-indent" />
            {ancestors.length > 0 && <div className="hier-row-line" />}
            <NodeChip node={node} isCurrent {...chipProps} />
          </div>

          {/* Children rows */}
          {children.map((child) => (
            <div key={child.id} className="hier-row" style={{ '--depth': ancestors.length + 1 }}>
              <div className="hier-row-indent" />
              <div className="hier-row-line" />
              <NodeChip node={child} {...chipProps} />
            </div>
          ))}

          {/* Siblings (collapsible row below a divider) */}
          {siblings.length > 0 && (
            <div className="hier-siblings">
              <span className="hier-siblings-label">Also under {nodeMap[parentId]?.fields?.name || 'parent'}:</span>
              <div className="hier-siblings-row">
                {siblings.map((sib) => (
                  <NodeChip key={sib.id} node={sib} {...chipProps} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── People section ────────────────────────────────────────────── */}
      {hasPeople && (
        <div className="hier-people">
          {leaders.length > 0 && (
            <div className="hier-people-group">
              <span className="hier-people-label">{leaderLabel}</span>
              <div className="hier-people-chips">
                {leaders.map((l) => (
                  <NodeChip key={l.id} node={l} {...chipProps} />
                ))}
              </div>
            </div>
          )}

          {members.length > 0 && (
            <div className="hier-people-group">
              <span className="hier-people-label">
                Members <span className="hier-people-count">({members.length})</span>
              </span>
              <div className="hier-people-chips">
                {members.slice(0, 16).map((m) => (
                  <NodeChip key={m.id} node={m} {...chipProps} />
                ))}
                {members.length > 16 && (
                  <span className="hier-overflow">+{members.length - 16} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
