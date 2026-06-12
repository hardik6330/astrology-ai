# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repo.

## What this project is

Astrology AI Pro — a Vedic astrology + palmistry product with three deployable apps that share one backend:

- `backend/` — Express 5 + Sequelize + MySQL + Firebase Admin + Google Gemini
- `frontend/` — React 19 + Vite (web app, PWA)
- `mobile/` — React Native + Expo SDK 54 (iOS + Android)

Single MySQL DB persists users, kundalis (birth charts), palm readings, daily readings, chat messages, a credit ledger, purchases, system settings, and engagement-push templates. Firebase Phone Auth is the single identity source for both clients; backend verifies ID tokens and issues its own JWTs. A separate username/password admin account (role-based JWT) gates the back-office.

## Core user features

1. **Kundali interpretation** — natal chart + AI reading
2. **Daily guidance** — transit-based personalized reading for any date
3. **AI astrologer chat** — topic-gated Q&A, persisted per user
4. **Palm reading** — client-side quality gate, then Gemini vision analyzes uploaded hand photos (single hand or both-hand comparison)

Every paid feature spends **credits**; users top up via Razorpay (web) with a mock fallback. An **admin panel** (in both the web app under `/admin` and the API under `/api/admin`) manages users, credit plans, feature costs, manual pushes, and the randomised engagement-push settings.

## Important architecture notes

### Duplicated astrology engine
`frontend/src/shared/astrology.js` and `mobile/src/shared/astrology.js` are ~950-line **intentional duplicates**. Both clients compute charts locally via `astronomy-engine`, then POST the facts to the backend for Gemini interpretation. **When changing chart logic, edit both files** until a shared package is extracted. Same goes for `shared/prompts.js` (and the palm-gate files — see below).
- `chart.transits.gochar` is the **live-sky** array (all 9 grahas' current sidereal position + `houseLagna` — house transited from the natal ascendant — plus `sign`, `deg`, `houseMoon`, `area`, `retro`). It drives the mobile Gochar map (below) and is computed in BOTH engine files — keep it in sync. It reflects `now` at chart-build time (per session), not a live tick.

### Serverless/Sequelize mismatch
Backend is deployed on Vercel (serverless), but uses Sequelize + persistent MySQL. Two implications:
- `sequelize` dialect modules (`mysql2`) are loaded dynamically — Vercel's tracer can't see the import. `backend/src/config/dbConfig.js` includes an explicit `import 'mysql2'` to force inclusion in the bundle. **Don't remove it.**
- `app.listen()` is ignored by Vercel. The app still works because Vercel detects the Express handler, but cold starts re-create connection pools. For a more reliable host, Render / Railway / Fly run the app as written.

### Firebase service account loading
`backend/src/config/firebase.js` tries three sources in order:
1. `FIREBASE_SERVICE_ACCOUNT_B64` env var (preferred — production)
2. `FIREBASE_SERVICE_ACCOUNT_JSON` env var (raw JSON)
3. `firebase-admin.json` file in `backend/src/config/` (dev only, gitignored)

Never commit the JSON file. It was leaked once already (see git history for commit `5c31ab2`); GitHub push protection now blocks it.

### Schema management
`backend/src/server.js` calls `sequelize.sync()` (non-destructive: creates missing tables, doesn't alter or drop) on every boot. Migrations live in `backend/migrations/` (Umzug). For schema changes that aren't simple table creation, write a migration. `sync()` alone won't add new columns to existing tables. On boot the server also seeds defaults (admin account, system settings, credit plans, notification templates) idempotently.

### Credits & payments
Every paid feature deducts **credits** from `User.credits`; an append-only `CreditTransaction` ledger records every grant/spend (never updated, only inserted — keep it that way for auditability). Feature costs (`chat_cost`, `insights_cost`, `daily_cost`, `palm_cost`) and the signup bonus (`initial_credits`) live in the `Setting` table, not in code, and are editable from the admin panel — read them live via `settingsService` (60s cache).
- `creditService.charge()` does an atomic guarded decrement (`... WHERE credits >= cost`) and throws HTTP 402 `INSUFFICIENT_CREDITS` if the user can't cover it. Clients surface this as a low-credits prompt.
- Purchases: `purchaseService` opens a `Purchase` (snapshotting plan credits + price so later plan edits don't rewrite past orders), then settles via Razorpay or a mock provider. **Razorpay verification recomputes the HMAC-SHA256 signature server-side**; `Purchase.providerTxnId` is UNIQUE so replays never double-credit (settlement is idempotent). Razorpay is active only when `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` are set; otherwise checkout falls back to mock.
- **Mobile native IAP** (web stays Razorpay): the mobile client (`mobile/src/features/credits/CreditsScreen.js`) uses `react-native-iap`. A plan opts into the store flow when its `CreditPlan.productId` (the App Store / Play Store SKU) is set — otherwise it falls through to the mock `/credits/purchase` path. After the native purchase, the client POSTs to `/credits/verify-iap` and the backend verifies the receipt: iOS via Apple's `verifyReceipt` (`APPLE_IAP_SECRET`, with the 21007 sandbox-retry), Android via the Play Developer API (`GOOGLE_IAP_SERVICE_ACCOUNT_JSON`). Verified grants are idempotent on `providerTxnId` (the store transaction/order id), same as Razorpay.
  - **Gaps as of this writing:** no plan has a `productId` yet (admin CRUD + `AdminPlans.jsx` don't expose the field), and the two store secrets aren't configured — so mobile currently runs the mock path end-to-end. **`react-native-iap` is a native module → no IAP in Expo Go; needs an EAS build.**

### Randomised engagement-push system
"Vibe" notifications sent at unpredictable times within a configurable IST waking window. All knobs live in the `Setting` table and are edited from the admin Notifications panel: `notif_enabled`, `notif_source` (`pool` curated templates vs `ai` Gemini-Flash-generated), `notif_audience` (`all` / `random_one` / `random_sample`), `notif_sample_pct`, `notif_window_start`/`notif_window_end` (IST hours), `notif_min_gap_hours`/`notif_max_gap_hours`, `notif_max_tokens` (fan-out cap so Vercel doesn't time out), and the internal auto-managed `notif_next_at` (epoch ms).
- Core logic: `backend/src/services/engageService.js` (picks a random gap, clamps to the window, atomic CAS on `notif_next_at` to prevent double-sends), `notificationService.js` (low-level FCM fan-out + dead-token pruning), `cronController.js` (job dispatch).
- **Two scheduling modes:** on Vercel, an external cron (cron-job.org / GitHub Actions / Vercel Cron) hits `GET /api/cron/run?job=engage` every ~5 min, authenticated by `CRON_SECRET` (`x-cron-secret` header or `Authorization: Bearer`); the handler no-ops until due + in-window. On an always-on host, `backend/src/config/scheduler.js` (node-cron) calls `sendEngagement()` directly. See `backend/NOTIFICATIONS_SETUP.txt`.

### Admin back-office
Separate from user auth: a username/password `Admin` account (scrypt-hashed), seeded from `ADMIN_NAME`/`ADMIN_USERNAME`/`ADMIN_PASSWORD`, logs in for a role=`admin` JWT. `requireAdmin` middleware gates `/api/admin/*` (stats, user list/search, broadcast + per-user push, settings CRUD, credit-plan CRUD). The web UI lives under `frontend/src/admin/` (own context, layout, and pages incl. `AdminSettings.jsx` which renders the costs + notifications forms). Credit plans soft-delete via an `active` flag so historical purchases keep valid FKs.

### Client-side palm gate
Before any palm photo reaches the backend, both clients run a local quality gate (`frontend/src/utils/palmGate.js`, `mobile/src/features/palm/palmGate.js`) using MediaPipe Hands + pixel heuristics (luminance, Laplacian blur, palm coverage, edge score, lighting variance, claimed-hand check). It rejects bad photos locally — saving Gemini tokens — and returns an ordered `checks` array plus 21 hand landmarks (drawn by `PalmSkeletonOverlay.jsx`). The scored `checks` are rendered as a pill checklist: web in `PalmGateChecklist.jsx`, mobile in `mobile/src/features/palm/sections/GateChecklist.js`. **Keep the check labels identical across both gate files** (they carry the measured scores, e.g. `Palm lines visible (edge score 411)`) and **keep thresholds + logic in sync like the astrology engine.** On mobile the checklist is shown **only on the scanning screen** (`UploadView.js`, scanning state) — the pre-scan picker shows just a plain "Reading photo…" spinner, no numbers. Mobile must pre-resize via `expo-image-manipulator` before decoding (full-res decode takes 40–50s).
- On a **passing** photo the gate also returns `confidence` (0–100) via `confidenceScore()` — a blend of brightness/sharpness/coverage with an identical formula in both gate files. The checklist shows it as an "AI Confidence" header (green/amber/red). Not shown on rejects (the reject card shows instead).
- The pre-scan picker carries a **truthful privacy badge** — the backend persists only a SHA-256 hash + the text reading, never the image bytes, so the copy says "never saved." **Don't claim "encrypted"** (no at-rest DB encryption).

### Reading trust & interactivity (the "Show Your Work" layer)
Cross-cutting features that make the reading feel computed and credible rather than generated. Most are mobile-first; the web twins are noted.
- **Show-Your-Work badges.** The kundali prompt (`backend/src/ai/prompts.js`) returns an `evidence` object (personality/career/relationships → the exact placements behind each section); rendered as an "Astrology logic" badge in `InsightsTab.jsx` (web) + `ReadingTab.js` (mobile). The palm reading attaches the **measured** geometry buckets (`backend/src/utils/palmGeometry.js` → `parsed.geometry`) — the "Palmistry Math" chips render from that real data, **never model-invented numbers**.
- **Timeline Check.** The kundali prompt returns `pastCheck` `{question, basis}` — a grounded yes/no tied to a real dasha window. The card (`ReadingTab.js` / `InsightsTab.jsx`) is **honest by design**: the acknowledgement reflects the user's actual Yes/No, never a fake "confirmed." The answer is **persisted** keyed by `timelineCheck:<question>` (mobile `utils/storage` AsyncStorage; web `localStorage`) so it's never re-asked. Persistence is on-device, not synced to the account.
- **Prediction Confidence** ("Backed by Your Chart"): reuses `chart.confidence` (count of independent chart signatures per theme), surfaced in `ReadingTab.js` next to the analysis (full breakdown lives in `TimelineTab.js`).
- **Interactive planets**: `PlanetsTab.js` rows are tappable → `PlanetDetailSheet.js` (RN `Modal`, Expo-Go-safe) using the static `features/reading/planetInfo.js` dictionary; the placement line is pulled live from the chart.
- **Expandable dasha forecast**: `TimelineTab.js` forecast cards expand (`LayoutAnimation`, no reanimated dep) to show the `why` reasoning + static per-lord Do's/Don'ts (`DASHA_GUIDANCE` in `planetInfo.js`).
- **Gochar map**: `mobile/src/features/kundali/GocharMap.js` — an SVG sidereal zodiac wheel (matches `DashaWheel`/`AshtakvargaWheel` style) plotting `chart.transits.gochar` with the natal lagna marked, plus an impact list. Mobile-only UI; the `gochar` data exists in both engines.

## Build and deployment

### Backend (Vercel)
- Root directory: `backend` (configured in Vercel project settings, not `vercel.json`)
- Env vars set in Vercel dashboard, including the base64 Firebase credential
- Production DB: Railway MySQL (host = `RAILWAY_TCP_PROXY_DOMAIN`, port = `RAILWAY_TCP_PROXY_PORT`)
- Run migrations manually against Railway DB; don't auto-run them on cold starts

### Mobile (EAS)
- Build profile `preview` produces an APK with internal distribution + OTA updates on the `preview` channel
- iOS distribution requires a paid Apple Developer account; no workaround exists for free iOS install
- `eas update --branch preview` ships JS-only changes to installed APKs
- `eas build` is required for: new native modules, `app.json` icon/splash/permissions changes, SDK upgrades
- EAS env vars are separate from local `.env`. Set with `eas env:create --environment preview --name X --value Y --visibility plaintext`

### Mobile native modules in use
`expo-blur` (login card), `expo-updates` (OTA), `expo-image-picker` (palm photos), `expo-image-manipulator` (palm pre-resize), `expo-constants` (Expo-Go detection), `@react-native-community/datetimepicker`, `react-native-reanimated`, `react-native-svg`, `react-native-gesture-handler`, `react-native-iap` (credit IAP), `@react-native-firebase/{app,auth,messaging,analytics}` + `@notifee/react-native` (push + analytics). Adding more native modules requires `eas build`, not `eas update`.
- **These native modules don't exist in Expo Go**, so push (`@react-native-firebase/messaging` + Notifee), analytics, and IAP no-op there. The code guards every call behind `const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient` (see `mobile/src/features/notifications/push.js`, `analytics.js`, `index.js`, `CreditsScreen.js`) so the app runs cleanly in Expo Go with those features silently disabled. To actually exercise them, do an EAS dev/preview build.

## Conventions

- **Comments:** terse, explain *why*, not *what*. The existing codebase has good examples — match its style.
- **Env validation:** new backend env vars must be added to `backend/src/config/envConfig.js` Zod schema, or they won't be loaded.
- **Sequelize models:** register associations in `backend/src/models/index.js`, don't scatter them.
- **Routes:** mount under `/api` in `backend/src/server.js`. Each feature has its own router + controller + service trio.
- **Tunable values go in `Setting`, not code.** Feature costs, signup bonus, and all `notif_*` knobs are DB-backed and admin-editable — read them via `settingsService`. If you add a new tunable, also add its default to the settings seed and surface it in `AdminSettings.jsx`.
- **Credit ledger is append-only.** Charge/grant through `creditService` (atomic guarded updates); never mutate `User.credits` directly or update old `CreditTransaction` rows.
- **API responses are enveloped** as `{ success, message, data }` by `responseWrapper`; clients unwrap `data` and read `.code` for error handling (e.g. `INSUFFICIENT_CREDITS`).
- **Mobile theme:** all colors flow from `mobile/src/theme/ThemeContext.js` and `tokens.js`. Don't hardcode colors in components if a token exists.
- **Mobile back navigation:** the app uses a single "home base" model — every top-level drawer screen sends Android hardware-back to the Reading/Kundali screen via the `useBackToKundali(navigation)` hook (Profile, Help, Palm, PalmStep, PalmCompare, Chat, Credits). Reading itself backs sub-tab → Kundali → exit-app. New screens of this kind should add the hook too. `RootNavigator` also waits for `ChartContext` to hydrate before mounting the drawer, so `initialRoute` is deterministic (returning users open straight on Reading, not the Home form).

## Things that have bitten in the past

- **Secrets in chat / screenshots.** Multiple keys (`firebase-admin.json`, Gemini API key, MySQL root password) have been visible in screenshots and pasted into conversations. Treat each as compromised when that happens. Rotate immediately; never reuse.
- **`backendColor: "transparent"` + `elevation` on Android** = dark inner fill (bug in RN's elevation shadow when there's no opaque background). Remove elevation or use a solid background.
- **EAS local `.env` is not uploaded to cloud builds.** Use `eas env:create` instead, or APKs ship pointing at `localhost`.
- **Vercel root directory misconfiguration** — if logs show `/var/task/backend/src/...` instead of `/var/task/src/...`, Root Directory isn't set to `backend`, and `npm install` won't run for the backend.
- **Sequelize sync race on serverless cold starts** — current code accepts this; if it becomes a problem, gate `sync()` behind a one-time flag or move to migrations-only.
- **Double-crediting on payment replay** — guarded by the UNIQUE `Purchase.providerTxnId` and an atomic settlement. Don't weaken either; a retried webhook/verify must never grant twice.
- **Razorpay signature must be verified server-side** — never trust a client-reported "paid" status; `purchaseService` recomputes the HMAC and constant-time compares.
- **Engagement-push double-sends** — the engage job relies on an atomic compare-and-set of `notif_next_at`. If you refactor scheduling, preserve that guard or overlapping cron hits will fan out twice.
- **IAP mock-fallback grants free credits** — when `APPLE_IAP_SECRET` / `GOOGLE_IAP_SERVICE_ACCOUNT_JSON` are unset, `verifyAppleReceipt`/`verifyGooglePurchase` return a fake `mock_*_<timestamp>` txn id and credits are granted. Fine for dev, but in production this lets any authed client farm credits via `/credits/verify-iap` (the mock id is unique each call, so the `providerTxnId` guard doesn't stop it). Before shipping real IAP, make missing secrets fail closed in production. Also: the iOS path doesn't yet verify the receipt's product matches the requested `planId` (the Android path does) — bind it before relying on it.
- **Android emoji/glyph clipping** — emoji AND unicode astro glyphs (zodiac `ZE[sign]` ♏, planet symbols ♀/♄) in a `Text` get their top/bottom cut when `lineHeight` is tight and the default `includeFontPadding: true` applies. For any icon glyph, set a generous `lineHeight` (≈1.4× fontSize) **and** `includeFontPadding: false` (see the palm reading styles, `sheetPlacementText`, and `GocharMap` `impSign`).

## Quick command reference

```bash
# Backend dev
cd backend && npm run dev

# Frontend dev
cd frontend && npm run dev

# Mobile dev (Expo Go)
cd mobile && npx expo start

# Build Android APK
cd mobile && eas build --platform android --profile preview

# Ship JS update to installed APKs
cd mobile && eas update --branch preview --message "..."

# Run migrations against Railway DB
cd backend && DB_HOST=<host> DB_PORT=<port> DB_USER=root DB_PASS='<pass>' DB_NAME=railway NODE_ENV=production npm run migrate

# Manually trigger an engagement push (needs CRON_SECRET)
curl -H "x-cron-secret: <secret>" "http://localhost:5000/api/cron/run?job=engage_now"
```

## Where to look

- API entry point + route mounts: `backend/src/server.js`
- Models + associations: `backend/src/models/` (`index.js` for associations)
- AI prompts (canonical) / Gemini wrapper: `backend/src/ai/prompts.js`, `backend/src/ai/gemini.js`
- Chart math (web + mobile): `frontend/src/shared/astrology.js` + `mobile/src/shared/astrology.js` (incl. `transits.gochar` live-sky array — keep in sync)
- Reading UI (mobile): `mobile/src/features/reading/sections/` (`ReadingTab.js`, `PlanetsTab.js`, `TimelineTab.js`, `PlanetDetailSheet.js`) + `planetInfo.js`; web reading: `frontend/src/features/reading/InsightsTab.jsx`
- Gochar map (mobile): `mobile/src/features/kundali/GocharMap.js` (alongside `DashaWheel.js`, `AshtakvargaWheel.js`)
- Palm geometry / "Palmistry Math": `backend/src/utils/palmGeometry.js` → attached as `reading.geometry`; rendered in palm `ReadingResult` (web `pages/PalmPage.jsx`, mobile `sections/ReadingResult.js`)
- Credits & payments: `backend/src/services/creditService.js`, `purchaseService.js`, `config/razorpay.js`
- Engagement pushes: `backend/src/services/engageService.js`, `notificationService.js`, `config/scheduler.js`, `backend/NOTIFICATIONS_SETUP.txt`
- DB-backed settings: `backend/src/services/settingsService.js` (+ `settingsSeed.js`)
- Admin (API): `backend/src/routes/adminRoutes.js`, `controllers/adminController.js`, `services/adminService.js`
- Admin (web): `frontend/src/admin/` (settings UI: `admin/pages/AdminSettings.jsx`)
- Palm gate (keep in sync): `frontend/src/utils/palmGate.js` + `mobile/src/features/palm/palmGate.js`; gate checklist UI: `frontend/src/components/PalmGateChecklist.jsx` + `mobile/src/features/palm/sections/GateChecklist.js`
- Mobile palm flow: `mobile/src/features/palm/PalmScreen.js` (+ `sections/UploadView.js`, `ReadingResult.js`), `PalmStepScreen.js`, `PalmCompareScreen.js`
- Mobile credits / IAP: `mobile/src/features/credits/CreditsScreen.js`; backend IAP verify: `backend/src/services/purchaseService.js` (`verifyIapPayment`)
- Mobile back-nav hook: `mobile/src/utils/useBackToKundali.js`
- Web entry / routes: `frontend/src/App.jsx` → `frontend/src/routes.jsx`; API client: `frontend/src/common/apiClient.js`
- Shared client state: `frontend/src/context/ChartContext.jsx` (mobile: `mobile/src/context/ChartContext.js`)
- Mobile root: `mobile/App.js` → `mobile/src/navigation/RootNavigator.js`
- Mobile splash: `mobile/src/components/SplashScreen.js`
- Mobile drawer: `mobile/src/components/DrawerContent.js`
- Auth (mobile): `mobile/src/features/auth/AuthContext.js`
