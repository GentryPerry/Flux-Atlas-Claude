import { Cube, Skull, EyeSlash } from '@phosphor-icons/react';
import { NODE_TYPES } from '../../utils/nodeSchemas';
import { resolveIcon } from '../../utils/iconRegistry';
import useSettingsStore from '../../stores/settingsStore';
import { getTypeIcon } from '../../utils/typeColors';

// Keep TYPE_COLORS export for legacy callers (CardPanel etc.)
export const TYPE_COLORS = {
  character: 'var(--node-character)',
  location:  'var(--node-location)',
  faction:   'var(--node-faction)',
  religion:  'var(--node-religion)',
  event:     'var(--node-event)',
  polity:    'var(--node-polity)',
  thing:     'var(--node-thing)',
};

export default function NodeIcon({ node, size = 20, showOverlays = true }) {
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];

  // Resolve icon: per-node override → type-level settings override → schema default
  const iconName = node.icon
    || getTypeIcon(node.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
  const IconComponent = resolveIcon(iconName) || Cube;

  // Color comes from CSS variable (set per type in WorkspaceView)
  const color = `var(--node-${node.type}, var(--text-secondary))`;

  const schema = NODE_TYPES[node.type];
  const primaryFlag = schema?.statusFlags
    ? Object.keys(schema.statusFlags).find((k) => k !== 'revealed')
    : null;
  const isInactive = primaryFlag && node.statusFlags && !node.statusFlags[primaryFlag];

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <IconComponent size={size} weight="duotone" color={color} />
      {showOverlays && isInactive && (
        <Skull
          size={Math.round(size * 0.5)}
          weight="fill"
          color="var(--danger)"
          style={{ position: 'absolute', bottom: -2, right: -4 }}
        />
      )}
    </span>
  );
}
