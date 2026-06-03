import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

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
      configure: (proxy, _options) => {
        proxy.on("error", (err, _req, _res) => {
          console.log("proxy error", err);
        });
        proxy.on("proxyReq", (proxyReq, req, _res) => {
          console.log("Sending Request to the Target:", req.method, req.url);
        });
        proxy.on("proxyRes", (proxyRes, req, _res) => {
          console.log("Received Response from the Target:", proxyRes.statusCode, req.url);
        });
      },
    },
  };

  return {
    server: { host: true, proxy }, // `npm run dev`
    preview: { host: true, proxy }, // `npm run preview`
    // @tensorflow-models/hand-pose-detection statically imports `Hands`
    // from @mediapipe/hands so it can offer a 'mediapipe' runtime — but
    // we always use runtime: 'tfjs', so that import is never invoked.
    // Aliasing it to a small stub keeps rollup happy AND avoids shipping
    // the ~2MB mediapipe bundle to the client.
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@mediapipe/hands": fileURLToPath(new URL("./src/utils/mediapipeStub.js", import.meta.url)),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
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
                /\/api\/(interpret|daily|daily-dates|palm|palm\/history|palm\/[^/]+|chat)$/.test(
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
