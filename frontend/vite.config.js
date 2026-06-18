import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

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

  return {
    server: { host: true, proxy }, // `npm run dev`
    preview: { host: true, proxy }, // `npm run preview`
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [
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
