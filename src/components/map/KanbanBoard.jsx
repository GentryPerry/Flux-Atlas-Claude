import { useState, useMemo, useCallback } from 'react';
import {
  UserCircle, MapPin, Shield, Cross, Lightning, Sword, Crown,
  ArrowSquareIn, CaretDown, X,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useTagStore from '../../stores/tagStore';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';

const ICON_MAP = { UserCircle, MapPin, Shield, Cross, Lightning, Sword, Crown };

const TYPE_COLORS = {
  character: 'var(--node-character)',
  location: 'var(--node-location)',
  faction: 'var(--node-faction)',
  religion: 'var(--node-religion)',
  event: 'var(--node-event)',
  realm: 'var(--node-realm)',
  thing: 'var(--node-thing)',
};

/**
 * Kanban-style relationship board.
 * Groups nodes into columns by faction/religion/realm/location membership.
 * Cards show all node types that can belong to the selected group type.
 * Drag cards between columns to ADD multi-membership (doesn't replace).
 * Click the X on a card to remove it from just that column.
 */
export default function KanbanBoard({ groupBy = 'faction' }) {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectNode = useNodeStore((s) => s.selectNode);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const tags = useTagStore((s) => s.tags);
  const createTag = useTagStore((s) => s.createTag);
  const [dragNodeId, setDragNodeId] = useState(null);
  const [groupMode, setGroupMode] = useState(groupBy);

  // Get all nodes on this map
  const mapNodes = useMemo(
    () => allNodes.filter((n) => n.mapId === activeMapId),
    [allNodes, activeMapId]
  );

  // Group nodes are the column headers (factions, religions, realms, or locations)
  const groupType = groupMode; // 'faction', 'religion', 'realm', or 'location'
  const groupNodes = useMemo(
    () => mapNodes.filter((n) => n.type === groupType),
    [mapNodes, groupType]
  );

  // Determine which field keys to use for membership lookup based on groupType
  const getMembershipInfo = useCallback((groupType) => {
    switch (groupType) {
      case 'faction':
        return {
          characterField: 'faction',
          locationField: 'controllingFaction',
        };
      case 'religion':
        return {
          characterField: 'religion',
          locationField: null, // religions only apply to characters
        };
      case 'realm':
        return {
          characterField: null, // realm field not yet on schema
          locationField: null,
        };
      case 'location':
        return {
          characterField: null, // location membership tracked via location's notableNPCs
          locationField: null,
          inverseField: 'notableNPCs', // look at location.notableNPCs to find chars
        };
      default:
        return {};
    }
  }, []);

  const membershipInfo = getMembershipInfo(groupType);

  // Member nodes: determine which node types can belong to the current grouping
  const memberNodes = useMemo(() => {
    switch (groupType) {
      case 'faction':
        return mapNodes.filter((n) => n.type === 'character' || n.type === 'location');
      case 'religion':
        return mapNodes.filter((n) => n.type === 'character');
      case 'realm':
        return []; // realm grouping not yet supported; could be added later
      case 'location':
        return mapNodes.filter((n) => n.type === 'character');
      default:
        return [];
    }
  }, [mapNodes, groupType]);

  // Build columns: each group node becomes a column
  const columns = useMemo(() => {
    const cols = groupNodes.map((gNode) => {
      // Find tag for this group node
      const gTag = tags.find(
        (t) => t.name.toLowerCase() === (gNode.fields?.name || '').toLowerCase()
      );
      const gTagId = gTag?.id;

      let members = [];

      if (groupType === 'location') {
        // Special case: for location grouping, find NPCs in location's notableNPCs
        members = memberNodes.filter((mn) => {
          if (mn.type === 'character') {
            const notableNPCIds = gNode.fields?.notableNPCs || [];
            return notableNPCIds.includes(mn.id);
          }
          return false;
        });
      } else {
        // Standard case: check character/location fields for the group tag
        const characterField = membershipInfo.characterField;
        const locationField = membershipInfo.locationField;

        members = memberNodes.filter((mn) => {
          if (mn.type === 'character' && characterField) {
            const tagIds = mn.fields?.[characterField] || [];
            return gTagId && tagIds.includes(gTagId);
          }
          if (mn.type === 'location' && locationField) {
            const tagIds = mn.fields?.[locationField] || [];
            return gTagId && tagIds.includes(gTagId);
          }
          return false;
        });
      }

      return {
        id: gNode.id,
        name: gNode.fields?.name || 'Unnamed',
        color: TYPE_COLORS[groupType],
        members,
        tagId: gTagId,
        nodeType: groupType, // the type of the group node
      };
    });

    // Unassigned column: nodes not in ANY group of the current type
    const assignedIds = new Set();
    for (const col of cols) {
      for (const m of col.members) assignedIds.add(m.id);
    }
    const unassigned = memberNodes.filter((mn) => !assignedIds.has(mn.id));

    return [
      ...cols,
      {
        id: '__unassigned__',
        name: 'Unassigned',
        color: 'var(--text-muted)',
        members: unassigned,
        tagId: null,
      },
    ];
  }, [groupNodes, memberNodes, tags, groupType, membershipInfo]);

  const handleDragStart = useCallback((nodeId) => {
    setDragNodeId(nodeId);
  }, []);

  const handleDrop = useCallback((columnId, columnTagId) => {
    if (!dragNodeId || !campaignId) return;
    const node = allNodes.find((n) => n.id === dragNodeId);
    if (!node) return;

    if (columnId === '__unassigned__') {
      // Remove from all groups: clear the relevant field
      const characterField = membershipInfo.characterField;
      const locationField = membershipInfo.locationField;

      if (node.type === 'character' && characterField) {
        updateNodeFields(campaignId, dragNodeId, { [characterField]: [] });
      } else if (node.type === 'location' && locationField) {
        updateNodeFields(campaignId, dragNodeId, { [locationField]: [] });
      }
    } else {
      // Find or create tag for this column
      const col = columns.find((c) => c.id === columnId);
      let tagId = columnTagId;
      if (!tagId && col) {
        let tag = tags.find((t) => t.name.toLowerCase() === col.name.toLowerCase());
        if (!tag) {
          tag = createTag(campaignId, col.name);
        }
        tagId = tag.id;
      }

      if (tagId) {
        const characterField = membershipInfo.characterField;
        const locationField = membershipInfo.locationField;

        // ADD to this group (don't replace): only add if not already there
        if (node.type === 'character' && characterField) {
          const currentTags = node.fields?.[characterField] || [];
          if (!currentTags.includes(tagId)) {
            updateNodeFields(campaignId, dragNodeId, {
              [characterField]: [...currentTags, tagId],
            });
          }
        } else if (node.type === 'location' && locationField) {
          const currentTags = node.fields?.[locationField] || [];
          if (!currentTags.includes(tagId)) {
            updateNodeFields(campaignId, dragNodeId, {
              [locationField]: [...currentTags, tagId],
            });
          }
        }
      }
    }

    setDragNodeId(null);
  }, [dragNodeId, campaignId, allNodes, groupType, columns, tags, createTag, updateNodeFields, membershipInfo]);

  // Remove a card from a specific column (the X button)
  const handleRemoveFromColumn = useCallback((nodeId, columnId, columnTagId) => {
    if (!campaignId || !columnTagId) return;
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node) return;

    const characterField = membershipInfo.characterField;
    const locationField = membershipInfo.locationField;

    if (node.type === 'character' && characterField) {
      const currentTags = node.fields?.[characterField] || [];
      const updated = currentTags.filter((id) => id !== columnTagId);
      updateNodeFields(campaignId, nodeId, { [characterField]: updated });
    } else if (node.type === 'location' && locationField) {
      const currentTags = node.fields?.[locationField] || [];
      const updated = currentTags.filter((id) => id !== columnTagId);
      updateNodeFields(campaignId, nodeId, { [locationField]: updated });
    }
  }, [campaignId, allNodes, membershipInfo, updateNodeFields]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Mode selector */}
      <div style={{
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Group by:
        </span>
        {['faction', 'religion', 'realm', 'location'].map((mode) => (
          <button
            key={mode}
            className={`card-filter-chip ${groupMode === mode ? 'active' : ''}`}
            onClick={() => setGroupMode(mode)}
            style={groupMode === mode ? { borderColor: TYPE_COLORS[mode], color: TYPE_COLORS[mode] } : {}}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Board */}
      <div className="kanban-view">
        {columns.map((col) => (
          <div
            key={col.id}
            className="kanban-column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.id, col.tagId)}
          >
            <div className="kanban-column-header">
              <div className="dot" style={{ background: col.color }} />
              <span>{col.name}</span>
              <span className="count">{col.members.length}</span>
            </div>
            <div className="kanban-column-body">
              {col.members.map((node) => {
                const schema = NODE_TYPES[node.type];
                const Icon = ICON_MAP[schema?.icon] || UserCircle;
                const color = TYPE_COLORS[node.type];
                return (
                  <div
                    key={`${col.id}-${node.id}`}
                    className={`kanban-card ${dragNodeId === node.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(node.id)}
                    onClick={() => selectNode(node.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      <div className="mini-icon" style={{ background: `${color}18`, color }}>
                        <Icon size={14} weight="duotone" />
                      </div>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {node.fields?.name || 'Unnamed'}
                      </span>
                    </div>
                    {col.id !== '__unassigned__' && (
                      <button
                        className="kanban-card-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromColumn(node.id, col.id, col.tagId);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                        title="Remove from this column"
                      >
                        <X size={14} weight="bold" />
                      </button>
                    )}
                  </div>
                );
              })}
              {col.members.length === 0 && (
                <div className="kanban-unassigned" style={{ padding: '12px 8px', fontSize: 12 }}>
                  {col.id === '__unassigned__' ? 'No unassigned' : 'Drop here to add'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
