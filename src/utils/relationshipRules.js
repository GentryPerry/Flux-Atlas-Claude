/**
 * relationshipRules.js
 *
 * Canonical lookup table for kanban drag relationships between node types.
 * Used by MobileBoardView (and optionally KanbanBoard) to determine what
 * happens when a user drags one node onto another.
 *
 * NOTE: Built-in type IDs match the codebase — 'character' (NPC), 'thing' (Item).
 *
 * Rule fields:
 *   allowed           — whether this drag is permitted
 *   relationshipKind  — 'nesting' | 'tagging' | 'manual'
 *   cardinality       — 'exclusive' | 'open'
 *   promptBehavior    — 'none' | 'move-or-link' | 'manual'
 *   defaultLabel      — human-readable label for the relationship
 *   mapEffect         — 'update-parent' | 'none'
 *   notes             — dev-facing clarification
 */

// ── Rule table ────────────────────────────────────────────────────────────────

export const relationshipRules = {
  character: {
    location: {
      allowed: true,
      relationshipKind: 'nesting',
      cardinality: 'exclusive',
      promptBehavior: 'none',
      defaultLabel: 'located in',
      mapEffect: 'update-parent',
      notes: 'NPC is moved into the destination Location on the map.',
    },
    faction: {
      allowed: true,
      relationshipKind: 'tagging',
      cardinality: 'open',
      promptBehavior: 'move-or-link',
      defaultLabel: 'member of',
      mapEffect: 'none',
      notes: 'NPC joins the destination Faction. Prompt: move from existing or also link.',
    },
    religion: {
      allowed: true,
      relationshipKind: 'tagging',
      cardinality: 'exclusive',
      promptBehavior: 'none',
      defaultLabel: 'follows',
      mapEffect: 'none',
      notes: 'NPC follows the destination Religion. Exclusive — replaces previous religion.',
    },
    polity: {
      allowed: true,
      relationshipKind: 'tagging',
      cardinality: 'open',
      promptBehavior: 'move-or-link',
      defaultLabel: 'affiliated with',
      mapEffect: 'none',
      notes: 'NPC is affiliated with the destination Polity. Prompt: move or also link.',
    },
    character: { allowed: false, notes: 'NPC-to-NPC kanban drag not supported.' },
    thing:     { allowed: false, notes: 'NPCs are not dragged into Items. Use Item → NPC.' },
    event: {
      allowed: true,
      relationshipKind: 'manual',
      cardinality: 'open',
      promptBehavior: 'manual',
      defaultLabel: 'related to',
      mapEffect: 'none',
      notes: 'Manual / user-defined relationship.',
    },
  },

  location: {
    location: {
      allowed: true,
      relationshipKind: 'nesting',
      cardinality: 'exclusive',
      promptBehavior: 'none',
      defaultLabel: 'sub-location of',
      mapEffect: 'update-parent',
      notes: 'Location becomes a sub-location of the destination Location.',
    },
    faction: {
      allowed: true,
      relationshipKind: 'tagging',
      cardinality: 'exclusive',
      promptBehavior: 'none',
      defaultLabel: 'controlled by',
      mapEffect: 'none',
      notes: 'Location is controlled by the destination Faction. Exclusive — replaces previous.',
    },
    religion: {
      allowed: true,
      relationshipKind: 'tagging',
      cardinality: 'exclusive',
      promptBehavior: 'none',
      defaultLabel: 'sacred to',
      mapEffect: 'none',
      notes: 'Location has one primary religious association. Exclusive — replaces previous.',
    },
    polity: {
      allowed: true,
      relationshipKind: 'tagging',
      cardinality: 'open',
      promptBehavior: 'move-or-link',
      defaultLabel: 'governed by',
      mapEffect: 'none',
      notes: 'Location is governed by the destination Polity. Prompt: move or also link.',
    },
    character: { allowed: false, notes: 'Locations are not dragged into NPCs.' },
    thing:     { allowed: false, notes: 'Locations are not dragged into Items.' },
    event: {
      allowed: true,
      relationshipKind: 'manual',
      cardinality: 'open',
      promptBehavior: 'manual',
      defaultLabel: 'related to',
      mapEffect: 'none',
      notes: 'Manual / user-defined relationship.',
    },
  },

  thing: {
    character: {
      allowed: true,
      relationshipKind: 'nesting',
      cardinality: 'exclusive',
      promptBehavior: 'none',
      defaultLabel: 'held by',
      mapEffect: 'update-parent',
      notes: 'Item is held by the destination NPC.',
    },
    location: {
      allowed: true,
      relationshipKind: 'nesting',
      cardinality: 'exclusive',
      promptBehavior: 'none',
      defaultLabel: 'located in',
      mapEffect: 'update-parent',
      notes: 'Item is placed inside the destination Location.',
    },
    faction: {
      allowed: true,
      relationshipKind: 'tagging',
      cardinality: 'exclusive',
      promptBehavior: 'none',
      defaultLabel: 'owned by',
      mapEffect: 'none',
      notes: 'Item is owned by the destination Faction. Exclusive — replaces previous.',
    },
    religion: {
      allowed: true,
      relationshipKind: 'tagging',
      cardinality: 'exclusive',
      promptBehavior: 'none',
      defaultLabel: 'sacred to',
      mapEffect: 'none',
      notes: 'Item is sacred to the destination Religion. Exclusive — replaces previous.',
    },
    polity: {
      allowed: true,
      relationshipKind: 'tagging',
      cardinality: 'exclusive',
      promptBehavior: 'none',
      defaultLabel: 'owned by',
      mapEffect: 'none',
      notes: 'Item is owned by the destination Polity. Exclusive — replaces previous.',
    },
    thing:  { allowed: false, notes: 'Item-to-Item nesting not supported.' },
    event: {
      allowed: true,
      relationshipKind: 'manual',
      cardinality: 'open',
      promptBehavior: 'manual',
      defaultLabel: 'related to',
      mapEffect: 'none',
      notes: 'Manual / user-defined relationship.',
    },
  },

  // Abstract org types are destinations, not drag sources in the kanban.
  faction:  _orgSourceRules('faction'),
  religion: _orgSourceRules('religion'),
  polity:   _orgSourceRules('polity'),

  event: {
    character: _manualRule(),
    location:  _manualRule(),
    faction:   _manualRule(),
    religion:  _manualRule(),
    polity:    _manualRule(),
    thing:     _manualRule(),
    event:     _manualRule(),
  },
};

/** Org types (faction, religion, polity) as drag source — not supported for any type */
function _orgSourceRules(typeName) {
  const disallowedTypes = ['character', 'location', 'thing', 'faction', 'religion', 'polity', 'event'];
  const rules = {};
  for (const t of disallowedTypes) {
    rules[t] = { allowed: false, notes: `${typeName} as drag source is not supported. Use a node → ${typeName} drag instead.` };
  }
  return rules;
}

function _manualRule() {
  return {
    allowed: true,
    relationshipKind: 'manual',
    cardinality: 'open',
    promptBehavior: 'manual',
    defaultLabel: 'related to',
    mapEffect: 'none',
    notes: 'Event relationships are manually interpreted by the user.',
  };
}

// ── Safe rule lookup ──────────────────────────────────────────────────────────

/**
 * Returns the rule for a source→destination pair, or { allowed: false } if not listed.
 */
export function getRule(sourceType, destType) {
  return relationshipRules?.[sourceType]?.[destType] ?? { allowed: false };
}

// ── Relationship existence check ──────────────────────────────────────────────

/**
 * Returns true if a relationship already exists between sourceNode and destinationNode.
 * For nesting: checks parentNodeId.
 * For org membership: checks destinationNode.fields.members.
 */
export function relationshipAlreadyExists(sourceNode, destinationNode, allNodes) {
  const rule = getRule(sourceNode.type, destinationNode.type);
  if (!rule.allowed) return false;

  if (rule.relationshipKind === 'nesting') {
    return sourceNode.parentNodeId === destinationNode.id;
  }

  if (rule.relationshipKind === 'tagging') {
    const members = destinationNode.fields?.members || [];
    return members.includes(sourceNode.id);
  }

  return false;
}

// ── Apply relationship ────────────────────────────────────────────────────────

/**
 * Applies a kanban drag relationship to the store.
 *
 * @param {object} params
 * @param {object} params.sourceNode       — the dragged node
 * @param {object} params.destinationNode  — the drop target
 * @param {'move'|'link'} params.mode      — 'move' removes previous same-type relationship; 'link' adds without removing
 * @param {object[]} params.allNodes       — full node list (for cleanup lookups)
 * @param {string}  params.campaignId
 * @param {function} params.updateNode     — nodeStore.updateNode
 * @param {function} params.updateNodeFields — nodeStore.updateNodeFields
 * @param {function} params.nestNode       — nodeStore.nestNode
 *
 * @returns {{ success: boolean, reason?: string }}
 */
export function applyRelationship({
  sourceNode,
  destinationNode,
  mode = 'move',
  allNodes,
  campaignId,
  updateNode,
  updateNodeFields,
  nestNode,
}) {
  const rule = getRule(sourceNode.type, destinationNode.type);

  if (!rule.allowed) {
    return { success: false, reason: 'This relationship is not allowed.' };
  }

  // Prevent exact duplicate
  if (relationshipAlreadyExists(sourceNode, destinationNode, allNodes)) {
    return { success: false, reason: 'A relationship between these two nodes already exists.' };
  }

  const isExclusive = rule.cardinality === 'exclusive' || mode === 'move';

  // ── Nesting ────────────────────────────────────────────────────────────────
  if (rule.relationshipKind === 'nesting') {
    // Exclusive nesting: unnest from current parent first
    if (isExclusive && sourceNode.parentNodeId) {
      updateNode(campaignId, sourceNode.id, { parentNodeId: null });
    }
    nestNode(campaignId, sourceNode.id, destinationNode.id);
    return { success: true };
  }

  // ── Tagging (org membership) ───────────────────────────────────────────────
  if (rule.relationshipKind === 'tagging') {
    const destType = destinationNode.type;

    // Exclusive: remove sourceNode from all other orgs of the same destType
    if (isExclusive) {
      const orgsOfType = allNodes.filter(
        (n) => n.type === destType && n.id !== destinationNode.id
      );
      for (const org of orgsOfType) {
        const members = org.fields?.members || [];
        if (members.includes(sourceNode.id)) {
          updateNodeFields(campaignId, org.id, {
            members: members.filter((id) => id !== sourceNode.id),
          });
        }
      }
    }

    // Add to destination's members
    const current = destinationNode.fields?.members || [];
    if (!current.includes(sourceNode.id)) {
      updateNodeFields(campaignId, destinationNode.id, {
        members: [...current, sourceNode.id],
      });
    }

    return { success: true };
  }

  // ── Manual ─────────────────────────────────────────────────────────────────
  if (rule.relationshipKind === 'manual') {
    // Manual relationships are lightweight — just add to destination's members
    // if it has a members field, or store on the event's involvedParties field.
    // The UI should open the label editor after this resolves.
    const involvedField = destinationNode.fields?.involvedParties;
    if (Array.isArray(involvedField) && !involvedField.includes(sourceNode.id)) {
      updateNodeFields(campaignId, destinationNode.id, {
        involvedParties: [...involvedField, sourceNode.id],
      });
    }
    return { success: true, manual: true };
  }

  return { success: false, reason: 'Unknown relationship kind.' };
}

// ── Handle drop (entry point for UI) ─────────────────────────────────────────

/**
 * Entry point called directly from drag-and-drop handlers.
 * Returns one of:
 *   { action: 'applied', success }    — relationship applied immediately
 *   { action: 'prompt' }              — UI should show move-or-link prompt
 *   { action: 'denied', reason }      — not allowed
 *
 * When action === 'prompt', call applyRelationship() with mode='move' or 'link'
 * based on the user's choice.
 */
export function handleKanbanDrop({
  sourceNode,
  destinationNode,
  allNodes,
  campaignId,
  updateNode,
  updateNodeFields,
  nestNode,
}) {
  const rule = getRule(sourceNode.type, destinationNode.type);

  if (!rule.allowed) {
    return { action: 'denied', reason: 'This relationship is not allowed.' };
  }

  if (rule.promptBehavior === 'move-or-link') {
    // Check duplicate before prompting
    if (relationshipAlreadyExists(sourceNode, destinationNode, allNodes)) {
      return { action: 'denied', reason: 'A relationship between these two nodes already exists.' };
    }
    return { action: 'prompt', rule, sourceNode, destinationNode };
  }

  if (rule.promptBehavior === 'manual') {
    const result = applyRelationship({
      sourceNode, destinationNode, mode: 'move',
      allNodes, campaignId, updateNode, updateNodeFields, nestNode,
    });
    return { action: 'applied', ...result, manual: true };
  }

  // promptBehavior === 'none' — apply immediately as a move
  const result = applyRelationship({
    sourceNode, destinationNode, mode: 'move',
    allNodes, campaignId, updateNode, updateNodeFields, nestNode,
  });
  return { action: 'applied', ...result };
}
