import { useState, useMemo } from 'react';
import { CaretRight, CaretDown, Tray, ArrowSquareOut, Trash } from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useMapStore from '../../stores/mapStore';
import useSettingsStore from '../../stores/settingsStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';
import { getTypeColor, getTypeLabel } from '../../utils/typeColors';

/**
 * Floating bottom-left panel: auto-generated legend + collapsible staging folder.
 */
export default function MapLegend() {
  const campaignId        = useCampaignStore((s) => s.activeCampaignId);
  const activeMapId       = useMapStore((s) => s.activeMapId);
  const allNodes          = useNodeStore((s) => s.nodes);
  const updateNode        = useNodeStore((s) => s.updateNode);
  const deleteNode        = useNodeStore((s) => s.deleteNode);
  const selectNode        = useNodeStore((s) => s.selectNode);
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];

  const [stagingOpen, setStagingOpen] = useState(false);

  const presentTypes = useMemo(() => {
    const typeCounts = {};
    for (const n of allNodes) {
      if (n.mapId !== activeMapId) continue;
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }
    return Object.entries(typeCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [allNodes, activeMapId]);

  const stagedNodes = useMemo(
    () => allNodes.filter((n) => n.campaignId === campaignId && n.mapId === '__staging__'),
    [allNodes, campaignId]
  );

  const handleRestore = (nodeId) => {
    const x = 200 + Math.random() * 400;
    const y = 200 + Math.random() * 300;
    updateNode(campaignId, nodeId, { mapId: activeMapId, x, y });
  };

  // Nothing to show at all
  if (presentTypes.length === 0 && stagedNodes.length === 0) return null;

  return (
    <div className="map-legend">
      {/* ── Legend entries ── */}
      {presentTypes.length > 0 && (
        <>
          <div className="map-legend-title">Legend</div>
          {presentTypes.map(([type, count]) => {
            const color = getTypeColor(type, nodeTypeOverrides, customNodeTypes);
            const label = getTypeLabel(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            return (
              <div key={type} className="map-legend-item">
                <div className="map-legend-dot" style={{ background: color }} />
                <span>{label}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11 }}>
                  {count}
                </span>
              </div>
            );
          })}
        </>
      )}

      {/* ── Staging folder ── */}
      {(presentTypes.length > 0 || stagedNodes.length > 0) && (
        <div className={`legend-staging${presentTypes.length > 0 ? ' legend-staging-divided' : ''}`}>
          <button
            className={`legend-staging-header${stagingOpen ? ' open' : ''}`}
            onClick={() => setStagingOpen((v) => !v)}
            title={stagingOpen ? 'Collapse staging' : 'Expand staging'}
          >
            <Tray size={13} style={{ flexShrink: 0 }} />
            <span>Staging</span>
            {stagedNodes.length > 0 && (
              <span className="legend-staging-count">{stagedNodes.length}</span>
            )}
            <span className="legend-staging-caret">
              <CaretDown
                size={11}
                style={{
                  transform: stagingOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.15s',
                }}
              />
            </span>
          </button>

          {stagingOpen && (
            <div className="legend-staging-list">
              {stagedNodes.length === 0 ? (
                <div className="legend-staging-empty">
                  Right-click a node → "Remove from Map" to stage it here.
                </div>
              ) : (
                stagedNodes.map((node) => {
                  const color = getTypeColor(node.type, nodeTypeOverrides, customNodeTypes);
                  const typeLabel = getTypeLabel(node.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
                  return (
                    <div
                      key={node.id}
                      className="legend-staging-card"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('staging-node-id', node.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      title="Drag to map or click name to view"
                    >
                      <div className="staging-card-dot" style={{ background: color }} />
                      <span
                        className="legend-staging-name"
                        style={{ color }}
                        onClick={() => selectNode(node.id)}
                      >
                        {node.fields?.name || 'Unnamed'}
                      </span>
                      <button
                        className="btn-icon staging-action"
                        onClick={() => handleRestore(node.id)}
                        title="Place at map centre"
                      >
                        <ArrowSquareOut size={11} />
                      </button>
                      <button
                        className="btn-icon staging-action"
                        onClick={() => {
                          if (confirm(`Delete "${node.fields?.name || 'node'}"?`)) {
                            deleteNode(campaignId, node.id);
                          }
                        }}
                        title="Delete permanently"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash size={11} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
