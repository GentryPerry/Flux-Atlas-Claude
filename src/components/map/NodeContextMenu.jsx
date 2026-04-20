import { useEffect, useLayoutEffect, useRef, useMemo, useState } from 'react';
import {
  Trash, Shield, Cross, Eye, EyeSlash,
  Skull, Heart, PencilSimple, ArrowsOut, TreeStructure, Tray,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useTagStore from '../../stores/tagStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';

/**
 * Right-click context menu for nodes on the canvas and card panel.
 * Shows node-specific actions: edit, status toggles, add to faction/religion, delete, etc.
 */
export default function NodeContextMenu({
  nodeId,
  position,   // { x, y } in viewport coords
  onClose,
}) {
  const ref = useRef(null);
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectNode = useNodeStore((s) => s.selectNode);
  const updateNode = useNodeStore((s) => s.updateNode);
  const deleteNode = useNodeStore((s) => s.deleteNode);
  const nestNode = useNodeStore((s) => s.nestNode);
  const unnestNode = useNodeStore((s) => s.unnestNode);
  const tags = useTagStore((s) => s.tags);
  const createTag = useTagStore((s) => s.createTag);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);

  const node = useMemo(
    () => allNodes.find((n) => n.id === nodeId) || null,
    [allNodes, nodeId]
  );

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  if (!node) return null;

  const typeInfo = NODE_TYPES[node.type];
  const typeColor = `var(--node-${node.type})`;

  // Gather faction and religion nodes for "Add to" submenus
  const factionNodes = allNodes.filter((n) => n.type === 'faction' && n.id !== nodeId);
  const religionNodes = allNodes.filter((n) => n.type === 'religion' && n.id !== nodeId);

  const handleStatusToggle = (flag) => {
    updateNode(campaignId, node.id, {
      statusFlags: { ...node.statusFlags, [flag]: !node.statusFlags[flag] },
    });
    onClose();
  };

  const handleAddToGroup = (fieldKey, targetNode) => {
    // Add target node's name as a tag reference
    let tag = tags.find((t) => t.name.toLowerCase() === (targetNode.fields?.name || '').toLowerCase());
    if (!tag) {
      tag = createTag(campaignId, targetNode.fields?.name || 'Unknown');
    }
    const currentTags = node.fields?.[fieldKey] || [];
    if (!currentTags.includes(tag.id)) {
      updateNodeFields(campaignId, node.id, { [fieldKey]: [...currentTags, tag.id] });
    }
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Delete "${node.fields?.name || 'this node'}"?`)) {
      deleteNode(campaignId, node.id);
    }
    onClose();
  };

  const handleEdit = () => {
    selectNode(node.id);
    onClose();
  };

  // Clamp menu inside viewport after measuring its actual size
  const [adjusted, setAdjusted] = useState(false);
  const [pos, setPos] = useState({ left: position.x, top: position.y });

  // Max height: leave 24px padding from viewport edges
  const maxH = typeof window !== 'undefined' ? window.innerHeight - 24 : 600;

  useLayoutEffect(() => {
    setPos({ left: position.x, top: position.y });
    setAdjusted(false);
  }, [position.x, position.y]);

  useLayoutEffect(() => {
    if (adjusted) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const pad = 12;

    let left = position.x;
    let top = position.y;

    // Push left if it goes off right edge
    if (left + rect.width > vpW - pad) left = vpW - rect.width - pad;
    if (left < pad) left = pad;

    // Push up if it goes off bottom edge — account for maxHeight constraint
    const menuH = Math.min(rect.height, maxH);
    if (top + menuH > vpH - pad) top = vpH - menuH - pad;
    if (top < pad) top = pad;

    if (left !== position.x || top !== position.y) {
      setPos({ left, top });
    }
    setAdjusted(true);
  }, [position.x, position.y, adjusted, maxH]);

  return (
    <div
      className="context-menu"
      ref={ref}
      style={{
        left: pos.left,
        top: pos.top,
        maxHeight: `calc(100vh - ${pos.top + 12}px)`,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div className="context-menu-label" style={{ color: typeColor }}>
        {typeInfo?.label || node.type} — {node.fields?.name || 'Unnamed'}
      </div>

      <button className="context-menu-item" onClick={handleEdit}>
        <PencilSimple size={16} /> Edit Details
        <span className="ctx-shortcut">Click</span>
      </button>

      <div className="context-menu-divider" />

      {/* Status toggles */}
      <div className="context-menu-label">Status</div>
      {typeInfo?.statusFlags && Object.entries(typeInfo.statusFlags).map(([flagKey, flagDef]) => {
        const isOn = node.statusFlags?.[flagKey] ?? flagDef.default;
        return (
          <button key={flagKey} className="context-menu-item" onClick={() => handleStatusToggle(flagKey)}>
            {flagKey === 'revealed'
              ? (isOn ? <EyeSlash size={16} /> : <Eye size={16} />)
              : (isOn ? <Skull size={16} /> : <Heart size={16} />)
            }
            {isOn ? `Mark as ${flagDef.offLabel}` : `Mark as ${flagDef.label}`}
          </button>
        );
      })}

      {/* Add to faction (for character/location types) */}
      {(node.type === 'character' || node.type === 'location') && factionNodes.length > 0 && (
        <>
          <div className="context-menu-divider" />
          <div className="context-menu-label">Add to Faction</div>
          {factionNodes.slice(0, 5).map((fn) => (
            <button
              key={fn.id}
              className="context-menu-item"
              onClick={() => handleAddToGroup(
                node.type === 'character' ? 'faction' : 'controllingFaction',
                fn
              )}
            >
              <Shield size={16} color="var(--node-faction)" />
              {fn.fields?.name || 'Unnamed'}
            </button>
          ))}
        </>
      )}

      {/* Add to religion (for character types) */}
      {node.type === 'character' && religionNodes.length > 0 && (
        <>
          <div className="context-menu-divider" />
          <div className="context-menu-label">Add to Religion</div>
          {religionNodes.slice(0, 5).map((rn) => (
            <button
              key={rn.id}
              className="context-menu-item"
              onClick={() => handleAddToGroup('religion', rn)}
            >
              <Cross size={16} color="var(--node-religion)" />
              {rn.fields?.name || 'Unnamed'}
            </button>
          ))}
        </>
      )}

      {/* Remove from folder */}
      {node.parentNodeId && (
        <>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={() => {
            unnestNode(campaignId, node.id, node.x + 80, node.y);
            onClose();
          }}>
            <ArrowsOut size={16} /> Remove from folder
          </button>
        </>
      )}

      {/* Move into a folder — any node can go inside any other node */}
      {!node.parentNodeId && (() => {
        const validParents = allNodes.filter((n) => {
          if (n.id === nodeId || n.mapId !== node.mapId) return false;
          if (n.parentNodeId) return false; // don't show nested nodes as targets
          return true;
        });
        if (!validParents.length) return null;
        return (
          <>
            <div className="context-menu-divider" />
            <div className="context-menu-label">Move into folder</div>
            {validParents.slice(0, 8).map((parent) => (
              <button
                key={parent.id}
                className="context-menu-item"
                onClick={() => { nestNode(campaignId, node.id, parent.id); onClose(); }}
              >
                <TreeStructure size={16} color={`var(--node-${parent.type})`} />
                {parent.fields?.name || 'Unnamed'}
              </button>
            ))}
          </>
        );
      })()}

      <div className="context-menu-divider" />

      <button className="context-menu-item" onClick={() => {
        updateNode(campaignId, node.id, { mapId: '__staging__', parentNodeId: null });
        onClose();
      }}>
        <Tray size={16} /> Remove from Map
      </button>

      <button className="context-menu-item danger" onClick={handleDelete}>
        <Trash size={16} /> Delete Node
        <span className="ctx-shortcut">Del</span>
      </button>
    </div>
  );
}
