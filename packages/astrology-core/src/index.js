// @astrology-ai/core — single source of truth for the chart engine, consumed by
// both web (frontend) and mobile via thin proxies in each app's
// src/shared/astrology.js. The math used to be duplicated in both clients (web
// was the ~1484-line superset, mobile had drifted to ~964); it now lives here.
// Public API only — internal helpers stay private to ./astrology.js.
export {
  SIGNS,
  ZE,
  nm,
  signOf,
  fmtDate,
  fmtDay,
  computeChart,
  computeDaily,
  buildFactSheet,
} from "./astrology.js";
