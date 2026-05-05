/**
 * Central icon registry — covers all ~1500 Phosphor icons.
 * Uses a namespace import so resolveIcon() works for any Phosphor icon name.
 */
import * as PhosphorIcons from '@phosphor-icons/react';

// Excluded non-icon exports
const EXCLUDED = new Set(['IconContext', 'IconBase', 'SSR']);

// All icon components keyed by name.
// Phosphor exports both `Sword` and `SwordIcon` (identical) — keep only the clean name.
// forwardRef components are objects, not functions, so we check val != null instead.
export const ICON_REGISTRY = Object.fromEntries(
  Object.entries(PhosphorIcons).filter(
    ([name, val]) =>
      !EXCLUDED.has(name) &&
      /^[A-Z]/.test(name) &&
      !name.endsWith('Icon') &&
      val != null
  )
);

/** Sorted list of all icon names — used by the icon picker */
export const ALL_ICON_NAMES = Object.keys(ICON_REGISTRY).sort();

/**
 * Resolve an icon component by string name.
 * Falls back to UserCircle for unknown names.
 */
export function resolveIcon(iconName) {
  return ICON_REGISTRY[iconName] || PhosphorIcons.UserCircle;
}
