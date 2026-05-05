/**
 * useAccountStatus — fetches and caches the current user's plan/usage/limits.
 *
 * Usage:
 *   const { status, loading, error, refresh } = useAccountStatus();
 *
 * Returns null while loading or if unauthenticated.
 * Automatically refreshes whenever `refreshKey` changes (call refresh() to trigger).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAccountStatus } from '../utils/entitlements';
import { useAuth } from '../context/AuthContext';

const CACHE_TTL_MS = 30_000; // re-fetch if stale after 30 s

let _cache      = null;
let _cacheTime  = 0;
const _listeners = new Set();

function notifyListeners() {
  _listeners.forEach((fn) => fn());
}

export default function useAccountStatus() {
  const { user } = useAuth();
  const [status,  setStatus]  = useState(_cache);
  const [loading, setLoading] = useState(!_cache && !!user);
  const [error,   setError]   = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (force = false) => {
    if (!user) { setStatus(null); setLoading(false); return; }

    // Use cache if fresh and not forced
    if (!force && _cache && Date.now() - _cacheTime < CACHE_TTL_MS) {
      setStatus(_cache);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccountStatus();
      _cache     = data;
      _cacheTime = Date.now();
      notifyListeners();
      if (mountedRef.current) { setStatus(data); setLoading(false); }
    } catch (e) {
      if (mountedRef.current) { setError(e.message); setLoading(false); }
    }
  }, [user]);

  // Subscribe so all mounted consumers update when any one calls refresh
  useEffect(() => {
    const handler = () => {
      if (mountedRef.current) setStatus(_cache);
    };
    _listeners.add(handler);
    return () => _listeners.delete(handler);
  }, []);

  // Load on mount or when user changes
  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { status, loading, error, refresh };
}

/**
 * Invalidate the shared cache so the next consumer that mounts
 * or calls refresh() will re-fetch. Call after recordUsage(), etc.
 */
export function invalidateAccountStatus() {
  _cache     = null;
  _cacheTime = 0;
  notifyListeners();
}

/**
 * Synchronous read of the cached status — safe to call from Zustand stores.
 * Returns null if not yet loaded.
 */
export function getCachedStatus() {
  return _cache;
}
