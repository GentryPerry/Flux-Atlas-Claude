import {
  UserCircle,
  MapPin,
  Shield,
  Cross,
  Lightning,
  Sword,
  Crown,
  Cube,
  Skull,
  EyeSlash,
} from '@phosphor-icons/react';
import { NODE_TYPES } from '../../utils/nodeSchemas';

const ICON_MAP = {
  UserCircle,
  MapPin,
  Shield,
  Cross,
  Lightning,
  Sword,
  Crown,
  Cube,
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

export default function NodeIcon({ node, size = 20, showOverlays = true }) {
  const schema = NODE_TYPES[node.type];
  const iconName = node.icon || schema?.icon || 'Cube';
  const IconComponent = ICON_MAP[iconName] || Cube;
  const color = TYPE_COLORS[node.type] || 'var(--text-secondary)';

  // Check type-appropriate primary status flag (not hardcoded to 'alive')
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
      {showOverlays && node.statusFlags && !node.statusFlags.revealed && (
        <EyeSlash
          size={Math.round(size * 0.5)}
          weight="fill"
          color="var(--text-muted)"
          style={{ position: 'absolute', top: -2, right: -4 }}
        />
      )}
    </span>
  );
}

export { ICON_MAP, TYPE_COLORS };
