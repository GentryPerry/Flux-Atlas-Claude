/**
 * Default node type colors.
 * Components that can use CSS variables (HTML/DOM) should use var(--node-TYPE).
 * Components that need literal colors (Konva/Canvas) should use getTypeColor().
 */
export const DEFAULT_TYPE_COLORS = {
  character: '#c48dff',   // amethyst
  location:  '#6db3ff',   // cerulean
  faction:   '#ff9f43',   // ember
  religion:  '#fbbf24',   // gold
  event:     '#ff7b7b',   // coral
  polity:    '#e879a8',   // rose
  thing:     '#5aeea0',   // jade
};

/**
 * Get the resolved color for a node type, respecting settings overrides.
 * Also handles custom node types stored in customNodeTypes array.
 */
export function getTypeColor(type, overrides = {}, customNodeTypes = []) {
  if (overrides[type]?.color) return overrides[type].color;
  if (DEFAULT_TYPE_COLORS[type]) return DEFAULT_TYPE_COLORS[type];
  const custom = customNodeTypes.find((c) => c.id === type);
  return custom?.color || '#8890a0';
}

/**
 * Get the display label for a node type, respecting settings overrides.
 * Also handles custom node types.
 */
export function getTypeLabel(type, nodeTypes, overrides = {}, customNodeTypes = []) {
  if (overrides[type]?.label) return overrides[type].label;
  if (nodeTypes[type]?.label) return nodeTypes[type].label;
  const custom = customNodeTypes.find((c) => c.id === type);
  return custom?.label || type;
}

/**
 * Get the icon name string for a node type, respecting settings overrides.
 * Also handles custom node types.
 */
export function getTypeIcon(type, nodeTypes, overrides = {}, customNodeTypes = []) {
  if (overrides[type]?.icon) return overrides[type].icon;
  if (nodeTypes[type]?.icon) return nodeTypes[type].icon;
  const custom = customNodeTypes.find((c) => c.id === type);
  return custom?.icon || 'UserCircle';
}
