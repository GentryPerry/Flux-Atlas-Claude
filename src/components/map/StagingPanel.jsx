import { useMemo } from 'react';
import { Tray, ArrowSquareOut, Trash, X } from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import useMapStore from '../../stores/mapStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';

const TYPE_COLORS = {
  character: '#c084fc',
  location: '#60a5fa',
  faction: '#fb923c',
  religion: '#fbbf24',
  event: '#f87171',
  polity: '#e879a8',
  thing: '#4ade80',
};

/**
 * Staging panel — shows nodes removed from the map.
 * Allows placing them back on the current map or deleting them.
 */
export default function StagingPanel({ onClose }) {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const allNodes = useNodeStore((s) => s.nodes);
  const updateNode = useNodeStore((s) => s.updateNode);
  const deleteNode = useNodeStore((s) => s.deleteNode);
  const selectNode = useNodeStore((s) => s.selectNode);

  const stagedNodes = useMemo(
    () => allNodes.filter((n) => n.campaignId === campaignId && n.mapId === '__staging__'),
    [allNodes, campaignId]
  );

  const handleRestore = (nodeId) => {
    // Place back on current map at a random position near center
    const x = 200 + Math.random() * 400;
    const y = 200 + Math.random() * 300;
    updateNode(campaignId, nodeId, { mapId: activeMapId, x, y });
  };

  return (
    <div className="staging-panel">
      <div className="staging-panel-header">
        <Tray size={18} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>Off-Map Staging</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
          {stagedNodes.length}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn-icon" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="staging-panel-body">
        {stagedNodes.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No staged nodes. Right-click a node and select "Remove from Map" to stage it here.
          </div>
        ) : (
          stagedNodes.map((node) => {
            const color = TYPE_COLORS[node.type] || '#8890a0';
            const typeLabel = NODE_TYPES[node.type]?.label || node.type;
            return (
              <div key={node.id} className="staging-card">
                <div className="staging-card-dot" style={{ background: color }} />
                <div className="staging-card-info" onClick={() => selectNode(node.id)}>
                  <span className="staging-card-name">{node.fields?.name || 'Unnamed'}</span>
                  <span className="staging-card-type" style={{ color }}>{typeLabel}</span>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => handleRestore(node.id)}
                  title="Restore to map"
                >
                  <ArrowSquareOut size={14} />
                </button>
                <button
                  className="btn-icon"
                  onClick={() => {
                    if (confirm(`Delete "${node.fields?.name || 'node'}"?`)) {
                      deleteNode(campaignId, node.id);
                    }
                  }}
                  title="Delete permanently"
                  style={{ color: 'var(--danger)' }}
                >
                  <Trash size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
