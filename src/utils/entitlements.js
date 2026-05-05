/**
 * Flux Atlas — Entitlement API client
 *
 * Thin wrappers around /api/account/status and /api/usage/record.
 * All UI components should read limits from the account status rather
 * than hard-coding plan values — this lets backend config drive the UI.
 */

import { getToken } from './api';

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/**
 * Fetch the current user's plan, usage, and limits.
 * Returns the full status object or throws on error.
 *
 * Shape:
 * {
 *   plan: { key, status, name },
 *   usage: {
 *     campaigns:          { used, limit },
 *     nodes:              { used, limit },
 *     storage:            { usedBytes, limitBytes },
 *     customNodeTypes:    { used, limit },
 *     troubleGenerations: { used, limit, periodEnd },
 *     fluxGenerations:    { used, limit, periodEnd },
 *     boardHistory:       { visibleEntries, canRestore },
 *   }
 * }
 */
export async function fetchAccountStatus() {
  const res = await fetch('/api/account/status', {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Failed to load account status');
  return data;
}

/**
 * Record a Trouble or Flux generation against the monthly counter.
 * Throws a structured error if the limit is reached:
 *   error.code       — e.g. 'TROUBLE_LIMIT_REACHED'
 *   error.limit      — the numeric limit
 *   error.currentUsage
 *   error.planKey
 *
 * Call this BEFORE allowing the user to generate, so the UI can gate
 * the action rather than rejecting after the fact.
 */
export async function recordUsage(type) {
  const res = await fetch('/api/usage/record', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ type }),
  });
  const data = await res.json();
  if (!res.ok) {
    const e = new Error(data?.error?.message || 'Usage limit reached');
    Object.assign(e, data?.error || {});
    throw e;
  }
  return data; // { ok, used, limit }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** Format bytes as "37 MB" or "1.2 GB" */
export function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** 0–1 fraction for a usage bar. null limit = 0 (unlimited, no bar) */
export function usageFraction(used, limit) {
  if (!limit) return 0;
  return Math.min(1, used / limit);
}

/** CSS color for a usage bar based on how full it is */
export function usageColor(fraction) {
  if (fraction >= 1)    return 'var(--danger)';
  if (fraction >= 0.85) return 'var(--warning)';
  return 'var(--accent)';
}

/** Human-readable limit string: "47 / 100" or "47 / Unlimited" */
export function usageLabel(used, limit) {
  if (limit === null || limit === undefined) return `${used} / Unlimited`;
  return `${used} / ${limit}`;
}
