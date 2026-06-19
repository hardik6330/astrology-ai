// Proxy to the shared @astrology-ai/core engine — the single source of truth
// for the chart math used by both web and mobile. The engine (~1484 lines) used
// to live here and was duplicated in mobile/src/shared/astrology.js; it now
// lives in packages/astrology-core. Keep importing chart helpers from
// "@/shared/astrology" as before — this re-exports the full public API.
export {
  SIGNS,
  ZE,
  ZE as ZODIAC_EMOJIS,
  nm,
  signOf,
  fmtDate,
  fmtDay,
  computeChart,
  computeDaily,
  buildFactSheet,
} from "../../../packages/astrology-core/src/index.js";
