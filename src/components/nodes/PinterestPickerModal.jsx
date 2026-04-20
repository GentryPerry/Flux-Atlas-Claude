import { useState, useCallback } from 'react';
import { X, ArrowRight, Trash } from '@phosphor-icons/react';
import useSettingsStore from '../../stores/settingsStore';
import useCampaignStore from '../../stores/campaignStore';

/**
 * Turn a Pinterest board URL into { username, boardSlug, boardUrl }
 */
function parseBoard(raw) {
  try {
    let input = raw.trim();
    if (!input) return null;
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
      input = 'https://' + input;
    }
    const url = new URL(input);
    if (!url.hostname.includes('pinterest.com')) return null;
    const parts = url.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const username = parts[0];
    const boardSlug = parts[1];
    return { username, boardSlug, boardUrl: `/${username}/${boardSlug}/` };
  } catch {
    return null;
  }
}

function labelFromParsed({ username, boardSlug }) {
  return `${username} / ${boardSlug.replace(/-/g, ' ')}`;
}

function fetchWithTimeout(url, options = {}, timeout = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

// Base headers Pinterest expects for its internal JSON API calls
const API_HEADERS = {
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'X-APP-VERSION': '1afba8e',
  'X-Pinterest-AppState': 'active',
  'X-Requested-With': 'XMLHttpRequest',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
};

// Session injection is handled entirely by the Vite proxy (vite.config.js).
// The proxy reads a shared in-memory variable updated via /api/set-pinterest-session,
// so we don't need to pass any special headers from the browser side.
function getApiHeaders() {
  return API_HEADERS;
}

/**
 * Use Pinterest's BoardResource API to get the numeric board ID.
 * Returns { boardId, boardName }.
 */
async function fetchBoardInfo(username, boardSlug) {
  const options = { field_set_key: 'detailed', slug: boardSlug, username };
  const data = JSON.stringify({ options, context: {} });
  const source = `/${username}/${boardSlug}/`;
  const url =
    `/api/pinterest/resource/BoardResource/get/?source_url=${encodeURIComponent(source)}` +
    `&data=${encodeURIComponent(data)}&_=${Date.now()}`;

  const res = await fetchWithTimeout(url, { headers: getApiHeaders() });
  if (!res.ok) throw new Error(`BoardResource API returned HTTP ${res.status}`);

  let json;
  try { json = await res.json(); } catch { throw new Error('BoardResource response was not JSON'); }

  const board = json?.resource_response?.data;
  if (!board?.id) throw new Error('No board ID in API response');
  return { boardId: board.id, boardName: board.name || boardSlug };
}

/**
 * Use Pinterest's BoardFeedResource API to get a page of pins.
 * Returns { images: string[], nextBookmark: string|null }.
 */
async function fetchPinsFromAPI(username, boardSlug, boardId, bookmark = null) {
  const options = {
    board_id: boardId,
    board_url: `/${username}/${boardSlug}/`,
    currentPage: null,
    field_set_key: 'react',   // 'partner_react' causes Pinterest to cap results
    filter_stories: false,
    layout: null,
    page_size: 25,            // Pinterest caps unauthenticated requests; 25 is reliable
    prepend: false,
    username,
    bookmarks: bookmark ? [bookmark] : [],
  };

  const data = JSON.stringify({ options, context: {} });
  const source = `/${username}/${boardSlug}/`;
  const url =
    `/api/pinterest/resource/BoardFeedResource/get/?source_url=${encodeURIComponent(source)}` +
    `&data=${encodeURIComponent(data)}&_=${Date.now()}`;

  const res = await fetchWithTimeout(url, { headers: getApiHeaders() });
  if (!res.ok) throw new Error(`BoardFeedResource API returned HTTP ${res.status}`);

  let json;
  try { json = await res.json(); } catch { throw new Error('BoardFeedResource response was not JSON'); }

  // Only take actual pin objects that have images attached
  const pins = (json?.resource_response?.data || [])
    .filter((pin) => pin?.id && pin?.images && pin?.type !== 'story');

  const rawBM = json?.resource_response?.bookmark;

  const images = deduplicateUrls(
    pins.map((pin) => {
      const imgs = pin.images;
      return (
        imgs['736x']?.url ||
        imgs['564x']?.url ||
        imgs['474x']?.url ||
        imgs['236x']?.url ||
        imgs.orig?.url ||
        null
      );
    }).filter(Boolean)
  );

  const nextBookmark = rawBM && rawBM !== '-end-' ? rawBM : null;
  return { images, nextBookmark };
}

/**
 * Fallback: fetch the board HTML page and parse image URLs from embedded JSON / <img> tags.
 */
async function fetchPinsFromHTML(username, boardSlug) {
  const res = await fetchWithTimeout(`/api/pinterest/${username}/${boardSlug}/`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
    },
  });
  if (!res.ok) throw new Error(`Pinterest returned HTTP ${res.status}`);
  const html = await res.text();
  if (!html || html.length < 500) throw new Error('Pinterest returned an empty page');
  const images = extractPinterestImagesFromHtml(html);
  if (!images.length) throw new Error('No images could be parsed from the page');
  return { images, nextBookmark: null };
}

/**
 * Deduplicate image URLs, normalising size-prefix variants to the same key
 * so /736x/abc.jpg and /474x/abc.jpg count as the same image.
 */
function deduplicateUrls(urls) {
  const seen = new Map();
  for (const raw of urls) {
    const url = String(raw).replace(/&amp;/g, '&');
    try {
      const p = new URL(url);
      p.search = '';
      const norm = p.pathname.replace(/^\/(?:\d+x|originals)\//, '/');
      if (!seen.has(norm)) seen.set(norm, p.toString());
    } catch {
      if (!seen.has(url)) seen.set(url, url);
    }
  }
  return Array.from(seen.values());
}

function isPinimgUrl(url) {
  return (
    url.includes('i.pinimg.com') &&
    !url.includes('/30x30/') && !url.includes('/60x60/') &&
    !url.includes('/75x75/') && !url.includes('/140x140/') &&
    !url.includes('/avatars/') && !url.includes('/icons/')
  );
}

/**
 * Extract pin image URLs from a Pinterest HTML page.
 *
 * Strategy 1 — Navigate to the BoardFeedResource section of __PWS_DATA__.
 *   Pinterest's page state stores the board feed data at a known path.
 *   Only pins inside that resource belong to this board.
 *
 * Strategy 2 — Scrape <img> tags that sit inside <a href="/pin/…"> links.
 *   These are exactly the pins rendered in the board grid, nothing more.
 *
 * We deliberately do NOT do a generic recursive JSON walk — that picks up
 * related pins, trending content, recommended sections, and everything else
 * Pinterest bundles into __PWS_DATA__, producing off-board results.
 */
function extractPinterestImagesFromHtml(html) {
  // ── Strategy 1: targeted extraction from __PWS_DATA__ BoardFeedResource ──
  const pwsMatch = html.match(/<script[^>]*id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (pwsMatch) {
    try {
      const pws = JSON.parse(pwsMatch[1]);
      const images = extractFromBoardFeedResource(pws);
      if (images.length >= 3) {
        console.log(`[Pinterest HTML] Found ${images.length} pins via __PWS_DATA__ BoardFeedResource`);
        return deduplicateUrls(images);
      }
    } catch { /* ignore parse errors */ }
  }

  // ── Strategy 2: scrape only <img> tags inside pin links ──
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const results = [];

  for (const link of doc.querySelectorAll('a[href*="/pin/"]')) {
    const img = link.querySelector('img');
    if (!img) continue;

    // Prefer the largest srcset candidate
    const srcset = img.getAttribute('srcset') || '';
    let bestUrl = '';
    if (srcset.trim()) {
      const parts = srcset.split(',').map((e) => e.trim().split(' ')[0]).filter(Boolean);
      if (parts.length) bestUrl = parts[parts.length - 1];
    }
    if (!bestUrl) bestUrl = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (bestUrl && isPinimgUrl(bestUrl)) results.push(bestUrl);
  }

  console.log(`[Pinterest HTML] Found ${results.length} pins via img-tag scraping`);
  return deduplicateUrls(results.filter(isPinimgUrl));
}

/**
 * Navigate Pinterest's __PWS_DATA__ blob to find the BoardFeedResource entry
 * and extract only the pin images stored there.
 *
 * Pinterest stores resources as { "BoardFeedResource:{...options}": { data: [...] } }
 * so we match on the KEY string, not on value properties.
 */
function extractFromBoardFeedResource(pws) {
  const state =
    pws?.props?.initialReduxState ??
    pws?.initialReduxState ??
    pws?.props?.pageProps?.initialReduxState ??
    null;

  if (!state) {
    console.log('[Pinterest HTML] No redux state found in __PWS_DATA__');
    return [];
  }

  const resources = state.resources ?? state.resourceCache ?? {};
  const images = [];

  for (const [key, value] of Object.entries(resources)) {
    // The KEY contains the resource name — "BoardFeedResource:{...}"
    if (!key.includes('BoardFeed')) continue;

    const data =
      Array.isArray(value?.data) ? value.data :
      Array.isArray(value?.value?.data) ? value.value.data :
      Array.isArray(value?.response?.data) ? value.response.data :
      [];

    console.log(`[Pinterest HTML] BoardFeedResource found, pins in state: ${data.length}`);

    for (const pin of data) {
      if (!pin?.images) continue;
      const imgs = pin.images;
      const url =
        imgs['736x']?.url || imgs['564x']?.url ||
        imgs['474x']?.url || imgs['236x']?.url || imgs.orig?.url;
      if (url && isPinimgUrl(url)) images.push(url);
    }
  }

  if (images.length === 0) {
    console.log('[Pinterest HTML] No pins found via BoardFeedResource key, falling to img scraping');
  }

  return images;
}

/**
 * Fetch pins for a board.
 *
 * Initial load (bookmark = null):
 *   Auto-paginates through up to MAX_INITIAL_PAGES pages so the user sees
 *   a full board in one shot, rather than 15 pins with a "Load More" button.
 *
 * "Load More" (bookmark supplied):
 *   Fetches a single additional page.
 *
 * Falls back to HTML scraping if the JSON API is unavailable.
 * Pass `boardId` to skip the BoardResource lookup on subsequent calls.
 * Returns { images, nextBookmark, boardId }.
 */
const MAX_INITIAL_PAGES = 6; // up to ~6 × 25 = 150 pins on first open

async function fetchPins(username, boardSlug, bookmark = null, boardId = null) {
  // ── Step 1: resolve the numeric board ID ──────────────────────────────────
  if (!boardId) {
    try {
      const info = await fetchBoardInfo(username, boardSlug);
      boardId = info.boardId;
      console.log(`[Pinterest] BoardResource OK — boardId: ${boardId}`);
    } catch (e) {
      console.warn('[Pinterest] BoardResource API failed, falling back to HTML scraping:', e.message);
      const result = await fetchPinsFromHTML(username, boardSlug);
      return { ...result, boardId: null };
    }
  }

  // ── Step 2: fetch pins ────────────────────────────────────────────────────
  try {
    if (bookmark) {
      // "Load More" – single additional page
      console.log(`[Pinterest] Load More page, bookmark: ${bookmark.slice(0, 30)}…`);
      const result = await fetchPinsFromAPI(username, boardSlug, boardId, bookmark);
      console.log(`[Pinterest] Load More returned ${result.images.length} pins, nextBM: ${result.nextBookmark ? 'yes' : 'none'}`);
      return { ...result, boardId };
    }

    // Initial load – chain pages until we have enough or reach the end
    let allImages = [];
    let currentBM = null;

    for (let page = 0; page < MAX_INITIAL_PAGES; page++) {
      const { images, nextBookmark } = await fetchPinsFromAPI(username, boardSlug, boardId, currentBM);
      console.log(`[Pinterest] Page ${page + 1}: got ${images.length} pins, nextBM: ${nextBookmark ? nextBookmark.slice(0, 20) + '…' : 'none (done)'}`);
      allImages = deduplicateUrls([...allImages, ...images]);
      currentBM = nextBookmark;
      if (!currentBM || images.length === 0) break;
    }

    console.log(`[Pinterest] Initial load complete — ${allImages.length} unique pins`);
    return { images: allImages, nextBookmark: currentBM, boardId };
  } catch (e) {
    if (!bookmark) {
      console.warn('[Pinterest] BoardFeedResource API failed, falling back to HTML scraping:', e.message);
      const result = await fetchPinsFromHTML(username, boardSlug);
      return { ...result, boardId };
    }
    throw e;
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const PIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#e60023">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
  </svg>
);

const PIconLarge = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="#e60023" style={{ opacity: 0.25 }}>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Pinterest board picker.
 *
 * `initialBoard`, `initialImages`, `initialNextBookmark` let the caller
 * preserve board state across open/close cycles.
 *
 * `onStateChange({ activeBoard, images, nextBookmark })` is fired whenever
 * those values change so the caller can persist them.
 *
 * `activeBoard` now includes a `boardId` field (Pinterest's numeric board ID)
 * so "Load More" can skip the board info lookup on subsequent pages.
 */
export default function PinterestPickerModal({
  onSelect,
  onClose,
  initialBoard = null,
  initialImages = null,
  initialNextBookmark = null,
  onStateChange,
}) {
  const campaignId           = useCampaignStore((s) => s.activeCampaignId);
  const savedBoards          = useSettingsStore((s) => s.pinterestBoards) || [];
  const addPinterestBoard    = useSettingsStore((s) => s.addPinterestBoard);
  const removePinterestBoard = useSettingsStore((s) => s.removePinterestBoard);

  const [urlInput, setUrlInput]    = useState('');
  const [activeBoard, setActive]   = useState(initialBoard);
  const [loading, setLoading]      = useState(false);
  const [images, setImages]        = useState(initialImages);
  const [nextBookmark, setNextBM]  = useState(initialNextBookmark);
  const [loadingMore, setLoadMore] = useState(false);
  const [error, setError]          = useState('');

  // Update all three pieces of state in sync and notify parent
  const setActiveFull = useCallback((board, imgs, bm) => {
    setActive(board);
    setImages(imgs);
    setNextBM(bm);
    onStateChange?.({ activeBoard: board, images: imgs, nextBookmark: bm });
  }, [onStateChange]);

  const browse = useCallback(async (parsed, label) => {
    setLoading(true);
    setError('');
    setActive({ ...parsed, label });
    setImages(null);
    setNextBM(null);

    try {
      const { images: found, nextBookmark: bm, boardId } = await fetchPins(parsed.username, parsed.boardSlug);
      if (!found.length) {
        setError('No images found. Make sure this is a public Pinterest board.');
      } else {
        const board = { ...parsed, label, boardId };
        setActiveFull(board, found, bm);
        addPinterestBoard(
          campaignId,
          `https://www.pinterest.com${parsed.boardUrl}`,
          label,
        );
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('Request timed out. Pinterest may be rate-limiting this request — try again in a moment.');
      } else {
        setError(`Could not load the board. Make sure it is a public Pinterest board URL.\n\n(${e.message})`);
      }
    } finally {
      setLoading(false);
    }
  }, [campaignId, addPinterestBoard, setActiveFull]);

  const handleLoadMore = async () => {
    if (!activeBoard || !nextBookmark || loadingMore) return;
    setLoadMore(true);
    try {
      const { images: more, nextBookmark: newBM } = await fetchPins(
        activeBoard.username,
        activeBoard.boardSlug,
        nextBookmark,
        activeBoard.boardId,   // reuse board ID to skip the lookup step
      );
      const merged = Array.from(new Set([...(images || []), ...(more || [])]));
      setImages(merged);
      setNextBM(newBM);
      onStateChange?.({ activeBoard, images: merged, nextBookmark: newBM });
    } catch {
      /* silently ignore load-more errors */
    } finally {
      setLoadMore(false);
    }
  };

  const handleBrowseNew = () => {
    const parsed = parseBoard(urlInput);
    if (!parsed) {
      setError('Paste a full Pinterest board URL like pinterest.com/username/board-name');
      return;
    }
    setUrlInput('');
    browse(parsed, labelFromParsed(parsed));
  };

  const handleSavedBoardClick = (board) => {
    const parsed = parseBoard(board.url);
    if (parsed) browse(parsed, board.label);
  };

  const handleSelect = (imgUrl) => {
    onSelect(imgUrl);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pinterest-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="pinterest-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PIcon />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Pinterest Boards</h3>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="pinterest-body">
          {/* Left sidebar */}
          <div className="pinterest-sidebar">
            <div className="pinterest-sidebar-title">Saved Boards</div>

            {savedBoards.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 4px', lineHeight: 1.5 }}>
                Browse a board below and it will be saved here for next time.
              </div>
            )}

            {savedBoards.map((board) => (
              <div
                key={board.id}
                className={`pinterest-board-row ${activeBoard?.label === board.label ? 'active' : ''}`}
              >
                <button className="pinterest-board-label" onClick={() => handleSavedBoardClick(board)}>
                  <PIcon />
                  <span title={board.label}>{board.label}</span>
                </button>
                <button
                  className="btn-icon"
                  style={{ opacity: 0.45, flexShrink: 0 }}
                  title="Remove saved board"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePinterestBoard(campaignId, board.id);
                    if (activeBoard?.label === board.label) {
                      setActiveFull(null, null, null);
                    }
                  }}
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}

            {/* Add new board */}
            <div className="pinterest-add-bar">
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
              }}>
                Add Board
              </div>
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="pinterest.com/user/board"
                onKeyDown={(e) => e.key === 'Enter' && handleBrowseNew()}
                style={{ marginBottom: 6, fontSize: 12, padding: '7px 10px' }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBrowseNew}
                disabled={loading || !urlInput.trim()}
                style={{ width: '100%', gap: 6, justifyContent: 'center' }}
              >
                {loading
                  ? <><span className="pinterest-spinner" /> Loading…</>
                  : <><ArrowRight size={14} /> Browse</>}
              </button>
            </div>
          </div>

          <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />

          {/* Right: image grid */}
          <div className="pinterest-content">
            {error && (
              <div className="pinterest-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>
            )}

            {loading && (
              <div className="pinterest-loading">
                <span className="pinterest-spinner large" />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Loading {activeBoard?.label}…
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6, opacity: 0.7 }}>
                    Fetching all pins, this may take a moment
                  </div>
                </div>
              </div>
            )}

            {!loading && images !== null && images.length > 0 && (
              <>
                <div className="pinterest-count">
                  {images.length} pins from <strong>{activeBoard?.label}</strong>
                  {activeBoard?.boardId
                    ? <span style={{ opacity: 0.5, fontWeight: 400 }}> · via API</span>
                    : <span style={{ opacity: 0.5, fontWeight: 400 }}> · via HTML (limited)</span>}
                  {' '}— click to use
                </div>
                <div className="pinterest-grid">
                  {images.map((imgUrl, i) => (
                    <button key={i} className="pinterest-img-btn" onClick={() => handleSelect(imgUrl)}>
                      <img src={imgUrl} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
                {nextBookmark && (
                  <div style={{ padding: '12px 16px', flexShrink: 0 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      style={{ width: '100%', justifyContent: 'center', gap: 6 }}
                    >
                      {loadingMore
                        ? <><span className="pinterest-spinner" /> Loading…</>
                        : 'Load more pins'}
                    </button>
                  </div>
                )}
              </>
            )}

            {!loading && images === null && !error && (
              <div className="pinterest-empty">
                <PIconLarge />
                <p style={{
                  margin: '14px 0 0', color: 'var(--text-muted)',
                  fontSize: 13, textAlign: 'center', lineHeight: 1.7,
                }}>
                  Select a saved board or paste a<br />Pinterest board URL to browse
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
