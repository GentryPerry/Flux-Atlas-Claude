/**
 * Default field schemas for each node type.
 * Every field: { key, label, type, default }
 * Types: text, textarea, tags, select, status
 *
 * Each type also defines `statusFlags` — the relevant flags for that type.
 */

export const NODE_TYPES = {
  character: {
    label: 'NPC',
    icon: 'UserCircle',
    drillDown: 'detail',
    statusFlags: {
      alive: { label: 'Alive', offLabel: 'Dead', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: false },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'faction', label: 'Faction', type: 'tags', default: [] },
      { key: 'religion', label: 'Religion', type: 'tags', default: [] },
      { key: 'motivation', label: 'Motivation', type: 'text', default: '' },
      { key: 'status', label: 'Status', type: 'select', default: 'alive', options: ['alive', 'dead', 'unknown'] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  location: {
    label: 'Location',
    icon: 'MapPin',
    drillDown: 'spatial',
    statusFlags: {
      active: { label: 'Active', offLabel: 'Ruined', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: false },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'region', label: 'Region', type: 'text', default: '' },
      { key: 'locationType', label: 'Location Type', type: 'select', default: 'city', options: ['city', 'town', 'district', 'landmark', 'building', 'region', 'territory', 'outpost', 'port', 'crossing', 'hideout', 'other'] },
      { key: 'notableNPCs', label: 'Notable NPCs', type: 'tags', default: [] },
      { key: 'controllingFaction', label: 'Controlling Faction', type: 'tags', default: [] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  faction: {
    label: 'Faction',
    icon: 'Shield',
    drillDown: 'hierarchy',
    statusFlags: {
      active: { label: 'Active', offLabel: 'Disbanded', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: false },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'alignment', label: 'Alignment', type: 'text', default: '' },
      { key: 'leader', label: 'Leader', type: 'tags', default: [] },
      { key: 'goals', label: 'Goals', type: 'textarea', default: '' },
      { key: 'enemies', label: 'Enemies', type: 'tags', default: [] },
      { key: 'allies', label: 'Allies', type: 'tags', default: [] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  religion: {
    label: 'Religion',
    icon: 'Cross',
    drillDown: 'hierarchy',
    statusFlags: {
      active: { label: 'Active', offLabel: 'Defunct', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: false },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'deity', label: 'Deity / Pantheon', type: 'text', default: '' },
      { key: 'dogma', label: 'Dogma', type: 'textarea', default: '' },
      { key: 'leadership', label: 'Leadership', type: 'tags', default: [] },
      { key: 'holySites', label: 'Holy Sites', type: 'tags', default: [] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  event: {
    label: 'Event',
    icon: 'Lightning',
    drillDown: 'eventWeb',
    statusFlags: {
      active: { label: 'Ongoing', offLabel: 'Resolved', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: false },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'date', label: 'Date / Era', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'involvedParties', label: 'Involved Parties', type: 'tags', default: [] },
      { key: 'consequences', label: 'Consequences', type: 'textarea', default: '' },
      { key: 'status', label: 'Status', type: 'select', default: 'active', options: ['active', 'resolved', 'ongoing', 'pending'] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  realm: {
    label: 'Realm',
    icon: 'Crown',
    drillDown: 'hierarchy',
    statusFlags: {
      active: { label: 'Sovereign', offLabel: 'Fallen', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: false },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ruler', label: 'Ruler', type: 'tags', default: [] },
      { key: 'government', label: 'Government', type: 'select', default: 'monarchy', options: ['monarchy', 'oligarchy', 'republic', 'theocracy', 'tribal', 'empire', 'federation', 'anarchy', 'other'] },
      { key: 'capital', label: 'Capital', type: 'tags', default: [] },
      { key: 'territory', label: 'Territory', type: 'textarea', default: '' },
      { key: 'allies', label: 'Allies', type: 'tags', default: [] },
      { key: 'enemies', label: 'Enemies', type: 'tags', default: [] },
      { key: 'notes', label: 'Notes', type: 'textarea', default: '' },
    ],
  },
  thing: {
    label: 'Item',
    icon: 'Sword',
    drillDown: 'detail',
    statusFlags: {
      intact: { label: 'Intact', offLabel: 'Destroyed', default: true },
      revealed: { label: 'Revealed', offLabel: 'Hidden', default: false },
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'owner', label: 'Owner', type: 'tags', default: [] },
      { key: 'location', label: 'Location', type: 'tags', default: [] },
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
  if (!schema?.statusFlags) return { alive: true, active: true, revealed: false };
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
