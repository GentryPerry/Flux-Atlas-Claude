/**
 * Behavior profiles — define what kinds of changes each node type can undergo.
 * Custom node types inherit from 'spatial' or 'abstract' defaults unless overridden.
 */

export const BEHAVIOR_PROFILES = {
  character: {
    canDie:                 true,
    canMove:                true,
    canChangeRelationships: true,
  },
  location: {
    canBeDestroyed:   true,
    canBeRepurposed:  true,
  },
  faction: {
    canExpandTerritory:    true,
    canContractTerritory:  true,
    canShiftTerritory:     true,
    canChangeRelationships:true,
  },
  religion: {
    canExpandTerritory:   true,
    canContractTerritory: true,
    canShiftTerritory:    true,
  },
  polity: {
    canExpandTerritory:    true,
    canContractTerritory:  true,
    canShiftTerritory:     true,
    canChangeRelationships:true,
  },
  thing: {
    canMove: true,
  },
  event: {
    canTriggerEvents: true,
  },
};

// Defaults for custom types by kind
export const CUSTOM_TYPE_BEHAVIOR_DEFAULTS = {
  spatial:      { canMove: true, canBeDestroyed: true, canBeRepurposed: true },
  abstract:     { canExpandTerritory: true, canContractTerritory: true, canShiftTerritory: true },
};

/** Returns the behavior profile for a given type id */
export function getBehaviorProfile(typeId, customNodeTypes = []) {
  if (BEHAVIOR_PROFILES[typeId]) return BEHAVIOR_PROFILES[typeId];
  const custom = customNodeTypes.find((c) => c.id === typeId);
  if (custom) {
    return CUSTOM_TYPE_BEHAVIOR_DEFAULTS[custom.kind] || CUSTOM_TYPE_BEHAVIOR_DEFAULTS.spatial;
  }
  return {};
}

/** Annual base rates (P of event per year) — scaled by volatility */
export const ANNUAL_RATES = {
  stable: {
    death:        0.020,
    destroy:      0.008,
    repurpose:    0.012,
    move:         0.035,
    terrExpand:   0.040,
    terrContract: 0.030,
    terrShift:    0.025,
    relChange:    0.030,
  },
  balanced: {
    death:        0.050,
    destroy:      0.022,
    repurpose:    0.035,
    move:         0.075,
    terrExpand:   0.110,
    terrContract: 0.085,
    terrShift:    0.060,
    relChange:    0.070,
  },
  volatile: {
    death:        0.120,
    destroy:      0.065,
    repurpose:    0.085,
    move:         0.150,
    terrExpand:   0.280,
    terrContract: 0.220,
    terrShift:    0.150,
    relChange:    0.150,
  },
};

/** P(at least one event occurring in Y years) = 1 - (1 - ratePerYear)^Y */
export function annualRateToProbability(ratePerYear, years) {
  return 1 - Math.pow(1 - Math.min(ratePerYear, 0.9999), Math.max(years, 0.001));
}

/** Possible "repurpose" transformations by locationType */
export const REPURPOSE_MAP = {
  city:      ['ruin', 'town', 'outpost'],
  town:      ['ruin', 'city', 'outpost', 'hideout'],
  district:  ['ruin', 'landmark', 'building'],
  landmark:  ['ruin', 'building', 'shrine'],
  building:  ['ruin', 'landmark'],
  territory: ['ruin', 'outpost'],
  outpost:   ['ruin', 'fortress', 'hideout'],
  port:      ['ruin', 'outpost', 'city'],
  crossing:  ['ruin', 'outpost', 'bridge'],
  hideout:   ['ruin', 'outpost', 'shrine'],
  other:     ['ruin', 'outpost'],
};

export function getRepurposeTarget(currentType, rng) {
  const options = REPURPOSE_MAP[currentType] || ['ruin', 'outpost'];
  return options[Math.floor(rng() * options.length)];
}
