import { useState, useMemo, useCallback, memo } from 'react';
import {
  MagnifyingGlass, Funnel, X, ArrowSquareIn,
  Eye, Skull, Tray,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useTagStore from '../../stores/tagStore';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import useSettingsStore from '../../stores/settingsStore';
import { NODE_TYPES, isAbstractType } from '../../utils/nodeSchemas';
import { resolveIcon } from '../../utils/iconRegistry';
import { getTypeIcon, getTypeLabel, getTypeColor } from '../../utils/typeColors';

// CSS-variable based colors — work for both built-in and custom types
// (WorkspaceView injects --node-{typeId} for all types including custom)
const TYPE_COLORS = {
  character: 'var(--node-character)',
  location: 'var(--node-location)',
  faction: 'var(--node-faction)',
  religion: 'var(--node-religion)',
  event: 'var(--node-event)',
  polity: 'var(--node-polity)',
  thing: 'var(--node-thing)',
};

const CARDS_PER_PAGE = 50;

/**
 * Individual card component — pure render, no store hooks.
 * All data passed via props to avoid per-card store subscriptions.
 */
const NodeCard = memo(({ node, isSelected, tagMap, nodeMap, childMapId, onSelect, onDrill, onChipletSelect, nodeTypeOverrides, customNodeTypes }) => {
  const schema   = NODE_TYPES[node.type] || null;
  const iconName = getTypeIcon(node.type, NODE_TYPES, nodeTypeOverrides || {}, customNodeTypes || []);
  const Icon     = resolveIcon(iconName);
  const color    = `var(--node-${node.type}, var(--text-secondary))`;
  const typeLabel = (nodeTypeOverrides || {})[node.type]?.label
    || schema?.label
    || (customNodeTypes || []).find((c) => c.id === node.type)?.label
    || node.type;

  // User-defined tag chips (from tagStore)
  const tagFields = schema?.fields?.filter((f) => f.type === 'tags') || [];
  const allFieldTags = [];
  for (const field of tagFields) {
    const raw = node.fields?.[field.key];
    const ids = Array.isArray(raw) ? raw : [];
    for (const id of ids) {
      const tag = tagMap[id];
      if (tag) allFieldTags.push(tag);
    }
  }

  // Relationship chiplets — three sources:
  //  1. Abstract-type tag references (faction, religion, polity, …)
  //  2. Parent node (spatial container this node lives inside)
  //  3. Children nodes (nodes nested inside this one)
  const relChiplets = [];
  const seenChipIds = new Set();

  const pushChip = (refNode) => {
    if (!refNode || seenChipIds.has(refNode.id)) return;
    seenChipIds.add(refNode.id);
    const chipColor    = getTypeColor(refNode.type, nodeTypeOverrides || {}, customNodeTypes || []);
    const chipIconName = getTypeIcon(refNode.type, NODE_TYPES, nodeTypeOverrides || {}, customNodeTypes || []);
    const ChipIcon     = resolveIcon(chipIconName);
    relChiplets.push({ refNode, chipColor, ChipIcon });
  };

  // 1. Abstract-type tag field references
  for (const field of tagFields) {
    if (!field.filterTypes?.length) continue;
    const raw = node.fields?.[field.key];
    if (!Array.isArray(raw) || raw.length === 0) continue;
    for (const refId of raw) {
      const refNode = nodeMap?.[refId];
      if (!refNode) continue;
      if (!isAbstractType(refNode.type, customNodeTypes || [])) continue;
      pushChip(refNode);
    }
  }

  // 2. Parent node (spatial container)
  if (node.parentNodeId) {
    pushChip(nodeMap?.[node.parentNodeId]);
  }

  // 3. Children nodes (nodes nested inside this one) — cap at 4 to avoid overflow
  if (nodeMap) {
    const children = Object.values(nodeMap).filter((n) => n.parentNodeId === node.id);
    for (const child of children.slice(0, 4)) pushChip(child);
    if (children.length > 4) {
      relChiplets.push({ overflow: children.length - 4 });
    }
  }

  const heroImage = node.images?.[0]?.url;
  const desc = node.fields?.description;
  const displayDesc = desc ? (desc.length > 120 ? desc.slice(0, 120) + '...' : desc) : null;

  return (
    <div
      className={`node-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(node.id)}
      style={isSelected ? { borderColor: color } : undefined}
    >
      {heroImage && <img className="node-card-image" src={heroImage} alt="" loading="lazy" />}

      <div className="node-card-inner" style={{ borderLeftColor: color }}>
        <div className="node-card-header">
          <div className="node-card-icon" style={{ background: `${color}18`, color }}>
            <Icon size={18} weight="duotone" />
          </div>
          <div className="node-card-title">
            <span className="node-card-name">{node.fields?.name || 'Unnamed'}</span>
            <span className="node-card-type" style={{ color }}>{typeLabel}</span>
          </div>
          <div className="node-card-status">
            {node.mapId === '__staging__' && (
              <span className="status-badge status-staged">
                <Tray size={11} /> Staged
              </span>
            )}
            {schema?.statusFlags &&
              Object.entries(schema.statusFlags).map(([flagKey, flagDef]) => {
                if (flagKey === 'revealed') return null;
                const flagValue = node.statusFlags?.[flagKey];
                const isOn = flagValue !== undefined ? flagValue : flagDef.default;
                if (isOn) return null;
                return (
                  <span key={flagKey} className="status-badge status-dead">
                    <Skull size={11} /> {flagDef.offLabel}
                  </span>
                );
              })}
          </div>
        </div>

        {displayDesc && <p className="node-card-desc">{displayDesc}</p>}

        {/* Relationship chiplets — faction/parent/children */}
        {relChiplets.length > 0 && (
          <div className="node-card-chiplets">
            {relChiplets.map((chip, i) => {
              if (chip.overflow) {
                return (
                  <span key="overflow" className="rel-chiplet" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)', background: 'var(--bg-inset)' }}>
                    +{chip.overflow}
                  </span>
                );
              }
              const { refNode, chipColor, ChipIcon } = chip;
              return (
                <span
                  key={refNode.id}
                  className="rel-chiplet"
                  style={{ borderColor: `${chipColor}50`, color: chipColor, background: `${chipColor}14`, cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); onChipletSelect?.(refNode.id); }}
                  title={`Open ${refNode.fields?.name || refNode.type}`}
                >
                  <ChipIcon size={9} weight="fill" />
                  {refNode.fields?.name || '—'}
                </span>
              );
            })}
          </div>
        )}

        {/* User-defined tag chips */}
        {allFieldTags.length > 0 && (
          <div className="node-card-tags">
            {allFieldTags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                className="tag"
                style={{ borderColor: `${tag.color}40`, color: tag.color, background: `${tag.color}12` }}
              >
                {tag.name}
              </span>
            ))}
            {allFieldTags.length > 4 && (
              <span className="tag" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
                +{allFieldTags.length - 4}
              </span>
            )}
          </div>
        )}

        {childMapId && (
          <button
            className="node-card-drill"
            onClick={(e) => { e.stopPropagation(); onDrill(childMapId); }}
          >
            <ArrowSquareIn size={14} /> Enter map
          </button>
        )}
      </div>
    </div>
  );
}, (prev, next) => (
  prev.node === next.node &&
  prev.isSelected === next.isSelected &&
  prev.tagMap === next.tagMap &&
  prev.nodeMap === next.nodeMap &&
  prev.childMapId === next.childMapId
));

NodeCard.displayName = 'NodeCard';

// Staging filter options
const STAGING_FILTERS = [
  { id: 'not_staged', label: 'On Map' },
  { id: 'staged',     label: 'Staged' },
  { id: 'all',        label: 'All' },
];

export default function CardPanel() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);
  const selectNode = useNodeStore((s) => s.selectNode);
  const drillDown = useMapStore((s) => s.drillDown);
  const tags = useTagStore((s) => s.tags);
  const maps = useMapStore((s) => s.maps);
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];

  // Build a single tag lookup map — shared by ALL cards via props
  const tagMap = useMemo(() => {
    const m = {};
    for (const t of tags) m[t.id] = t;
    return m;
  }, [tags]);

  // Build a node lookup map for relationship chiplets
  const nodeMap = useMemo(() => {
    const m = {};
    for (const n of allNodes) m[n.id] = n;
    return m;
  }, [allNodes]);

  // Build child map lookup
  const childMapLookup = useMemo(() => {
    const m = {};
    for (const map of maps) {
      if (map.parentMapId) m[map.parentMapId] = map.id;
    }
    return m;
  }, [maps]);

  // All campaign nodes — includes placed AND staged
  const campaignNodes = useMemo(
    () => allNodes.filter((n) => n.campaignId === activeCampaignId),
    [allNodes, activeCampaignId]
  );

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(null);
  const [stagingFilter, setStagingFilter] = useState('not_staged');
  const [displayLimit, setDisplayLimit] = useState(CARDS_PER_PAGE);

  // Reset display limit when filters change
  const handleStagingFilter = useCallback((id) => {
    setStagingFilter(id);
    setDisplayLimit(CARDS_PER_PAGE);
  }, []);

  const filtered = useMemo(() => {
    let result = campaignNodes;

    // Staging filter
    if (stagingFilter === 'not_staged') result = result.filter((n) => n.mapId !== '__staging__');
    else if (stagingFilter === 'staged') result = result.filter((n) => n.mapId === '__staging__');

    if (filterType) result = result.filter((n) => n.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((n) => {
        const name = n.fields?.name?.toLowerCase() || '';
        const desc = n.fields?.description?.toLowerCase() || '';
        return name.includes(q) || desc.includes(q);
      });
    }
    return result.sort((a, b) => (a.fields?.name || '').localeCompare(b.fields?.name || ''));
  }, [campaignNodes, stagingFilter, filterType, search]);

  const visibleCards = useMemo(() => filtered.slice(0, displayLimit), [filtered, displayLimit]);

  // Type counts scoped to current staging filter pass
  const typeFilterCounts = useMemo(() => {
    const base = stagingFilter === 'not_staged'
      ? campaignNodes.filter((n) => n.mapId !== '__staging__')
      : stagingFilter === 'staged'
        ? campaignNodes.filter((n) => n.mapId === '__staging__')
        : campaignNodes;
    const counts = {};
    for (const n of base) counts[n.type] = (counts[n.type] || 0) + 1;
    return counts;
  }, [campaignNodes, stagingFilter]);

  const handleSelectNode = useCallback((nodeId) => selectNode(nodeId), [selectNode]);
  const handleDrill = useCallback((mapId) => drillDown(mapId), [drillDown]);

  const baseTotalCount = useMemo(() => {
    if (stagingFilter === 'not_staged') return campaignNodes.filter((n) => n.mapId !== '__staging__').length;
    if (stagingFilter === 'staged')     return campaignNodes.filter((n) => n.mapId === '__staging__').length;
    return campaignNodes.length;
  }, [campaignNodes, stagingFilter]);

  return (
    <div className="card-panel" data-tour="card-panel">
      <div className="card-panel-header">
        <div className="card-panel-search">
          <MagnifyingGlass size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
          />
          {search && (
            <button className="btn-icon" onClick={() => setSearch('')} style={{ padding: 2 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Staging filter */}
        <div className="card-panel-filters" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 4 }}>
          {STAGING_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              className={`card-filter-chip ${stagingFilter === id ? 'active' : ''}`}
              onClick={() => handleStagingFilter(id)}
              style={stagingFilter === id && id === 'staged' ? { borderColor: 'var(--text-muted)', color: 'var(--text-muted)' } : {}}
            >
              {id === 'staged' && <Tray size={10} style={{ marginRight: 3 }} />}
              {label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="card-panel-filters">
          <button
            className={`card-filter-chip ${!filterType ? 'active' : ''}`}
            onClick={() => setFilterType(null)}
          >
            All ({baseTotalCount})
          </button>
          {Object.entries(NODE_TYPES).map(([key, schema]) => {
            const count = typeFilterCounts[key] || 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                className={`card-filter-chip ${filterType === key ? 'active' : ''}`}
                onClick={() => setFilterType(filterType === key ? null : key)}
                style={filterType === key ? { borderColor: TYPE_COLORS[key], color: TYPE_COLORS[key] } : {}}
              >
                {schema.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="card-panel-body">
        {filtered.length === 0 && (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <Funnel size={32} />
            <span>No nodes match your filter</span>
          </div>
        )}

        {visibleCards.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            isSelected={node.id === selectedNodeId}
            tagMap={tagMap}
            nodeMap={nodeMap}
            childMapId={childMapLookup[node.id] || null}
            onSelect={handleSelectNode}
            onDrill={handleDrill}
            onChipletSelect={handleSelectNode}
            nodeTypeOverrides={nodeTypeOverrides}
            customNodeTypes={customNodeTypes}
          />
        ))}

        {filtered.length > visibleCards.length && (
          <button
            className="btn btn-secondary"
            onClick={() => setDisplayLimit((prev) => prev + CARDS_PER_PAGE)}
            style={{ margin: '12px auto', alignSelf: 'center' }}
          >
            Show more ({filtered.length - visibleCards.length} remaining)
          </button>
        )}
      </div>
    </div>
  );
}
