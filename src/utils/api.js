/**
 * Flux Atlas — API client
 *
 * Thin wrapper around the Cloudflare Worker /api/* endpoints.
 * Stores the session token in localStorage (just the token string —
 * not campaign data) so the user stays logged in across page refreshes.
 */

const TOKEN_KEY = 'flux_session_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra = {}) {
  const h = { ...extra };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(method, path, body = null) {
  const headers = authHeaders({ 'Content-Type': 'application/json' });

  const res = await fetch(path, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function signup(email, password) {
  const data = await request('POST', '/api/auth/signup', { email, password });
  setToken(data.token);
  return data.user;
}

export async function login(email, password) {
  const data = await request('POST', '/api/auth/login', { email, password });
  setToken(data.token);
  return data.user;
}

export async function logout() {
  try { await request('POST', '/api/auth/logout'); } catch { /* ignore */ }
  setToken(null);
}

export async function getMe() {
  try {
    const data = await request('GET', '/api/auth/me');
    return data.user;
  } catch {
    setToken(null);
    return null;
  }
}

// ─── Data ─────────────────────────────────────────────────────────────────────
//
// saveStore sends metadata as query params and the data as a raw JSON string
// in the request body. This means the Worker never has to parse large JSON
// payloads — it stores the string as-is. Parsing happens in the browser.

export async function saveStore(campaignId, store, data) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(
    `/api/data/save?campaignId=${encodeURIComponent(campaignId)}&store=${encodeURIComponent(store)}`,
    { method: 'POST', headers, body: JSON.stringify(data) }
  );

  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Save failed');
  return result;
}

// In-flight deduplicator: if multiple stores call loadCampaign for the same
// campaignId simultaneously (as happens on every campaign switch), they all
// receive the same promise rather than firing 9 separate network requests.
const _inFlightLoads = new Map(); // campaignId → Promise

export async function loadCampaign(campaignId) {
  if (_inFlightLoads.has(campaignId)) {
    return _inFlightLoads.get(campaignId);
  }

  const promise = (async () => {
    const res = await fetch(
      `/api/data/load?campaignId=${encodeURIComponent(campaignId)}`,
      { headers: authHeaders() }
    );
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || 'Load failed');
    }
    // Response values are raw JSON strings (not parsed by the Worker).
    // Parse each store's data here in the browser.
    const raw = await res.json();
    const result = {};
    for (const [key, val] of Object.entries(raw)) {
      try { result[key] = typeof val === 'string' ? JSON.parse(val) : val; }
      catch { result[key] = val; }
    }
    return result;
  })();

  _inFlightLoads.set(campaignId, promise);
  promise.finally(() => _inFlightLoads.delete(campaignId));
  return promise;
}

export async function deleteCampaignData(campaignId) {
  return request('DELETE', `/api/data/campaign?campaignId=${encodeURIComponent(campaignId)}`);
}

// ─── Images ───────────────────────────────────────────────────────────────────

/**
 * Upload a File or Blob to R2. Returns the /api/images/... URL.
 * Use this instead of FileReader/readAsDataURL everywhere images are uploaded.
 */
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/images/upload', {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Image upload failed');
  return data.url; // e.g. /api/images/userid/abc123.jpg
}

export { getToken, setToken };
