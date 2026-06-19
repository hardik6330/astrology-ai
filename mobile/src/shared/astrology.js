// Proxy to the shared @astrology-ai/core engine — see the frontend twin. The
// chart math is consolidated in packages/astrology-core (this used to be a
// ~964-line copy that had drifted from web); this re-exports the public API so
// `import { ... } from "../../shared/astrology"` keeps working unchanged.
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
} from "../../../packages/astrology-core/src/index.js";
