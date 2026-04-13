import { useState, useMemo, useCallback, memo } from 'react';
import {
  MagnifyingGlass, Funnel, X, ArrowSquareIn,
  UserCircle, MapPin, Shield, Cross, Lightning, Sword, Crown,
  Eye, EyeSlash, Skull,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useTagStore from '../../stores/tagStore';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';

const ICON_MAP = {
  UserCircle, MapPin, Shield, Cross, Lightning, Sword, Crown,
};

const TYPE_COLORS = {
  character: 'var(--node-character)',
  location: 'var(--node-location)',
  faction: 'var(--node-faction)',
  religion: 'var(--node-religion)',
  event: 'var(--node-event)',
  realm: 'var(--node-realm)',
  thing: 'var(--node-thing)',
};

const CARDS_PER_PAGE = 50;

/**
 * Individual card component — pure render, no store hooks.
 * All data passed via props to avoid per-card store subscriptions.
 */
const NodeCard = memo(({ node, isSelected, tagMap, childMapId, onSelect, onDrill }) => {
  const schema = NODE_TYPES[node.type];
  const iconName = schema?.icon || 'Cube';
  const Icon = ICON_MAP[iconName] || MapPin;
  const color = TYPE_COLORS[node.type] || 'var(--text-secondary)';

  // Resolve tags from pre-built map
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
            <span className="node-card-type" style={{ color }}>{schema?.label}</span>
          </div>
          <div className="node-card-status">
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
            {node.statusFlags?.revealed ? (
              <span className="status-badge status-revealed"><Eye size={11} /> Visible</span>
            ) : (
              <span className="status-badge status-hidden"><EyeSlash size={11} /> Hidden</span>
            )}
          </div>
        </div>

        {displayDesc && <p className="node-card-desc">{displayDesc}</p>}

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
  prev.childMapId === next.childMapId
));

NodeCard.displayName = 'NodeCard';

export default function CardPanel() {
  const activeMapId = useMapStore((s) => s.activeMapId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);
  const selectNode = useNodeStore((s) => s.selectNode);
  const drillDown = useMapStore((s) => s.drillDown);
  const tags = useTagStore((s) => s.tags);
  const maps = useMapStore((s) => s.maps);

  // Build a single tag lookup map — shared by ALL cards via props
  const tagMap = useMemo(() => {
    const m = {};
    for (const t of tags) m[t.id] = t;
    return m;
  }, [tags]);

  // Build child map lookup
  const childMapLookup = useMemo(() => {
    const m = {};
    for (const map of maps) {
      if (map.parentMapId) m[map.parentMapId] = map.id;
    }
    return m;
  }, [maps]);

  const nodes = useMemo(
    () => allNodes.filter((n) => n.mapId === activeMapId),
    [allNodes, activeMapId]
  );

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(CARDS_PER_PAGE);

  const filtered = useMemo(() => {
    let result = nodes;
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
  }, [nodes, filterType, search]);

  const visibleCards = useMemo(() => filtered.slice(0, displayLimit), [filtered, displayLimit]);

  // Type counts for filter chips
  const typeFilterCounts = useMemo(() => {
    const counts = {};
    for (const n of nodes) counts[n.type] = (counts[n.type] || 0) + 1;
    return counts;
  }, [nodes]);

  const handleSelectNode = useCallback((nodeId) => selectNode(nodeId), [selectNode]);
  const handleDrill = useCallback((mapId) => drillDown(mapId), [drillDown]);

  return (
    <div className="card-panel">
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
        <div className="card-panel-filters">
          <button
            className={`card-filter-chip ${!filterType ? 'active' : ''}`}
            onClick={() => setFilterType(null)}
          >
            All ({nodes.length})
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
            childMapId={childMapLookup[node.id] || null}
            onSelect={handleSelectNode}
            onDrill={handleDrill}
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
