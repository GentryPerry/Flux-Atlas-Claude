import { useState, useMemo, useRef, useEffect } from 'react';
import { MagnifyingGlass, X, CaretRight } from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';
import { getTypeColor } from '../../utils/typeColors';
import useSettingsStore from '../../stores/settingsStore';

/**
 * Build the full ancestor chain for a node.
 * Returns [greatGrandparent, grandparent, parent] — nearest ancestor last.
 */
function getAncestorChain(node, nodeById) {
  const chain = [];
  const visited = new Set();
  let curr = node;
  while (curr?.parentNodeId) {
    if (visited.has(curr.parentNodeId)) break;
    visited.add(curr.parentNodeId);
    const parent = nodeById[curr.parentNodeId];
    if (!parent) break;
    chain.unshift(parent);
    curr = parent;
  }
  return chain;
}

/**
 * Search overlay — shows filtered node results with full ancestry breadcrumbs.
 * All ancestors of matched nodes are included in the map highlight set.
 */
export default function SearchOverlay({ onClose, onHighlight }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectNode = useNodeStore((s) => s.selectNode);
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fast node lookup by ID
  const nodeById = useMemo(() => {
    const map = {};
    for (const n of allNodes) map[n.id] = n;
    return map;
  }, [allNodes]);

  // Direct matches — nodes whose name/description/notes include the query
  const directMatches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allNodes
      .filter((n) => n.campaignId === campaignId)
      .filter((n) => {
        const name  = (n.fields?.name        || '').toLowerCase();
        const desc  = (n.fields?.description || '').toLowerCase();
        const notes = (n.fields?.notes       || '').toLowerCase();
        return name.includes(q) || desc.includes(q) || notes.includes(q);
      });
  }, [query, allNodes, campaignId]);

  // Build result rows: each row = { node, ancestors[] }
  // Also collect the full highlight set = matched nodes + all their ancestors
  const { resultRows, highlightIds } = useMemo(() => {
    const rows = directMatches.map((node) => ({
      node,
      ancestors: getAncestorChain(node, nodeById),
    }));

    // Sort: nodes with no ancestors first, then by ancestor count ascending
    rows.sort((a, b) => a.ancestors.length - b.ancestors.length);

    // Build highlight set: matched nodes + all their ancestors
    const ids = new Set();
    for (const { node, ancestors } of rows) {
      ids.add(node.id);
      for (const anc of ancestors) ids.add(anc.id);
    }

    return { resultRows: rows, highlightIds: ids };
  }, [directMatches, nodeById]);

  // Report highlighted node IDs to MapCanvas
  useEffect(() => {
    onHighlight?.(highlightIds.size > 0 ? highlightIds : null);
    return () => onHighlight?.(null);
  }, [highlightIds, onHighlight]);

  const handleSelect = (nodeId) => {
    selectNode(nodeId);
    onClose();
  };

  return (
    <div className="search-overlay">
      <div className="search-overlay-bar">
        <MagnifyingGlass size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all nodes…"
          className="search-overlay-input"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && resultRows.length > 0) handleSelect(resultRows[0].node.id);
          }}
        />
        <button className="btn-icon" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {query.trim() && (
        <div className="search-overlay-results">
          {resultRows.length === 0 ? (
            <div className="search-empty">No nodes match "{query}"</div>
          ) : (
            <div className="search-result-list">
              <div className="search-count">
                {resultRows.length} result{resultRows.length !== 1 ? 's' : ''}
              </div>

              {resultRows.map(({ node, ancestors }) => {
                const color     = getTypeColor(node.type, nodeTypeOverrides, customNodeTypes);
                const typeLabel = NODE_TYPES[node.type]?.label || node.type;

                return (
                  <button
                    key={node.id}
                    className="search-result-item"
                    onClick={() => handleSelect(node.id)}
                  >
                    {/* Ancestor breadcrumb trail */}
                    {ancestors.length > 0 && (
                      <span className="search-result-breadcrumb">
                        {ancestors.map((anc, i) => {
                          const ancColor = getTypeColor(anc.type, nodeTypeOverrides, customNodeTypes);
                          return (
                            <span key={anc.id} className="search-breadcrumb-segment">
                              {i > 0 && (
                                <CaretRight
                                  size={9}
                                  className="search-breadcrumb-sep"
                                />
                              )}
                              <span
                                className="search-breadcrumb-node"
                                style={{ color: ancColor }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelect(anc.id);
                                }}
                                title={`Open ${anc.fields?.name || anc.type}`}
                              >
                                {anc.fields?.name || anc.type}
                              </span>
                            </span>
                          );
                        })}
                        <CaretRight size={9} className="search-breadcrumb-sep" />
                      </span>
                    )}

                    {/* Match dot */}
                    <div className="search-result-dot" style={{ background: color }} />

                    {/* Node name */}
                    <span className="search-result-name">{node.fields?.name || 'Unnamed'}</span>

                    {/* Type badge */}
                    <span className="search-result-type" style={{ color }}>{typeLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
