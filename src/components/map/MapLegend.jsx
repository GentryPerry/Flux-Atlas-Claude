import { useMemo } from 'react';
import useNodeStore from '../../stores/nodeStore';
import useMapStore from '../../stores/mapStore';
import useSettingsStore from '../../stores/settingsStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';
import { getTypeColor, getTypeLabel } from '../../utils/typeColors';

/**
 * Auto-generated floating legend based on which node types
 * are actually present on the current map.
 * Respects label/color overrides from Settings → Node Types.
 */
export default function MapLegend() {
  const activeMapId       = useMapStore((s) => s.activeMapId);
  const allNodes          = useNodeStore((s) => s.nodes);
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];

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
    </div>
  );
}
