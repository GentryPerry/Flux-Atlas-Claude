/**
 * Time Engine — generates scenario proposals from a source world state.
 *
 * Entry point: generateScenarios(params) → ScenarioProposal[]
 *
 * Pure function — no side effects, no store access.
 * All randomness is seeded and deterministic.
 */

import {
  getBehaviorProfile,
  ANNUAL_RATES,
  annualRateToProbability,
  getRepurposeTarget,
} from './behaviorProfiles';

// ── Seeded PRNG (xorshift32) ──────────────────────────────────────────────────

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRNG(seed) {
  let s = hashStr(String(seed)) | 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Time factors ─────────────────────────────────────────────────────────────

export const TIMEFRAME_LABELS = {
  '1_month':  '1 Month',
  '6_months': '6 Months',
  '1_year':   '1 Year',
  '3_years':  '3 Years',
  '10_years': '10 Years',
};

export function getYearsFromDelta(timeDelta) {
  const map = {
    '1_month':  1 / 12,
    '6_months': 0.5,
    '1_year':   1,
    '3_years':  3,
    '10_years': 10,
  };
  if (timeDelta.preset === 'custom') return timeDelta.customYears || 11;
  return map[timeDelta.preset] || 1;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function polygonCentroid(points) {
  if (!points?.length) return { x: 0, y: 0 };
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

function scalePolygon(points, factor, centroid) {
  const c = centroid || polygonCentroid(points);
  return points.map((p) => ({
    x: c.x + (p.x - c.x) * factor,
    y: c.y + (p.y - c.y) * factor,
  }));
}

function shiftPolygon(points, dx, dy) {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

// ── Severity classification ───────────────────────────────────────────────────

function classifySeverity(type) {
  const critical = ['node.died', 'node.destroyed'];
  const major    = ['territory.expanded', 'territory.contracted', 'node.repurposed'];
  const moderate = ['territory.shifted', 'relationship.updated'];
  if (critical.includes(type)) return 'critical';
  if (major.includes(type))    return 'major';
  if (moderate.includes(type)) return 'moderate';
  return 'minor';
}

function requiresApproval(type, severity) {
  return severity === 'critical' || type === 'node.repurposed';
}

// ── Change proposal builders ──────────────────────────────────────────────────

function makeDiedProposal(node) {
  return {
    id: `died-${node.id}`,
    type: 'node.died',
    targetNodeId: node.id,
    targetNodeName: node.fields?.name || 'Unknown',
    title: `${node.fields?.name || 'Unknown'} dies`,
    description: `${node.fields?.name || 'This character'} has perished over the passing of time.`,
    severity: 'critical',
    requiresApproval: true,
    before: { statusFlags: { ...node.statusFlags } },
    after:  { statusFlags: { ...node.statusFlags, alive: false } },
  };
}

function makeDestroyedProposal(node) {
  return {
    id: `destroyed-${node.id}`,
    type: 'node.destroyed',
    targetNodeId: node.id,
    targetNodeName: node.fields?.name || 'Unknown',
    title: `${node.fields?.name || 'Unknown'} is destroyed`,
    description: `${node.fields?.name || 'This location'} falls to ruin.`,
    severity: 'critical',
    requiresApproval: true,
    before: { statusFlags: { ...node.statusFlags } },
    after:  { statusFlags: { ...node.statusFlags, active: false } },
  };
}

function makeRepurposedProposal(node, newType) {
  const oldType = node.fields?.locationType || 'unknown';
  return {
    id: `repurposed-${node.id}`,
    type: 'node.repurposed',
    targetNodeId: node.id,
    targetNodeName: node.fields?.name || 'Unknown',
    title: `${node.fields?.name || 'Unknown'} repurposed`,
    description: `${node.fields?.name || 'This location'} transforms from a ${oldType} to a ${newType}.`,
    severity: 'major',
    requiresApproval: true,
    before: { fields: { locationType: oldType } },
    after:  { fields: { locationType: newType } },
    meta: { newLocationType: newType },
  };
}

function makeTerritoryExpandedProposal(node, territory, newPoints, factor) {
  return {
    id: `terrexp-${territory?.id || node.id}`,
    type: 'territory.expanded',
    targetNodeId: node.id,
    targetNodeName: node.fields?.name || 'Unknown',
    territoryId: territory?.id,
    title: `${node.fields?.name || 'Unknown'} expands`,
    description: `${node.fields?.name || 'This faction'}'s territory grows by roughly ${Math.round((factor - 1) * 100)}%.`,
    severity: 'major',
    requiresApproval: false,
    before: { points: territory?.points },
    after:  { points: newPoints },
    meta: { newPoints, factor },
  };
}

function makeTerritoryContractedProposal(node, territory, newPoints, factor) {
  return {
    id: `terrcnt-${territory?.id || node.id}`,
    type: 'territory.contracted',
    targetNodeId: node.id,
    targetNodeName: node.fields?.name || 'Unknown',
    territoryId: territory?.id,
    title: `${node.fields?.name || 'Unknown'} contracts`,
    description: `${node.fields?.name || 'This faction'}'s territory shrinks by roughly ${Math.round((1 - factor) * 100)}%.`,
    severity: 'major',
    requiresApproval: false,
    before: { points: territory?.points },
    after:  { points: newPoints },
    meta: { newPoints, factor },
  };
}

function makeTerritoryShiftedProposal(node, territory, newPoints) {
  return {
    id: `terrshf-${territory?.id || node.id}`,
    type: 'territory.shifted',
    targetNodeId: node.id,
    targetNodeName: node.fields?.name || 'Unknown',
    territoryId: territory?.id,
    title: `${node.fields?.name || 'Unknown'} boundary shifts`,
    description: `${node.fields?.name || 'This faction'}'s territorial boundary shifts position.`,
    severity: 'moderate',
    requiresApproval: false,
    before: { points: territory?.points },
    after:  { points: newPoints },
    meta: { newPoints },
  };
}

// ── Narrative generation ──────────────────────────────────────────────────────

function generateNarrative(changes, years, volatility) {
  const deaths     = changes.filter((c) => c.type === 'node.died');
  const destroyed  = changes.filter((c) => c.type === 'node.destroyed');
  const repurposed = changes.filter((c) => c.type === 'node.repurposed');
  const expanded   = changes.filter((c) => c.type === 'territory.expanded');
  const contracted = changes.filter((c) => c.type === 'territory.contracted');
  const shifted    = changes.filter((c) => c.type === 'territory.shifted');

  const timeDesc =
    years < 1   ? `${Math.round(years * 12)} month${Math.round(years * 12) !== 1 ? 's' : ''}` :
    years === 1 ? 'a year' :
    years < 2   ? 'over a year' :
    `${Math.round(years)} years`;

  const parts = [];

  const volDesc = { stable: 'relatively stable', balanced: 'eventful', volatile: 'turbulent' }[volatility];

  parts.push(`Over the course of ${timeDesc}, the world undergoes ${volDesc} change.`);

  if (deaths.length === 1) {
    parts.push(`${deaths[0].targetNodeName} has perished.`);
  } else if (deaths.length > 1) {
    parts.push(`${deaths.length} notable figures have perished, including ${deaths[0].targetNodeName}.`);
  }

  if (destroyed.length === 1) {
    parts.push(`${destroyed[0].targetNodeName} has been reduced to ruin.`);
  } else if (destroyed.length > 1) {
    parts.push(`${destroyed.length} locations have been destroyed.`);
  }

  if (repurposed.length > 0) {
    parts.push(`${repurposed.length} location${repurposed.length > 1 ? 's have' : ' has'} changed purpose.`);
  }

  if (expanded.length > 0 && contracted.length === 0) {
    parts.push(`Several powers have expanded their reach.`);
  } else if (contracted.length > 0 && expanded.length === 0) {
    parts.push(`Several powers have retreated or weakened.`);
  } else if (expanded.length > 0 && contracted.length > 0) {
    parts.push(`The balance of power has shifted — some powers grow while others wane.`);
  }

  if (changes.length === 0) {
    parts.push(`The world remains largely unchanged.`);
  }

  return parts.join(' ');
}

// ── Scenario title generation ─────────────────────────────────────────────────

const STABLE_TITLES = [
  'The Quiet Years', 'Slow Drift', 'A Steady Age', 'The Long Peace', 'Gradual Change',
  'The Settling', 'Embers of Change',
];
const BALANCED_TITLES = [
  'Shifting Tides', 'The Turning', 'A World in Motion', 'The Changing Age',
  'Ripples Across Time', 'The Transition', 'Crossroads',
];
const VOLATILE_TITLES = [
  'The Upheaval', 'An Age of Chaos', 'Fire and Ruin', 'The Fractured Age',
  'Collapse and Rebirth', 'The Great Unraveling', 'Storm Breaks', 'The Breaking',
];

function pickTitle(volatility, rng, index) {
  const pool = volatility === 'stable' ? STABLE_TITLES :
               volatility === 'volatile' ? VOLATILE_TITLES : BALANCED_TITLES;
  // Offset pool by scenario index so cards feel distinct
  return pool[(Math.floor(rng() * pool.length) + index) % pool.length];
}

// ── Apply change proposals to world state ─────────────────────────────────────

function applyChangesToWorldState(sourceWorldState, approvedChanges) {
  let nodes       = JSON.parse(JSON.stringify(sourceWorldState.nodes));
  let territories = JSON.parse(JSON.stringify(sourceWorldState.territories));

  for (const change of approvedChanges) {
    if (change.type === 'node.died') {
      nodes = nodes.map((n) =>
        n.id === change.targetNodeId
          ? { ...n, statusFlags: { ...n.statusFlags, alive: false } }
          : n
      );
    } else if (change.type === 'node.destroyed') {
      nodes = nodes.map((n) =>
        n.id === change.targetNodeId
          ? { ...n, statusFlags: { ...n.statusFlags, active: false } }
          : n
      );
    } else if (change.type === 'node.repurposed') {
      nodes = nodes.map((n) =>
        n.id === change.targetNodeId
          ? { ...n, fields: { ...n.fields, locationType: change.meta?.newLocationType } }
          : n
      );
    } else if (change.type === 'node.moved') {
      if (change.meta?.newParentNodeId !== undefined) {
        nodes = nodes.map((n) =>
          n.id === change.targetNodeId
            ? { ...n, parentNodeId: change.meta.newParentNodeId }
            : n
        );
      }
    } else if (
      change.type === 'territory.expanded' ||
      change.type === 'territory.contracted' ||
      change.type === 'territory.shifted'
    ) {
      if (change.territoryId && change.meta?.newPoints) {
        territories = territories.map((t) =>
          t.id === change.territoryId
            ? { ...t, points: change.meta.newPoints }
            : t
        );
      }
    }
  }

  return { nodes, territories };
}

// ── Core scenario generator ───────────────────────────────────────────────────

function generateOneScenario(sourceWorldState, years, volatility, seed, index, customNodeTypes = []) {
  const rng = createRNG(`${seed}-${index}-${volatility}`);
  const rates = ANNUAL_RATES[volatility];
  const allChanges = [];

  const { nodes, territories } = sourceWorldState;

  // Build a quick lookup: nodeId → territories for that node
  const terrByNode = {};
  for (const t of territories) {
    if (t.nodeId) {
      if (!terrByNode[t.nodeId]) terrByNode[t.nodeId] = [];
      terrByNode[t.nodeId].push(t);
    }
  }

  for (const node of nodes) {
    const profile = getBehaviorProfile(node.type, customNodeTypes);
    const locks   = node.locks || {};
    if (locks.fullLock) continue;

    // ── Characters: may die ──
    if (profile.canDie && !locks.deathLock) {
      const isAlive = node.statusFlags?.alive !== false;
      if (isAlive && rng() < annualRateToProbability(rates.death, years)) {
        allChanges.push(makeDiedProposal(node));
        continue; // dead characters don't do other things
      }
    }

    // ── Characters: may move ──
    if (profile.canMove && !locks.movementLock) {
      const locationNodes = nodes.filter(
        (n) => n.type === 'location' && n.mapId === node.mapId && n.id !== node.parentNodeId
      );
      if (locationNodes.length > 0 && rng() < annualRateToProbability(rates.move, years)) {
        const dest = locationNodes[Math.floor(rng() * locationNodes.length)];
        allChanges.push({
          id: `moved-${node.id}`,
          type: 'node.moved',
          targetNodeId: node.id,
          targetNodeName: node.fields?.name || 'Unknown',
          title: `${node.fields?.name || 'Unknown'} relocates`,
          description: `${node.fields?.name || 'This entity'} moves to ${dest.fields?.name || 'a new location'}.`,
          severity: 'minor',
          requiresApproval: false,
          before: { parentNodeId: node.parentNodeId },
          after:  { parentNodeId: dest.id },
          meta: { newParentNodeId: dest.id },
        });
      }
    }

    // ── Locations: may be destroyed ──
    if (profile.canBeDestroyed && !locks.destructionLock) {
      const isActive = node.statusFlags?.active !== false;
      if (isActive && rng() < annualRateToProbability(rates.destroy, years)) {
        allChanges.push(makeDestroyedProposal(node));
        continue;
      }
    }

    // ── Locations: may be repurposed ──
    if (profile.canBeRepurposed && !locks.repurposeLock) {
      const isActive = node.statusFlags?.active !== false;
      const currentType = node.fields?.locationType;
      if (isActive && currentType && rng() < annualRateToProbability(rates.repurpose, years)) {
        const newType = getRepurposeTarget(currentType, rng);
        allChanges.push(makeRepurposedProposal(node, newType));
      }
    }

    // ── Territorial nodes: territory may change ──
    const nodeTerritories = terrByNode[node.id] || [];
    for (const territory of nodeTerritories) {
      if (locks.territoryLock) break;
      if (territory.shapeType !== 'polygon' || !territory.points?.length) continue;

      const terrRoll = rng();
      const expandP   = annualRateToProbability(rates.terrExpand, years);
      const contractP = annualRateToProbability(rates.terrContract, years);
      const shiftP    = annualRateToProbability(rates.terrShift, years);

      if (profile.canExpandTerritory && terrRoll < expandP) {
        const factor = 1.12 + rng() * 0.23; // 12–35% growth
        const newPoints = scalePolygon(territory.points, factor);
        allChanges.push(makeTerritoryExpandedProposal(node, territory, newPoints, factor));
      } else if (profile.canContractTerritory && terrRoll < expandP + contractP) {
        const factor = 0.62 + rng() * 0.23; // 15–38% shrink
        const newPoints = scalePolygon(territory.points, factor);
        allChanges.push(makeTerritoryContractedProposal(node, territory, newPoints, factor));
      } else if (profile.canShiftTerritory && terrRoll < expandP + contractP + shiftP) {
        // Shift by up to 8% of the bounding box
        const xs = territory.points.map((p) => p.x);
        const ys = territory.points.map((p) => p.y);
        const bboxW = Math.max(...xs) - Math.min(...xs);
        const bboxH = Math.max(...ys) - Math.min(...ys);
        const dx = (rng() - 0.5) * bboxW * 0.16;
        const dy = (rng() - 0.5) * bboxH * 0.16;
        const newPoints = shiftPolygon(territory.points, dx, dy);
        allChanges.push(makeTerritoryShiftedProposal(node, territory, newPoints));
      }
    }
  }

  // Deduplicate — same node can only have one major fate
  const seen = new Set();
  const deduped = [];
  for (const c of allChanges) {
    const key = `${c.targetNodeId}-${c.type.split('.')[0]}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(c); }
  }

  const majorTypes   = new Set(['node.died','node.destroyed','node.repurposed','territory.expanded','territory.contracted']);
  const majorChanges  = deduped.filter((c) => majorTypes.has(c.type));
  const granularChanges = deduped.filter((c) => !majorTypes.has(c.type));
  const approvalItems = deduped.filter((c) => c.requiresApproval);

  // Build preview world state (all changes applied)
  const resultingWorldState = applyChangesToWorldState(sourceWorldState, deduped);

  // Build map preview data
  const mapPreviewData = {
    expandedTerritoryIds:  deduped.filter((c) => c.type === 'territory.expanded').map((c) => c.territoryId).filter(Boolean),
    contractedTerritoryIds:deduped.filter((c) => c.type === 'territory.contracted').map((c) => c.territoryId).filter(Boolean),
    shiftedTerritoryIds:   deduped.filter((c) => c.type === 'territory.shifted').map((c) => c.territoryId).filter(Boolean),
    destroyedNodeIds:      deduped.filter((c) => c.type === 'node.destroyed').map((c) => c.targetNodeId),
    diedNodeIds:           deduped.filter((c) => c.type === 'node.died').map((c) => c.targetNodeId),
    // Updated territory points for preview
    territoryUpdates: deduped
      .filter((c) => c.territoryId && c.meta?.newPoints)
      .map((c) => ({ id: c.territoryId, points: c.meta.newPoints, type: c.type })),
  };

  return {
    id:          `scenario-${index}-${seed}`,
    title:       pickTitle(volatility, rng, index),
    volatility,
    summary:     generateNarrative(deduped, years, volatility),
    majorChanges,
    granularChanges,
    approvalItems,
    allChanges:  deduped,
    mapPreviewData,
    resultingWorldState,
    seed:        `${seed}-${index}`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate scenario proposals from a source world state.
 *
 * @param {object} params
 * @param {object} params.sourceWorldState - { nodes, territories }
 * @param {object} params.timeDelta        - { preset, customYears? }
 * @param {Array}  params.scenarioSettings - [{ id, volatility }]
 * @param {string} params.customNodeTypes  - for custom type behavior
 * @returns {ScenarioProposal[]}
 */
export function generateScenarios({ sourceWorldState, timeDelta, scenarioSettings, customNodeTypes = [] }) {
  const years = getYearsFromDelta(timeDelta);
  const seed  = Date.now().toString(36);

  return scenarioSettings.map((settings, i) =>
    generateOneScenario(
      sourceWorldState,
      years,
      settings.volatility,
      seed,
      i,
      customNodeTypes,
    )
  );
}

/** Apply a set of approved changes to a world state and return the new state */
export { applyChangesToWorldState };
