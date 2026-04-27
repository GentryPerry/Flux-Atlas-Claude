import { useState, useMemo, useCallback } from 'react';
import { X, Plus, MagnifyingGlass, Rows, LinkSimple, Trash, ArrowSquareOut } from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import useSettingsStore from '../../stores/settingsStore';
import {
  NODE_TYPES, NESTING_RULES, canNestType,
  isAbstractType, getTagAssignmentField,
} from '../../utils/nodeSchemas';
import { resolveIcon } from '../../utils/iconRegistry';
import { getTypeColor, getTypeLabel, getTypeIcon } from '../../utils/typeColors';

/**
 * Board columns come in two flavours:
 *
 *  { kind: 'ent