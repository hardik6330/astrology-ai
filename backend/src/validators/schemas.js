import { z } from 'zod';

// Birth-detail form — the join key for every user.
// Length caps keep an attacker from padding the Gemini prompt with megabytes.
const formSchema = z.object({
  name:   z.string().trim().min(1, 'name is required').max(80),
  gender: z.string().trim().max(20).optional().nullable(),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time:   z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'time must be HH:MM'),
  city:   z.string().trim().min(1, 'city is required').max(80),
  phone:  z.string().trim().max(20).optional().nullable(),
});

// 20KB ceiling — a real natal chart's fact sheet runs ~6–15KB depending on
// dasha density and timeline depth. Stops megabyte-padding without rejecting
// legitimate charts.
const factSheetSchema = z.string().max(20_000);

// Persist birth details onto the logged-in user's row, no reading generated.
export const profileBody = z.object({
  form: formSchema,
});

export const interpretBody = z.object({
  form: formSchema,
  factSheet: factSheetSchema,
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
    content: z.string().max(2_000),
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
});

export const userQuery = formSchema.partial({ gender: true }).extend({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Auth — the client trades a Firebase ID token (or, on the dummy path, a raw
// phone number) for our own session JWT. See services/authService.js.
export const verifyBody = z.object({
  idToken: z.string().min(20),
});

export const dummyBody = z.object({
  phone: z.string().min(10).max(20),
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

// Admin settings update — a batch of { key, value } pairs. Values arrive as
// strings (the column type); feature code coerces with Number() where needed.
export const adminSettingsBody = z.object({
  settings: z.array(z.object({
    key:   z.string().trim().min(1, 'key is required').max(64),
    value: z.string().trim().min(1, 'value is required').max(255),
  })).min(1, 'at least one setting is required'),
});

// Buy a credit plan — the client sends only the plan id; credits + price are
// read server-side from the plan (never trusted from the client).
export const purchaseBody = z.object({
  planId: z.string().trim().min(1, 'planId is required').max(24),
});

// Admin: create a credit plan. priceInr is in paise (integer). credits > 0.
export const adminPlanCreateBody = z.object({
  name:       z.string().trim().min(1, 'name is required').max(80),
  credits:    z.number().int().positive('credits must be > 0'),
  priceInr:   z.number().int().nonnegative('priceInr must be >= 0'),
  bonusLabel: z.string().trim().max(60).optional().nullable(),
  active:     z.boolean().optional(),
  sortOrder:  z.number().int().optional(),
});

// Admin: update a plan — every field optional (partial patch).
export const adminPlanUpdateBody = adminPlanCreateBody.partial();

// Device push-token registration. Token length cap matches PushToken's column.
export const pushRegisterBody = z.object({
  token:    z.string().min(20).max(512),
  platform: z.enum(['android', 'ios', 'web']).optional(),
});

export const pushUnregisterBody = z.object({
  token: z.string().min(20).max(512),
});
