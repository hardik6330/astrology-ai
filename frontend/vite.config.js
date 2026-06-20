import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Content-Security-Policy for the PRODUCTION build. The session JWT lives in the
// browser, so the priority is denying an injected script the ability to run
// (script-src) or to phone the token home (connect-src allowlist). Every origin
// below is one the app genuinely loads — keep in sync when adding a vendor:
//   • Razorpay Checkout → script/frame/connect checkout.razorpay.com + *.razorpay.com
//   • Firebase Phone Auth (reCAPTCHA) → script/frame www.google.com + www.gstatic.com
//   • Firebase Auth/Installations/FCM → connect *.googleapis.com, *.google.com
//   • MediaPipe palm gate → 'wasm-unsafe-eval' + connect cdn.jsdelivr.net (wasm),
//     storage.googleapis.com (model)
//   • the backend API → connect <apiOrigin> (from VITE_API_URL)
// frame-ancestors is intentionally absent — it's ignored in a <meta> CSP and is
// set as an HTTP header in vercel.json instead.
function buildCsp(apiOrigin) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "script-src 'self' 'wasm-unsafe-eval' https://checkout.razorpay.com https://www.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} https://*.googleapis.com https://*.google.com https://cdn.jsdelivr.net https://storage.googleapis.com https://*.razorpay.com`,
    "frame-src https://*.razorpay.com https://checkout.razorpay.com https://www.google.com",
  ].join("; ");
}

// Inject the CSP into the BUILT HTML only (`apply: 'build'`). The dev server is
// left untouched — Vite HMR + React Fast Refresh use inline scripts/eval that a
// strict script-src would block.
function cspPlugin(apiOrigin) {
  return {
    name: "inject-csp",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: buildCsp(apiOrigin) },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

// Standalone static GEO pages live in public/<route>/index.html (e.g. the
// "best AI astrology apps" comparison + the palm-reading pillar). nginx serves
// them via `try_files $uri $uri/ /index.html`, but Vite's dev/preview server
// falls straight through to the SPA index.html for any directory request — so
// React Router's "*" catch-all bounces the visitor back to "/". This dev-only
// middleware mirrors nginx: if the requested directory has an index.html in
// public/, serve that BEFORE the SPA fallback. (Production `vite build` copies
// these files into dist as-is; this only affects `npm run dev`/`preview`.)
function staticPublicPages() {
  const publicDir = fileURLToPath(new URL("./public", import.meta.url));
  const serve = (server) => (req, res, next) => {
    const url = (req.url || "").split("?")[0];
    if (!url.endsWith("/")) return next();
    const file = join(publicDir, url, "index.html");
    if (file.startsWith(publicDir) && existsSync(file)) {
      res.setHeader("Content-Type", "text/html");
      res.end(readFileSync(file));
      return;
    }
    next();
  };
  return {
    name: "serve-static-public-pages",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(serve(server));
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve(server));
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // The astrology backend (Kaggle/Colab/Lightning + ngrok) — origin of VITE_API_URL.
  const apiUrl = env.VITE_API_URL || "http://localhost:5000/api";
  const API_TARGET = new URL(apiUrl).origin;

  // Proxy: the browser calls same-origin "/api/..." (no CORS, no preflight),
  // Vite forwards it to the ngrok backend with the skip-warning header.
  const proxy = {
    "/api": {
      target: API_TARGET,
      changeOrigin: true,
      secure: false,
      rewrite: (p) => p.replace(/^\/api/, ""),
      headers: {
        "ngrok-skip-browser-warning": "true",
        Origin: API_TARGET,
      },
    },
  };

  // The chart engine lives in ../packages/astrology-core (shared with mobile),
  // which is OUTSIDE this app's root. Allow the dev server to serve it, else
  // Vite blocks the import as "outside of the serving allow list". (Production
  // `vite build` resolves the relative import fine without this.)
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));

  return {
    server: { host: true, proxy, fs: { allow: [".", repoRoot] } }, // `npm run dev`
    preview: { host: true, proxy }, // `npm run preview`
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      // packages/astrology-core imports `astronomy-engine` as a bare specifier,
      // but it lives outside this app's tree (no node_modules of its own), so
      // resolution from the package file fails. dedupe forces it to resolve
      // from THIS app's node_modules.
      dedupe: ["astronomy-engine"],
    },
    plugins: [
      staticPublicPages(),
      react(),
      tailwindcss(),
      cspPlugin(API_TARGET),
      VitePWA({
        registerType: "autoUpdate",
        // External register script (not inline) so the strict build CSP's
        // script-src 'self' doesn't block service-worker registration.
        injectRegister: "script",
        includeAssets: ["favicon.svg", "apple-touch-icon.png"],
        devOptions: {
          enabled: true,
        },
        workbox: {
          // Offline caching for already-loaded GET reads — open the app on a flight
          // and your kundli / palm / past dailies still render from cache.
          // POSTs (which actually call Gemini) are never cached.
          runtimeCaching: [
            {
              urlPattern: ({ url, request }) =>
                request.method === "GET" &&
                /\/api\/(v1\/)?(interpret|daily|daily-dates|palm|palm\/history|palm\/[^/]+|chat)$/.test(
                  url.pathname
                ),
              handler: "NetworkFirst",
              options: {
                cacheName: "astro-api-reads",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: "AI Kundali Insights",
          short_name: "AI Kundali",
          description: "Precision astronomy + AI birth-chart readings",
          theme_color: "#0a0a14",
          background_color: "#050508",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          icons: [
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
            { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
      }),
    ],
  };
});
