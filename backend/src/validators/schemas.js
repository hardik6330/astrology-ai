import { z } from 'zod';

// Birth-detail form — the join key for every user.
// Length caps keep an attacker from padding the Gemini prompt with megabytes.
//
// NOTE: `phone` is deliberately NOT a field here. The acting account is taken
// from the verified token (req.auth.phone) in the controllers, never from the
// client — a client-supplied phone is silently dropped by Zod. This is what
// stops an authed caller reading/charging another account by passing its phone
// (IDOR). See utils/authForm.js.
const formSchema = z.object({
  name:   z.string().trim().min(1, 'name is required').max(80),
  gender: z.string().trim().max(20).optional().nullable(),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time:   z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'time must be HH:MM'),
  city:   z.string().trim().min(1, 'city is required').max(80),
});

// 20KB ceiling — a real natal chart's fact sheet runs ~6–15KB depending on
// dasha density and timeline depth. Stops megabyte-padding without rejecting
// legitimate charts.
const factSheetSchema = z.string().max(20_000);

// Optional FCM token of the device making the request. When present, the
// "insight ready" push targets ONLY this device (the one that asked) instead of
// every device on the account — see pushService.notifyInsightReady.
const deviceTokenSchema = z.string().min(20).max(4096).nullish();

// Persist birth details onto the logged-in user's row, no reading generated.
export const profileBody = z.object({
  form: formSchema,
});

export const interpretBody = z.object({
  form: formSchema,
  factSheet: factSheetSchema,
  deviceToken: deviceTokenSchema,
});

export const dailyBody = z.object({
  form: formSchema,
  ctx:  z.string().max(4_000),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const chatBody = z.object({
  form: formSchema.optional(),
  factSheet: factSheetSchema.optional(),
  // 200-turn cap is a defensive ceiling, NOT a UX limit. The client should
  // truncate to the last N turns before sending so prompt tokens stay
  // bounded — see chatCompletion() in services/api.js (web + mobile).
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    // trim()+min(1) so a whitespace-only turn can't burn a credit on an empty
    // Gemini call (M4). Cap unchanged at 2000 to bound prompt tokens.
    content: z.string().trim().min(1, 'message cannot be empty').max(2_000),
  })).min(1).max(200),
});

export const palmBody = z.object({
  form: formSchema,
  image: z.string().min(100).max(7_000_000),
  // Optional — the hand the user picked on the UI, stamped onto the
  // response for display. Backend does not validate it against the photo.
  claimedHand: z.enum(['Left', 'Right']).optional(),
  // Set by the web client when it has already gated the photo locally
  // (via MediaPipe). Tells the backend to skip its own Flash gate to
  // avoid duplicate work. Mobile leaves this off and uses the Flash gate.
  skipGate: z.boolean().optional(),
  // The 21 MediaPipe hand landmarks from the client gate (image-pixel coords).
  // Used to build the palm-geometry hint sent to Gemini. Optional — absent when
  // the client gate didn't run (gate timeout/fallback).
  landmarks: z.array(z.object({ x: z.number(), y: z.number() }).passthrough()).min(15).max(40).nullish(),
  deviceToken: deviceTokenSchema,
});

// Both-hands comparison payload. Left = Potential (inherited blueprint),
// Right = Reality (lived/reshaped). Each image is run through the same
// gate + Pro pipeline as a single-hand reading, then a synthesis call
// produces the gap narrative.
export const palmCompareBody = z.object({
  form: formSchema,
  leftImage:  z.string().min(100).max(7_000_000),
  rightImage: z.string().min(100).max(7_000_000),
  // See palmBody.skipGate — web client already ran MediaPipe locally.
  skipGate: z.boolean().optional(),
  // Per-hand landmarks → backend handedness guard (left slot must be a left
  // hand, right slot a right hand). Optional — absent when the client gate
  // didn't run; same shape as palmBody.landmarks.
  leftLandmarks:  z.array(z.object({ x: z.number(), y: z.number() }).passthrough()).min(15).max(40).nullish(),
  rightLandmarks: z.array(z.object({ x: z.number(), y: z.number() }).passthrough()).min(15).max(40).nullish(),
  deviceToken: deviceTokenSchema,
});

export const userQuery = formSchema.partial({ gender: true }).extend({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Auth — the client trades a verified Firebase ID token for our own session
// JWT. See services/authService.js. In non-production the client may instead
// send a bare `phone` (E.164) to bypass Firebase; the service rejects that path
// in production, so a forged `phone` is useless in prod.
export const verifyBody = z
  .object({
    idToken: z.string().min(20).optional(),
    phone: z.string().trim().min(1).optional(),
  })
  .refine((b) => b.idToken || b.phone, {
    message: 'idToken or phone is required',
  });

// Back-office admin login — username + password.
export const adminLoginBody = z.object({
  username: z.string().trim().min(1, 'username is required').max(64),
  password: z.string().min(1, 'password is required').max(128),
});

// Admin push broadcast — title + body sent to every enabled device.
export const adminBroadcastBody = z.object({
  title: z.string().trim().min(1, 'title is required').max(120),
  body:  z.string().trim().min(1, 'body is required').max(500),
});

// Per-key validation for admin settings. Values are stored as strings, but the
// feature code coerces them with Number()/comparison, so an out-of-range value
// (e.g. chat_cost = "-50" or "abc") silently corrupts pricing/behavior. Validate
// each known key's value here so the admin gets a clear error instead of
// persisting garbage. Unknown keys fall through to the generic string check.
const NON_NEG_INT = /^\d+$/;
function settingValueIssue(key, value) {
  const asInt = () => (NON_NEG_INT.test(value) ? Number(value) : NaN);
  switch (key) {
    // Credits/costs — non-negative integers with a sane ceiling.
    case 'initial_credits':
    case 'chat_cost':
    case 'insights_cost':
    case 'daily_cost':
    case 'palm_cost': {
      const n = asInt();
      if (!Number.isInteger(n) || n < 0 || n > 100000) return 'must be an integer between 0 and 100000';
      return null;
    }
    // IST window hours (0–23) and gap hours (0–168).
    case 'notif_window_start':
    case 'notif_window_end': {
      const n = asInt();
      if (!Number.isInteger(n) || n < 0 || n > 23) return 'must be an hour between 0 and 23';
      return null;
    }
    case 'notif_min_gap_hours':
    case 'notif_max_gap_hours': {
      const n = asInt();
      if (!Number.isInteger(n) || n < 0 || n > 168) return 'must be an integer between 0 and 168';
      return null;
    }
    case 'notif_sample_pct': {
      const n = asInt();
      if (!Number.isInteger(n) || n < 1 || n > 100) return 'must be a percentage between 1 and 100';
      return null;
    }
    case 'notif_max_tokens': {
      const n = asInt();
      if (!Number.isInteger(n) || n < 1 || n > 1000000) return 'must be a positive integer';
      return null;
    }
    case 'notif_enabled':
    case 'app_force_update':
      return value === 'true' || value === 'false' ? null : "must be 'true' or 'false'";
    case 'notif_source':
      return value === 'pool' || value === 'ai' ? null : "must be 'pool' or 'ai'";
    case 'notif_audience':
      return ['all', 'random_one', 'random_sample'].includes(value) ? null : "must be 'all', 'random_one', or 'random_sample'";
    default:
      return null; // unknown key — keep the generic string check only
  }
}

// Admin settings update — a batch of { key, value } pairs. Values arrive as
// strings (the column type); feature code coerces with Number() where needed.
export const adminSettingsBody = z.object({
  settings: z.array(z.object({
    key:   z.string().trim().min(1, 'key is required').max(64),
    value: z.string().trim().min(1, 'value is required').max(255),
  })).min(1, 'at least one setting is required'),
}).superRefine((body, ctx) => {
  body.settings.forEach((s, i) => {
    const issue = settingValueIssue(s.key, s.value);
    if (issue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['settings', i, 'value'],
        message: `${s.key} ${issue}`,
      });
    }
  });
});

// RevenueCat webhook envelope. Only the fields we act on are typed; the rest
// passes through untouched (RC adds fields between versions).
export const rcWebhookBody = z.object({
  event: z.object({
    id:                      z.string().max(128).optional(),
    type:                    z.string().max(64),
    app_user_id:             z.string().max(128),
    product_id:              z.string().max(100).optional(),
    transaction_id:          z.string().max(200).nullish(),
    store:                   z.string().max(32).optional(),
    environment:             z.string().max(32).optional(),
  }).passthrough(),
}).passthrough();

// Admin: create a credit plan. priceInr is in paise (integer). credits > 0.
export const adminPlanCreateBody = z.object({
  name:       z.string().trim().min(1, 'name is required').max(80),
  credits:    z.number().int().positive('credits must be > 0'),
  priceInr:   z.number().int().nonnegative('priceInr must be >= 0'),
  bonusLabel: z.string().trim().max(60).optional().nullable(),
  productId:  z.string().trim().max(100).optional().nullable(),
  active:     z.boolean().optional(),
  sortOrder:  z.number().int().optional(),
});

// Admin: update a plan — every field optional (partial patch).
export const adminPlanUpdateBody = adminPlanCreateBody.partial();

// ── Location proxy query params (city picker during onboarding) ──
// Tight caps so the upstream geocoder isn't hammered with oversized/garbage
// input, and lat/lon are constrained to valid Earth coordinates (M3).
export const locationSearchQuery = z.object({
  q:     z.string().trim().min(1, 'q is required').max(120),
  token: z.string().trim().max(64).optional(),
});

export const locationDetailsQuery = z.object({
  placeId: z.string().trim().min(1, 'placeId is required').max(256),
  token:   z.string().trim().max(64).optional(),
  ts:      z.coerce.number().int().nonnegative().optional(),
});

export const locationReverseQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

// ── Admin list pagination (users / purchases) ──
// limit 1..100, offset >= 0 — bounds keep a malformed/hostile query from
// passing a negative or huge page size to Sequelize (M3). `all=true` bypasses
// paging server-side (used by the export buttons).
export const adminListQuery = z.object({
  limit:  z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  search: z.string().trim().max(120).optional(),
  all:    z.enum(['true', 'false']).optional(),
});

// Dashboard analytics window. `days` is clamped again in the service (7..90);
// this just rejects junk before it reaches it.
export const adminAnalyticsQuery = z.object({
  days: z.coerce.number().int().min(7).max(90).optional(),
});

// Device push-token registration. Token length cap matches PushToken's column.
export const pushRegisterBody = z.object({
  token:    z.string().min(20).max(512),
  platform: z.enum(['android', 'ios', 'web']).optional(),
});

export const pushUnregisterBody = z.object({
  token: z.string().min(20).max(512),
});

// Chart memory. `key` is an opaque client string (a timelineCheck key embeds a
// whole question, hence the generous cap); `value` is small JSON — bounded so a
// client can't use the store as free unbounded storage.
export const memorySetBody = z.object({
  key:   z.string().min(1).max(1_000),
  value: z.union([z.string().max(2_000), z.boolean(), z.number(), z.record(z.boolean())]),
});
