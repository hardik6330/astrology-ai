import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted variable fonts (no Google CDN — keeps the privacy promise + works
// under the strict CSP). Inter = body, Space Grotesk = display/headings.
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./index.css";
import App from "./App.jsx";

// After a redeploy, lazy-loaded chunk filenames change (new content hashes),
// but the user's already-loaded index.html still references the old names.
// When React.lazy tries to fetch the old chunk it 404s. Reload once to pick
// up the new index.html + new chunk names. The `chunk-reload` flag prevents
// an infinite loop if the failure is actually persistent.
function handleChunkLoadError(err) {
  const msg = (err?.message || "") + (err?.reason?.message || "");
  const looksLikeChunkError =
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk \d+ failed/i.test(msg) ||
    /Importing a module script failed/i.test(msg);
  if (!looksLikeChunkError) return;
  if (sessionStorage.getItem("chunk-reload")) return;
  sessionStorage.setItem("chunk-reload", "1");
  window.location.reload();
}
window.addEventListener("error", handleChunkLoadError);
window.addEventListener("unhandledrejection", handleChunkLoadError);
// Clear the guard once the new app boots successfully.
window.addEventListener("load", () => sessionStorage.removeItem("chunk-reload"));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
