// Proxy to the shared @astrology-ai/core copy — the single source of the STRINGS
// dictionary. Web and mobile each carried their own full copy; the two had
// drifted apart in formatting while the engine itself already imported core's
// version, so the same dictionary existed three times. Keep importing from
// "shared/uiStrings" as before.
//
// Edit packages/astrology-core/src/uiStrings.js — NOT this file.
export { STRINGS } from "../../../packages/astrology-core/src/uiStrings.js";
