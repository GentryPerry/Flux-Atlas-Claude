/**
 * Flux Atlas — Cloudflare Worker
 *
 * Routes:
 *   POST   /api/auth/signup                  — create account
 *   POST   /api/auth/login                   — log in, get session token
 *   POST   /api/auth/logout                  — invalidate session token
 *   GET    /api/auth/me                      — validate token, return user info
 *
 *   POST   /api/data/save                    — save a store blob for a campaign
 *   GET    /api/data/load                    — load all store blobs for a campaign
 *   DELETE /api/data/campaign                — delete all data for a campaign
 *
 *   POST   /api/images/upload                — upload image to R2
 *   GET    /api/images/:userId/:file         — serve image from R2
 *   DELETE /api/images/:key                  — soft-delete image, free storage
 *
 *   GET    /api/account/status               — plan, usage, and limits
 *   POST   /api/usage/record                 — record a Trouble or Flux generation
 *
 *   POST   /api/admin/users/:userId/plan     — manually set a user's plan (admin only)
 *   GET    /api/admin/keys                   — list all beta keys (admin only)
 *   POST   /api/admin/keys                   — generate new beta key(s) (admin only)
 *   DELETE /api/admin/keys/:key              — revoke an unused beta key (admin only)
 *
 *   POST   /api/billing/webhook              — future billing webhook (stub)
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

function err(message, status = 400, extra = {}) {
  return json({ error: { message, ...extra } }, status);
}

function limitErr(code, message, limit, currentUsage, planKey) {
  return json({
    error: { code, message, limit, currentUsage, planKey },
  }, 403);
}

function getToken(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomUUID() {
  return crypto.randomUUID();
}

async function hashPassword(password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const salt = randomToken(16);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 },
    keyMaterial, 256
  );
  const hash = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

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

const SESSION_DAYS = 30;

// ─── Session ─────────────────────────────────────────────────────────────────

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

// ─── Entitlements ────────────────────────────────────────────────────────────

/**
 * Load all entitlements for a plan as a key→value map.
 * NULL values from DB become null (unlimited) in JS.
 */
async function getEntitlements(planKey, db) {
  const rows = await db
    .prepare('SELECT entitlement_key, value FROM plan_entitlements WHERE plan_key = ?')
    .bind(planKey)
    .all();
  const map = {};
  for (const row of rows.results) {
    map[row.entitlement_key] = row.value; // null = unlimited
  }
  return map;
}

/**
 * Load a user row with plan info.
 */
async function getUserWithPlan(userId, db) {
  return db
    .prepare('SELECT id, email, plan_key, plan_status FROM users WHERE id = ?')
    .bind(userId)
    .first();
}

/**
 * Get or create the account_usage row for a user.
 * Also resets monthly counters if the period has expired.
 */
async function getOrCreateUsage(userId, db) {
  let usage = await db
    .prepare('SELECT * FROM account_usage WHERE user_id = ?')
    .bind(userId)
    .first();

  if (!usage) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
    await db
      .prepare(`INSERT INTO account_usage (user_id, usage_period_start, usage_period_end)
                VALUES (?, ?, ?)`)
      .bind(userId, periodStart, periodEnd)
      .run();
    usage = await db
      .prepare('SELECT * FROM account_usage WHERE user_id = ?')
      .bind(userId)
      .first();
  }

  // Reset monthly counters if period has rolled over
  if (usage && new Date(usage.usage_period_end) <= new Date()) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
    await db
      .prepare(`UPDATE account_usage
                SET trouble_generations_current_period = 0,
                    flux_generations_current_period    = 0,
                    usage_period_start = ?,
                    usage_period_end   = ?,
                    updated_at = datetime('now')
                WHERE user_id = ?`)
      .bind(periodStart, periodEnd, userId)
      .run();
    usage.trouble_generations_current_period = 0;
    usage.flux_generations_current_period    = 0;
    usage.usage_period_start = periodStart;
    usage.usage_period_end   = periodEnd;
  }

  return usage;
}

/**
 * Check a single entitlement. Returns { allowed, reason, limit, currentUsage }.
 * limit = null means unlimited → always allowed.
 */
function checkLimit(current, limit, errorCode) {
  if (limit === null || limit === undefined) return { allowed: true };
  if (current >= limit) {
    return { allowed: false, reason: errorCode, limit, currentUsage: current };
  }
  return { allowed: true, limit, currentUsage: current };
}

// ─── Auth Handlers ────────────────────────────────────────────────────────────

async function handleSignup(request, db) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const email    = (body.email    || '').trim().toLowerCase();
  const password =  body.password || '';
  const betaKey  = (body.beta_key || '').trim().toUpperCase();

  if (!email || !email.includes('@')) return err('Valid email required');
  if (password.length < 8)           return err('Password must be at least 8 characters');
  if (!betaKey)                       return err('A beta access key is required to sign up', 403);

  // Validate the beta key — must exist and not already be used
  const keyRow = await db
    .prepare('SELECT key, used_by FROM beta_keys WHERE key = ?')
    .bind(betaKey)
    .first();
  if (!keyRow)          return err('That access key is invalid', 403);
  if (keyRow.used_by)   return err('That access key has already been used', 403);

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return err('An account with that email already exists', 409);

  const id            = randomUUID();
  const password_hash = await hashPassword(password);

  await db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .bind(id, email, password_hash).run();

  // Mark the beta key as used
  await db
    .prepare("UPDATE beta_keys SET used_by = ?, used_at = datetime('now') WHERE key = ?")
    .bind(id, betaKey)
    .run();

  // Create usage row for the new user
  const now         = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  await db
    .prepare(`INSERT OR IGNORE INTO account_usage (user_id, usage_period_start, usage_period_end)
              VALUES (?, ?, ?)`)
    .bind(id, periodStart, periodEnd)
    .run();

  const token      = randomToken();
  const expires_at = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, id, expires_at).run();

  return json({ token, user: { id, email, plan_key: 'free' } }, 201);
}

async function handleLogin(request, db) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const email    = (body.email    || '').trim().toLowerCase();
  const password =  body.password || '';

  if (!email || !password) return err('Email and password required');

  const user = await db
    .prepare('SELECT id, email, password_hash, plan_key FROM users WHERE email = ?')
    .bind(email).first();
  if (!user) return err('Invalid email or password', 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid)  return err('Invalid email or password', 401);

  const token      = randomToken();
  const expires_at = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, user.id, expires_at).run();

  return json({ token, user: { id: user.id, email: user.email, plan_key: user.plan_key } });
}

async function handleLogout(request, db) {
  const token = getToken(request);
  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  return json({ ok: true });
}

async function handleMe(request, db) {
  const token  = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const user = await db
    .prepare('SELECT id, email, plan_key, plan_status FROM users WHERE id = ?')
    .bind(userId).first();
  if (!user) return err('User not found', 404);
  return json({ user });
}

// ─── Auto-snapshot ────────────────────────────────────────────────────────────

const AUTO_SNAP_THROTTLE_MS = 30 * 60 * 1000; // 30 minutes
const AUTO_SNAP_SLOTS       = 3;               // keep last 3

/**
 * After a node save, check whether it's time to write a rolling auto-snapshot.
 * Stores up to AUTO_SNAP_SLOTS entries in store='auto_snapshots' for the campaign.
 * Each entry: { id, createdAt, nodeCount, terrCount, nodes[], territories[] }
 *
 * Called fire-and-forget — never throws back to the request handler.
 */
async function maybeAutoSnapshot(userId, campaignId, parsedNodes, db) {
  try {
    // Load existing auto-snapshots
    const existing = await db
      .prepare("SELECT data FROM campaign_data WHERE user_id=? AND campaign_id=? AND store='auto_snapshots'")
      .bind(userId, campaignId)
      .first();

    let snaps = [];
    if (existing) {
      try { snaps = JSON.parse(existing.data); } catch { snaps = []; }
    }

    // Throttle check
    const last = snaps.length > 0 ? snaps[snaps.length - 1] : null;
    if (last && Date.now() - new Date(last.createdAt).getTime() < AUTO_SNAP_THROTTLE_MS) {
      return; // too soon
    }

    // Load territories to include in snapshot
    const terrRow = await db
      .prepare("SELECT data FROM campaign_data WHERE user_id=? AND campaign_id=? AND store='territories'")
      .bind(userId, campaignId)
      .first();
    let territories = [];
    if (terrRow) { try { territories = JSON.parse(terrRow.data); } catch { territories = []; } }

    const snap = {
      id:         randomUUID(),
      createdAt:  new Date().toISOString(),
      nodeCount:  parsedNodes.length,
      terrCount:  territories.length,
      nodes:      parsedNodes,
      territories,
    };

    // Keep last N slots
    snaps = [...snaps, snap].slice(-AUTO_SNAP_SLOTS);

    await db
      .prepare(`INSERT INTO campaign_data (user_id, campaign_id, store, data)
                VALUES (?, ?, 'auto_snapshots', ?)
                ON CONFLICT (user_id, campaign_id, store)
                DO UPDATE SET data = excluded.data, updated_at = datetime('now')`)
      .bind(userId, campaignId, JSON.stringify(snaps))
      .run();
  } catch (e) {
    console.warn('maybeAutoSnapshot failed (non-fatal):', e?.message);
  }
}

// ─── Data Handlers ────────────────────────────────────────────────────────────

/**
 * handleSave — store a JSON blob.
 *
 * Side effects for entitlement-tracked stores:
 *   store='nodes'     → update active_node_count, enforce max_nodes
 *   store='campaigns' (via __meta__) → update active_campaign_count, enforce max_campaigns
 */
async function handleSave(request, db) {
  const token  = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const url        = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');
  const store      = url.searchParams.get('store');
  if (!campaignId || !store) return err('campaignId and store query params required');

  const dataStr = await request.text();
  if (!dataStr) return err('Request body required');

  // ── Entitlement enforcement for tracked stores ──
  if (store === 'nodes') {
    const user  = await getUserWithPlan(userId, db);
    const ents  = await getEntitlements(user.plan_key, db);
    const limit = ents['max_nodes'];

    if (limit !== null && limit !== undefined) {
      let incoming;
      try { incoming = JSON.parse(dataStr); } catch { incoming = null; }
      const count = Array.isArray(incoming) ? incoming.length : 0;

      if (count > limit) {
        return limitErr(
          'NODE_LIMIT_REACHED',
          `Free accounts can create up to ${limit} nodes. Upgrade options are coming soon.`,
          limit, count, user.plan_key
        );
      }
      // Update counter
      await db
        .prepare(`UPDATE account_usage SET active_node_count = ?, updated_at = datetime('now')
                  WHERE user_id = ?`)
        .bind(count, userId)
        .run();
    }
  }


  if (store === 'campaigns' && campaignId === '__meta__') {
    const user  = await getUserWithPlan(userId, db);
    const ents  = await getEntitlements(user.plan_key, db);
    const limit = ents['max_campaigns'];

    if (limit !== null && limit !== undefined) {
      let incoming;
      try { incoming = JSON.parse(dataStr); } catch { incoming = null; }
      const count = Array.isArray(incoming) ? incoming.length : 0;

      if (count > limit) {
        return limitErr(
          'CAMPAIGN_LIMIT_REACHED',
          `Free accounts can create up to ${limit} campaigns. Upgrade options are coming soon.`,
          limit, count, user.plan_key
        );
      }
      await db
        .prepare(`UPDATE account_usage SET active_campaign_count = ?, updated_at = datetime('now')
                  WHERE user_id = ?`)
        .bind(count, userId)
        .run();
    }
  }

  // ── Persist ──
  await db
    .prepare(`INSERT INTO campaign_data (user_id, campaign_id, store, data)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (user_id, campaign_id, store)
              DO UPDATE SET data = excluded.data, updated_at = datetime('now')`)
    .bind(userId, campaignId, store, dataStr)
    .run();

  // ── Rolling auto-snapshot (fire-and-forget, nodes only) ──
  if (store === 'nodes') {
    let parsedForSnap;
    try { parsedForSnap = JSON.parse(dataStr); } catch { parsedForSnap = null; }
    if (Array.isArray(parsedForSnap)) {
      // Don't await — auto-snapshot is best-effort, never blocks the response
      maybeAutoSnapshot(userId, campaignId, parsedForSnap, db).catch(() => {});
    }
  }

  return json({ ok: true });
}

async function handleLoad(request, db) {
  const token  = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const url        = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');
  if (!campaignId) return err('campaignId query param required');

  const rows = await db
    .prepare('SELECT store, data FROM campaign_data WHERE user_id = ? AND campaign_id = ?')
    .bind(userId, campaignId)
    .all();

  const result = {};
  for (const row of rows.results) {
    try { result[row.store] = JSON.parse(row.data); } catch { result[row.store] = null; }
  }
  return json(result);
}

async function handleDeleteCampaign(request, db) {
  const token  = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const url        = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');
  if (!campaignId) return err('campaignId query param required');

  await db
    .prepare('DELETE FROM campaign_data WHERE user_id = ? AND campaign_id = ?')
    .bind(userId, campaignId)
    .run();

  // Recount campaigns from __meta__
  const meta = await db
    .prepare("SELECT data FROM campaign_data WHERE user_id = ? AND campaign_id = '__meta__' AND store = 'campaigns'")
    .bind(userId)
    .first();
  if (meta) {
    try {
      const campaigns = JSON.parse(meta.data);
      const count = Array.isArray(campaigns) ? campaigns.length : 0;
      await db
        .prepare(`UPDATE account_usage SET active_campaign_count = ?, updated_at = datetime('now')
                  WHERE user_id = ?`)
        .bind(count, userId)
        .run();
    } catch { /* ignore */ }
  }

  return json({ ok: true });
}

// ─── Image Handlers ───────────────────────────────────────────────────────────

async function handleImageUpload(request, env, db) {
  const token  = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const formData = await request.formData();
  const file     = formData.get('file');
  if (!file) return err('No file provided');

  const user  = await getUserWithPlan(userId, db);
  const ents  = await getEntitlements(user.plan_key, db);
  const usage = await getOrCreateUsage(userId, db);

  const limitMb  = ents['max_storage_mb'];
  const limitBytes = limitMb !== null && limitMb !== undefined ? limitMb * 1024 * 1024 : null;
  const usedBytes  = usage.storage_bytes_used || 0;

  if (limitBytes !== null && usedBytes + file.size > limitBytes) {
    return limitErr(
      'STORAGE_LIMIT_REACHED',
      `Storage limit reached. Free accounts get ${limitMb} MB.`,
      limitBytes, usedBytes, user.plan_key
    );
  }

  const ext      = (file.name || '').split('.').pop() || 'bin';
  const fileId   = randomUUID();
  const r2Key    = `images/${userId}/${fileId}.${ext}`;
  const arrayBuf = await file.arrayBuffer();

  await env.flux_atlas_images.put(r2Key, arrayBuf, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  await db
    .prepare(`INSERT INTO uploaded_files (id, user_id, storage_key, file_name, mime_type, file_size_bytes)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(fileId, userId, r2Key, file.name || fileId, file.type || 'application/octet-stream', file.size)
    .run();

  await db
    .prepare(`UPDATE account_usage SET storage_bytes_used = storage_bytes_used + ?, updated_at = datetime('now')
              WHERE user_id = ?`)
    .bind(file.size, userId)
    .run();

  return json({ ok: true, key: r2Key, id: fileId, url: `/api/images/${r2Key}` }, 201);
}

async function handleImageServe(request, env) {
  const url    = new URL(request.url);
  const r2Key  = url.pathname.replace('/api/images/', '');
  if (!r2Key)  return err('Key required', 400);

  const obj = await env.flux_atlas_images.get(r2Key);
  if (!obj)  return err('Not found', 404);

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function handleImageDelete(request, env, db) {
  const token  = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const url   = new URL(request.url);
  const r2Key = url.pathname.replace('/api/images/', '');
  if (!r2Key) return err('Key required', 400);

  const file = await db
    .prepare('SELECT id, file_size_bytes, user_id FROM uploaded_files WHERE storage_key = ? AND deleted_at IS NULL')
    .bind(r2Key)
    .first();
  if (!file)              return err('File not found', 404);
  if (file.user_id !== userId) return err('Forbidden', 403);

  await env.flux_atlas_images.delete(r2Key);
  await db
    .prepare(`UPDATE uploaded_files SET deleted_at = datetime('now') WHERE storage_key = ?`)
    .bind(r2Key)
    .run();
  await db
    .prepare(`UPDATE account_usage SET storage_bytes_used = MAX(0, storage_bytes_used - ?), updated_at = datetime('now')
              WHERE user_id = ?`)
    .bind(file.file_size_bytes, userId)
    .run();

  return json({ ok: true });
}

// ─── Account Status ───────────────────────────────────────────────────────────

async function handleAccountStatus(request, db) {
  const token  = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  const user  = await getUserWithPlan(userId, db);
  if (!user)  return err('User not found', 404);

  const ents  = await getEntitlements(user.plan_key, db);
  const usage = await getOrCreateUsage(userId, db);

  // ── Live-count nodes + campaigns directly from blobs (always accurate) ──
  const nodeRows = await db
    .prepare("SELECT data FROM campaign_data WHERE user_id = ? AND store = 'nodes'")
    .bind(userId).all();
  let liveNodeCount = 0;
  for (const row of nodeRows.results) {
    try { const a = JSON.parse(row.data); if (Array.isArray(a)) liveNodeCount += a.length; } catch {}
  }

  const metaRow = await db
    .prepare("SELECT data FROM campaign_data WHERE user_id = ? AND campaign_id = '__meta__' AND store = 'campaigns'")
    .bind(userId).first();
  let liveCampaignCount = 0;
  if (metaRow) {
    try { const a = JSON.parse(metaRow.data); if (Array.isArray(a)) liveCampaignCount = a.length; } catch {}
  }

  // Keep stored counters in sync (fire-and-forget)
  if (liveNodeCount !== (usage.active_node_count ?? 0) || liveCampaignCount !== (usage.active_campaign_count ?? 0)) {
    db.prepare(`UPDATE account_usage SET active_node_count=?, active_campaign_count=?, updated_at=datetime('now') WHERE user_id=?`)
      .bind(liveNodeCount, liveCampaignCount, userId).run().catch(() => {});
  }

  const PLAN_NAMES = { free: 'Free', pro: 'Pro', admin_unlimited: 'Admin' };

  return json({
    plan: {
      key:    user.plan_key,
      name:   PLAN_NAMES[user.plan_key] ?? user.plan_key,
      status: user.plan_status ?? 'active',
    },
    usage: {
      campaigns: {
        used:  liveCampaignCount,
        limit: ents['max_campaigns'] ?? null,
      },
      nodes: {
        used:  liveNodeCount,
        limit: ents['max_nodes']     ?? null,
      },
      storage: {
        usedBytes:  usage.storage_bytes_used ?? 0,
        limitBytes: ents['max_storage_mb'] !== null && ents['max_storage_mb'] !== undefined
                      ? ents['max_storage_mb'] * 1024 * 1024
                      : null,
      },
      customNodeTypes: {
        used:  usage.custom_node_type_count  ?? 0,
        limit: ents['max_custom_node_types'] ?? null,
      },
      troubleGenerations: {
        used:      usage.trouble_generations_current_period ?? 0,
        limit:     ents['max_trouble_generations_per_month'] ?? null,
        periodEnd: usage.usage_period_end ?? null,
      },
      fluxGenerations: {
        used:      usage.flux_generations_current_period ?? 0,
        limit:     ents['max_flux_generations_per_month'] ?? null,
        periodEnd: usage.usage_period_end ?? null,
      },
      boardHistory: {
        visibleEntries: ents['max_board_history_entries'] ?? null,
        canRestore:     Boolean(ents['can_restore_history']),
      },
    },
  });
}

// ─── Usage Recording ─────────────────────────────────────────────────────────

async function handleRecordUsage(request, db) {
  const token  = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const type = body.type; // 'trouble' | 'flux'
  if (type !== 'trouble' && type !== 'flux') return err("type must be 'trouble' or 'flux'");

  const user  = await getUserWithPlan(userId, db);
  const ents  = await getEntitlements(user.plan_key, db);
  const usage = await getOrCreateUsage(userId, db);

  const limitKey   = type === 'trouble' ? 'max_trouble_generations_per_month' : 'max_flux_generations_per_month';
  const countField = type === 'trouble' ? 'trouble_generations_current_period' : 'flux_generations_current_period';
  const limit      = ents[limitKey];
  const current    = usage[countField] ?? 0;

  if (limit !== null && limit !== undefined && current >= limit) {
    return limitErr(
      type === 'trouble' ? 'TROUBLE_LIMIT_REACHED' : 'FLUX_LIMIT_REACHED',
      `You've reached your monthly limit of ${limit} ${type === 'trouble' ? 'Trouble Engine' : 'Flux System'} uses. Upgrade options are coming soon.`,
      limit, current, user.plan_key
    );
  }

  await db
    .prepare(`UPDATE account_usage SET ${countField} = ${countField} + 1, updated_at = datetime('now')
              WHERE user_id = ?`)
    .bind(userId)
    .run();

  return json({ ok: true, used: current + 1, limit });
}

// ─── Usage Recalculate ───────────────────────────────────────────────────────

/**
 * POST /api/account/recalculate
 * Recomputes active_node_count and active_campaign_count from actual blob data.
 * Safe to call any time stats look wrong. Returns the updated counts.
 */
async function handleRecalculate(request, db) {
  const token  = getToken(request);
  const userId = await validateSession(token, db);
  if (!userId) return err('Unauthorized', 401);

  // Sum nodes across all campaigns for this user
  const nodeRows = await db
    .prepare("SELECT data FROM campaign_data WHERE user_id = ? AND store = 'nodes'")
    .bind(userId)
    .all();

  let totalNodes = 0;
  for (const row of nodeRows.results) {
    try {
      const arr = JSON.parse(row.data);
      if (Array.isArray(arr)) totalNodes += arr.length;
    } catch { /* skip malformed */ }
  }

  // Count campaigns from __meta__ blob
  const metaRow = await db
    .prepare("SELECT data FROM campaign_data WHERE user_id = ? AND campaign_id = '__meta__' AND store = 'campaigns'")
    .bind(userId)
    .first();

  let totalCampaigns = 0;
  if (metaRow) {
    try {
      const arr = JSON.parse(metaRow.data);
      if (Array.isArray(arr)) totalCampaigns = arr.length;
    } catch { /* skip */ }
  }

  await db
    .prepare(`UPDATE account_usage
              SET active_node_count     = ?,
                  active_campaign_count = ?,
                  updated_at            = datetime('now')
              WHERE user_id = ?`)
    .bind(totalNodes, totalCampaigns, userId)
    .run();

  return json({ ok: true, active_node_count: totalNodes, active_campaign_count: totalCampaigns });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

// Helper: generate a FLUX-XXXXX-XXXXX style key
function generateBetaKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/1/0 — avoids confusion
  const seg = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `FLUX-${seg(5)}-${seg(5)}`;
}

// Helper: check that the requesting user is an admin
async function requireAdmin(request, db) {
  const token = getToken(request);
  if (!token) return null;
  const session = await db
    .prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")')
    .bind(token).first();
  if (!session) return null;
  const user = await db
    .prepare('SELECT id, plan_key FROM users WHERE id = ?')
    .bind(session.user_id).first();
  if (!user || user.plan_key !== 'admin_unlimited') return null;
  return user;
}

async function handleListKeys(request, db) {
  const admin = await requireAdmin(request, db);
  if (!admin) return err('Forbidden', 403);

  const rows = await db
    .prepare(`SELECT k.key, k.note, k.used_at, k.created_at, u.email as used_by_email
              FROM beta_keys k
              LEFT JOIN users u ON u.id = k.used_by
              ORDER BY k.created_at DESC`)
    .all();

  return json({ keys: rows.results });
}

async function handleCreateKeys(request, db) {
  const admin = await requireAdmin(request, db);
  if (!admin) return err('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const count = Math.min(Math.max(1, parseInt(body.count) || 1), 50); // 1–50 at a time
  const note  = (body.note || '').trim().slice(0, 120);

  const created = [];
  for (let i = 0; i < count; i++) {
    // Retry on the rare key collision
    let key;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateBetaKey();
      const exists = await db.prepare('SELECT 1 FROM beta_keys WHERE key = ?').bind(candidate).first();
      if (!exists) { key = candidate; break; }
    }
    if (!key) continue;
    await db.prepare('INSERT INTO beta_keys (key, note) VALUES (?, ?)').bind(key, note).run();
    created.push(key);
  }

  return json({ keys: created }, 201);
}

async function handleRevokeKey(request, db, key) {
  const admin = await requireAdmin(request, db);
  if (!admin) return err('Forbidden', 403);

  const row = await db.prepare('SELECT used_by FROM beta_keys WHERE key = ?').bind(key).first();
  if (!row) return err('Key not found', 404);
  if (row.used_by) return err('Cannot revoke a key that has already been used', 409);

  await db.prepare('DELETE FROM beta_keys WHERE key = ?').bind(key).run();
  return json({ ok: true });
}

async function handleAdminSetPlan(request, db, env, userId_param) {
  const secret = request.headers.get('X-Admin-Secret');
  if (!secret || secret !== (env.ADMIN_SECRET ?? '')) return err('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const planKey = body.plan_key;
  if (!planKey) return err('plan_key required');

  await db
    .prepare(`UPDATE users SET plan_key = ?, plan_status = 'active', updated_at = datetime('now')
              WHERE id = ?`)
    .bind(planKey, userId_param)
    .run();

  return json({ ok: true, userId: userId_param, plan_key: planKey });
}

// ─── Billing Webhook (stub) ───────────────────────────────────────────────────

async function handleBillingWebhook(request, db, env) {
  // BILLING_ENABLED=false — stub only in Phase 1
  const billingEnabled = (env.BILLING_ENABLED ?? 'false') === 'true';
  if (!billingEnabled) {
    return json({ ok: true, message: 'Billing not enabled in Phase 1' });
  }
  // Future: parse Stripe webhook, update plan_key/plan_status, insert into billing_events
  return json({ ok: true });
}

// ─── Main Fetch Handler ───────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const db  = env.flux_atlas_db;
    const r2  = env.flux_atlas_images;
    const url = new URL(request.url);
    const { pathname, method } = { pathname: url.pathname, method: request.method };

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Secret',
        },
      });
    }

    // ── Auth routes ──
    if (pathname === '/api/auth/signup'  && method === 'POST')   return handleSignup(request, db);
    if (pathname === '/api/auth/login'   && method === 'POST')   return handleLogin(request, db);
    if (pathname === '/api/auth/logout'  && method === 'POST')   return handleLogout(request, db);
    if (pathname === '/api/auth/me'      && method === 'GET')    return handleMe(request, db);

    // ── Data routes ──
    if (pathname === '/api/data/save'    && method === 'POST')   return handleSave(request, db);
    if (pathname === '/api/data/load'    && method === 'GET')    return handleLoad(request, db);
    if (pathname === '/api/data/campaign'&& method === 'DELETE') return handleDeleteCampaign(request, db);

    // ── Image routes ──
    if (pathname === '/api/images/upload' && method === 'POST')  return handleImageUpload(request, env, db);
    if (pathname.startsWith('/api/images/') && method === 'GET') return handleImageServe(request, env);
    if (pathname.startsWith('/api/images/') && method === 'DELETE') return handleImageDelete(request, env, db);

    // ── Account / usage routes ──
    if (pathname === '/api/account/status'      && method === 'GET')  return handleAccountStatus(request, db);
    if (pathname === '/api/account/recalculate' && method === 'POST') return handleRecalculate(request, db);
    if (pathname === '/api/usage/record'   && method === 'POST') return handleRecordUsage(request, db);

    // ── Admin routes ──
    const adminMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/plan$/);
    if (adminMatch && method === 'POST') return handleAdminSetPlan(request, db, env, adminMatch[1]);

    const keyMatch = pathname.match(/^\/api\/admin\/keys\/(.+)$/);
    if (pathname === '/api/admin/keys' && method === 'GET')  return handleListKeys(request, db);
    if (pathname === '/api/admin/keys' && method === 'POST') return handleCreateKeys(request, db);
    if (keyMatch && method === 'DELETE')                     return handleRevokeKey(request, db, keyMatch[1]);

    // ── Billing webhook ──
    if (pathname === '/api/billing/webhook' && method === 'POST') return handleBillingWebhook(request, db, env);

    // ── Passthrough to static assets ──
    return env.ASSETS.fetch(request);
  },
};