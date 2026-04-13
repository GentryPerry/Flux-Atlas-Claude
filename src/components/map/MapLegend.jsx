import { useMemo } from 'react';
import useNodeStore from '../../stores/nodeStore';
import useMapStore from '../../stores/mapStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';

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
 * Auto-generated floating legend based on which node types
 * are actually present on the current map.
 */
export default function MapLegend() {
  const activeMapId = useMapStore((s) => s.activeMapId);
  const allNodes = useNodeStore((s) => s.nodes);

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

  if (presentTypes.length === 0) return null;

  return (
    <div className="map-legend">
      <div className="map-legend-title">Legend</div>
      {presentTypes.map(([type, count]) => {
        const schema = NODE_TYPES[type];
        return (
          <div key={type} className="map-legend-item">
            <div
              className="map-legend-dot"
              style={{ background: TYPE_COLORS[type] || 'var(--text-muted)' }}
            />
            <span>{schema?.label || type}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11 }}>
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
