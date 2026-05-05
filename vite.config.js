import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In-memory Pinterest session — updated at runtime via /api/set-pinterest-session
// so no dev-server restart is needed when the user pastes their session token.
// This variable is shared between the middleware (writer) and the proxy (reader).
let pinterestSession = '';

export default defineConfig({
  plugins: [
    react(),
    {
      // Exposes a tiny POST endpoint the React app calls whenever the Pinterest
      // session changes. Updates the shared variable so the proxy injects the
      // correct Cookie header on the very next request — no restart required.
      name: 'pinterest-session-sync',
      configureServer(server) {
        server.middlewares.use('/api/set-pinterest-session', (req, res) => {
          if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try { pinterestSession = JSON.parse(body)?.session ?? ''; }
            catch { pinterestSession = ''; }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        });
      },
    },
  ],
  server: {
    proxy: {
      // Forward all /api/* calls (except pinterest) to the local Wrangler dev server.
      // Run `npx wrangler dev` on port 8787 alongside `npm run dev`.
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        // Let the more-specific pinterest rule handle those paths
        bypass(req) {
          if (req.url.startsWith('/api/pinterest') || req.url.startsWith('/api/set-pinterest-session')) {
            return req.url; // return URL to let Vite handle it with its own middleware/proxy
          }
        },
      },
      '/api/pinterest': {
        target: 'https://www.pinterest.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/pinterest/, ''),
        // Inject the Pinterest session cookie on every proxied request if one
        // has been configured. Pinterest treats this as an authenticated request
        // and returns full paginated board data instead of capping at ~15 pins.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Only inject the session for Pinterest's JSON API endpoints.
            // Plain board-page HTML requests (/username/board/) must NOT carry
            // the session — Pinterest serves an empty app shell to logged-in
            // users, which breaks the HTML fallback scraper.
            if (pinterestSession && req.url.includes('/resource/')) {
              // pinterestSession is the raw "cookie:" header value copied from
              // DevTools Network tab — it contains all cookies Pinterest checks.
              proxyReq.setHeader('Cookie', pinterestSession);
              // Pinterest's API validates X-CSRFToken on every request.
              // Extract it from the cookie string if present.
              const csrf = pinterestSession.match(/csrftoken=([^;]+)/);
              if (csrf) proxyReq.setHeader('X-CSRFToken', csrf[1].trim());
            }
            proxyReq.removeHeader('x-pinterest-session');
          });
        },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-site': 'same-origin',
        },
      },
    },
  },
})
