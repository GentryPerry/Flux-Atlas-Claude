/**
 * Flux Atlas — Cloudflare Worker
 *
 * Handles all /api/* routes. Everything else falls through to the
 * static assets (the built React app in ./dist).
 *
 * Routes:
 *   POST /api/auth/signup   — create account
 *   POST /api/auth/login    — log in, get session token
 *   POST /api/auth/logout   — invalidate session token
 *   GET  /api/auth/me       — validate token, return user info
 *   POST /api/data/save     — save a store blob for a campaign
 *   GET  /api/data/load     — load all store blobs for a campaign
 *   DELETE /api/data/campaign — delete all data for a campaign
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

/** Simple token extraction from Authorization: Bearer <token> */
function getToken(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

/** Validate a session token and return the user_id, or null if invalid/expired */
async function validateSession(token, db) {
  if (!token) return null;
  const row = await db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
    .bind(token)
    .first();
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  return row.user_id;
}

/** Generate a random hex token */
function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generate a random UUID */
function randomUUID() {
  return crypto.randomUUID();
}

/** Hash a password using PBKDF2 (Web Crypto — available in Workers) */
async function hashPassword(password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const salt = randomToken(16); // 16-byte hex salt
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 },
    keyMaterial, 256
  );
  const hash = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

/** Verify a password against a stored hash */
async function verifyPassword(password, stored) {
  const [salt, expectedHash] = stored.split(':');
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 },
    keyMaterial, 256
  );
  const hash = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
  return hash === expectedHash;
}

// Session lasts 30 days
const SESSION_DAYS = 30;

// ─── Route Handlers ──────────────────────────────────────────────────────────

async function handleSignup(request, db) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !email.includes('@')) return err('Valid email required');
  if (password.length < 8) return err('Password must be at least 8 characters');

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return err('An account with that email already exists', 409);

  const id = randomUUID();
  const password_hash = await hashPassword(password);
  await db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .bind(id, email, password_hash).run();

  const token = randomToken();
  const expires_at = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, id, expires_at).run();

  return json({ token, user: { id, email } }, 201);
}

async function handleLogin(request, db) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) return err('Email and password required');

  const user = await db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
    .bind(email).first();
  if (!user) return err('Invalid email or password', 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return err('Invalid email or password', 401);

  const token = randomToken();
  const expires_at = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, user.id, expires_at).run();

  return json({ token, user: { id: user.id, email: user.email } });
}

async function handleLogout(request, db) {
  const token = getToken(request);
  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  return json({ ok: true });
}

async function handleMe(request, db) {
  const token = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const user = await db.prepare('SELECT id, email FROM users WHERE id = ?').bind(userId).first();
  if (!user) return err('User not found', 404);
  return json({ user });
}

/**
 * handleSave — store a JSON blob for a campaign.
 *
 * Metadata (campaignId, store) come from query params so the Worker can read
 * them cheaply. The data payload arrives as a raw JSON string in the request
 * body — the Worker stores it as-is without parsing, keeping CPU usage low
 * even for large payloads (e.g. map data).
 */
async function handleSave(request, db) {
  const token = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');
  const store      = url.searchParams.get('store');
  if (!campaignId || !store) return err('campaignId and store query params required');

  // Read raw body — no JSON.parse in the Worker for potentially large payloads
  const dataStr = await request.text();
  if (!dataStr) return err('Request body required');

  await db.prepare(`
    INSERT INTO campaign_data (user_id, campaign_id, store, data, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT (user_id, campaign_id, store)
    DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).bind(userId, campaignId, store, dataStr).run();

  return json({ ok: true });
}

/**
 * handleLoad — return all store blobs for a campaign.
 *
 * Builds the JSON response by concatenating the raw stored strings directly,
 * so the Worker never has to parse or re-stringify large image payloads.
 */
async function handleLoad(request, db) {
  const token = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');
  if (!campaignId) return err('campaignId required');

  const rows = await db.prepare(
    'SELECT store, data FROM campaign_data WHERE user_id = ? AND campaign_id = ?'
  ).bind(userId, campaignId).all();

  // Build JSON manually — embed stored strings directly without re-parsing them.
  // This keeps Worker CPU near zero regardless of how large the stored data is.
  const parts = rows.results.map(
    (row) => `${JSON.stringify(row.store)}:${row.data}`
  );
  const body = `{${parts.join(',')}}`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ─── R2 Image Handlers ───────────────────────────────────────────────────────

/**
 * POST /api/images/upload
 * Accepts multipart/form-data with a single "file" field.
 * Uploads to R2 under userId/randomKey.ext — returns { url }.
 */
async function handleImageUpload(request, db, r2) {
  const token = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  let formData;
  try { formData = await request.formData(); } catch { return err('Expected multipart/form-data'); }

  const file = formData.get('file');
  if (!file) return err('No file field in form data');

  const ext = (file.name || 'image').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const key = `${userId}/${randomToken(20)}.${ext}`;

  await r2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });

  return json({ url: `/api/images/${key}` }, 201);
}

/**
 * GET /api/images/:userId/:file
 * Serves an image directly from R2. No auth needed — keys are random and unguessable.
 */
async function handleImageGet(request, r2, key) {
  const obj = await r2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(obj.body, { headers });
}

async function handleDeleteCampaign(request, db) {
  const token = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');
  if (!campaignId) return err('campaignId required');

  await db.prepare(
    'DELETE FROM campaign_data WHERE user_id = ? AND campaign_id = ?'
  ).bind(userId, campaignId).run();

  return json({ ok: true });
}

// ─── Main Fetch Handler ──────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only handle /api/* routes — everything else is static assets
    if (!path.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const db = env.flux_atlas_db;
    const r2 = env.flux_atlas_images;

    if (path === '/api/auth/signup' && method === 'POST') return handleSignup(request, db);
    if (path === '/api/auth/login'  && method === 'POST') return handleLogin(request, db);
    if (path === '/api/auth/logout' && method === 'POST') return handleLogout(request, db);
    if (path === '/api/auth/me'     && method === 'GET')  return handleMe(request, db);
    if (path === '/api/data/save'   && method === 'POST') return handleSave(request, db);
    if (path === '/api/data/load'   && method === 'GET')  return handleLoad(request, db);
    if (path === '/api/data/campaign' && method === 'DELETE') return handleDeleteCampaign(request, db);
    if (path === '/api/images/upload' && method === 'POST') return handleImageUpload(request, db, r2);
    if (path.startsWith('/api/images/') && method === 'GET') {
      const key = path.slice('/api/images/'.length);
      return handleImageGet(request, r2, key);
    }

    return err('Not found', 404);
  },
};
