/**
 * Default field schemas for each node type.
 * Every field: { key, label, type, default, filterTypes? }
 * Types: text, textarea, tags, select, status
 *
 * filterTypes on tags fields limits autocomplete to only nodes of those types.
 * Each type also defines `statusFlags` — the relevant flags for that type.
 */

/**
 * Node type kinds:
 *  'spatial'  — can be placed and nested on the map (location, character, thing, event)
 *  'abstract' — organizational / conceptual; participates through tag-based relationships
 *               rather than spatial nesting (faction, religion, polity)
 *
 * Custom node types default to 'spatial' unless the user sets kind:'abstract'.
 */
export const NODE_TYPE_KINDS = {
  character: 'spatial',
  location:  'spatial',
  faction:   'abstract',
  religion:  'abstract',
  event:     'spatial',
  polity:    'abstract',
  thing:     'spatial',
};

/** Returns true if the given type (built-in or custom) is abstract */
export function isAbstractType(typeId, customNodeTypes = []) {
  if (typeId in NODE_TYPE_KINDS) return NODE_TYPE_KINDS[typeId] === 'abstract';
  const custom = customNodeTypes.find((c) => c.id === typeId);
  return custom?.kind === 'abstract';
}

/**
 * Nesting rules: which child types are valid inside each SPATIAL parent type.
 * Abstract types (faction, religion, polity) are NOT parents — they use tag relationships.
 * Custom spatial node types default to allowing all types as children.
 */
export const NESTING_RULES = {
  location:  ['location', 'character', 'thing', 'event'],
  event:     ['character', 'location', 'thing'],
  character: ['thing'],
  thing:     [],
};

/** Maximum map drill-down depth (root level = 0, max = 3 drill-downs deep) */
export const MAP_MAX_DEPTH = 4;

/**
 * Returns true if childType can be nested inside parentType.
 * Abstract parent types always return false.
 * Custom spatial node types (not in NESTING_RULES) allow any child type.
 */
export function canNestType(childType, parentType, customNodeTypes = []) {
  if (!parentType) return false;
  if (isAbstractType(parentType, customNodeTypes)) return false;

  // Custom spatial child types can nest inside any spatial parent
  const isCustomSpatialChild = !(childType in NODE_TYPE_KINDS) &&
    !isAbstractType(childType, customNodeTypes);

  if (parentType in NESTING_RULES) {
    return NESTING_RULES[parentType].includes(childType) || isCustomSpatialChild;
  }
  // Custom spatial node types as parent: allow anything
  return true;
}

/**
 * Given a dragged node's schema and a target node type, find the tag field
 * on the dragged node that accepts the target type (for tag-based assignment).
 * Returns { key, label } or null if no matching field.
 */
export function getTagAssignmentField(draggedSchema, targetType) {
  if (!draggedSchema?.fields) return null;
  const field = draggedSchema.fields.find(
    (f) => f.type === 'tags' && f.filterTypes?.includes(targetType)
  );
  return field || null;
}

/**
 * Reverse-lookup: find all nodes that reference targetNodeId in any tag field
 * that accepts targetNodeType. Returns list of { node, fieldKey, fieldLabel }.
 */
export function getTagMembers(targetNodeId, targetNodeType, allNodes, nodeSchemas, customNodeTypes = []) {
  const results = [];
  const seen = new Set();
  for (const node of allNodes) {
    if (seen.has(node.id)) continue;
    const schema = nodeSchemas[node.type];
    const fields = schema?.fields || [];
    for (const field of fields) {
      if (field.type !== 'tags' || !field.filterTypes?.includes(targetNodeType)) continue;
      const refs = node.fields?.[field.key];
      if (Array.isArray(refs) && refs.includes(targetNodeId)) {
        results.push({ node, fieldKey: field.key, fieldLabel: field.label });
        seen.add(node.id);
        break;
      }
    }
  }
  return results;
}

export const NODE_TYPES = {
  character: {
    label: 'NPC',
    icon: 'UserCircle',
    kind: 'spatial',
    drillDown: 'detail',
    statusFlags: {
      alive: { label: 'Alive', offLabel: 'Dead', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: true },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'faction', label: 'Faction', type: 'tags', default: [], filterTypes: ['faction'] },
      { key: 'religion', label: 'Religion', type: 'tags', default: [], filterTypes: ['religion'] },
      { key: 'motivation', label: 'Motivation', type: 'text', default: '' },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  location: {
    label: 'Location',
    icon: 'MapPin',
    kind: 'spatial',
    drillDown: 'spatial',
    statusFlags: {
      active: { label: 'Active', offLabel: 'Ruined', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: true },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'locationType', label: 'Location Type', type: 'select', default: 'city', options: ['city', 'town', 'district', 'landmark', 'building', 'territory', 'outpost', 'port', 'crossing', 'hideout', 'other'] },
      { key: 'notableNPCs', label: 'Notable NPCs', type: 'tags', default: [], filterTypes: ['character'] },
      { key: 'controllingFaction', label: 'Controlling Faction', type: 'tags', default: [], filterTypes: ['faction'] },
      { key: 'subLocations', label: 'Sub-locations', type: 'tags', default: [], filterTypes: ['location'] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  faction: {
    label: 'Faction',
    icon: 'Shield',
    kind: 'abstract',
    drillDown: 'hierarchy',
    statusFlags: {
      active: { label: 'Active', offLabel: 'Disbanded', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: true },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'alignment', label: 'Alignment', type: 'text', default: '' },
      { key: 'leader', label: 'Leader', type: 'tags', default: [], filterTypes: ['character'] },
      { key: 'goals', label: 'Goals', type: 'textarea', default: '' },
      { key: 'enemies', label: 'Enemies', type: 'tags', default: [], filterTypes: ['faction', 'polity'] },
      { key: 'allies', label: 'Allies', type: 'tags', default: [], filterTypes: ['faction', 'polity', 'location'] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  religion: {
    label: 'Religion',
    icon: 'Cross',
    kind: 'abstract',
    drillDown: 'hierarchy',
    statusFlags: {
      active: { label: 'Active', offLabel: 'Defunct', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: true },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'deity', label: 'Deity / Pantheon', type: 'text', default: '' },
      { key: 'dogma', label: 'Dogma', type: 'textarea', default: '' },
      { key: 'leadership', label: 'Leadership', type: 'tags', default: [], filterTypes: ['character'] },
      { key: 'holySites', label: 'Holy Sites', type: 'tags', default: [], filterTypes: ['location'] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  event: {
    label: 'Event',
    icon: 'Lightning',
    kind: 'spatial',
    drillDown: 'eventWeb',
    statusFlags: {
      active: { label: 'Ongoing', offLabel: 'Resolved', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: true },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'date', label: 'Date / Era', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'involvedParties', label: 'Involved Parties', type: 'tags', default: [], filterTypes: ['character', 'faction', 'location', 'religion', 'polity'] },
      { key: 'consequences', label: 'Consequences', type: 'textarea', default: '' },
      { key: 'status', label: 'Status', type: 'select', default: 'active', options: ['active', 'resolved', 'ongoing', 'pending'] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  polity: {
    label: 'Polity',
    icon: 'Crown',
    kind: 'abstract',
    drillDown: 'hierarchy',
    statusFlags: {
      active: { label: 'Active', offLabel: 'Defunct', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: true },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ruler', label: 'Leader', type: 'tags', default: [], filterTypes: ['character'] },
      { key: 'territory', label: 'Territory', type: 'textarea', default: '' },
      { key: 'allies', label: 'Allies', type: 'tags', default: [], filterTypes: ['polity', 'faction'] },
      { key: 'enemies', label: 'Enemies', type: 'tags', default: [], filterTypes: ['polity', 'faction'] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  thing: {
    label: 'Item',
    icon: 'Sword',
    kind: 'spatial',
    drillDown: 'detail',
    statusFlags: {
      intact: { label: 'Intact', offLabel: 'Destroyed', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: true },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'owner', label: 'Owner', type: 'tags', default: [], filterTypes: ['character', 'faction'] },
      { key: 'location', label: 'Location', type: 'tags', default: [], filterTypes: ['location'] },
      { key: 'significance', label: 'Significance', type: 'textarea', default: '' },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },

};

/** Build default field data for a given node type */
export function buildDefaultFields(nodeType) {
  const schema = NODE_TYPES[nodeType];
  if (!schema) return { name: '' };
  const data = {};
  for (const field of schema.fields) {
    data[field.key] = Array.isArray(field.default) ? [...field.default] : field.default;
  }
  return data;
}

/** Build default status flags for a given node type */
export function buildDefaultStatusFlags(nodeType) {
  const schema = NODE_TYPES[nodeType];
  if (!schema?.statusFlags) return { revealed: false };
  const flags = {};
  for (const [key, def] of Object.entries(schema.statusFlags)) {
    flags[key] = def.default;
  }
  return flags;
}

/** Get the field schema for a node type (falls back to empty) */
export function getFieldSchema(nodeType) {
  return NODE_TYPES[nodeType]?.fields || [];
}

/** Default fields for custom node types that have no schema */
export const DEFAULT_CUSTOM_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', default: '' },
  { key: 'description', label: 'Description', type: 'textarea', default: '' },
  { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
];

/** Default status flags for custom node types */
export const DEFAULT_CUSTOM_STATUS_FLAGS = {
  revealed: { label: 'Revealed', offLabel: 'Hidden', default: true },
};
