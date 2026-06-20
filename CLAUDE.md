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
`frontend/src/shared/astrology.js` and `mobile/src/shared/astrology.js` are **intended duplicates** that compute charts locally via `astronomy-engine`, then POST the facts to the backend for Gemini interpretation. **When changing chart logic, edit both files** until a shared package is extracted. Same goes for `shared/prompts.js` (and the palm-gate files — see below).
- ⚠️ **They have already drifted** — web is ~1484 lines, mobile ~964 (the web engine carries ~520 more logic lines), and the `planetInfo.js` twins are out of sync too (mobile is missing the `dos`/`donts` dasha-guidance block the web copy has). The "keep in sync" rule is aspirational, not currently true; treat any cross-file change as a reconciliation, not a blind copy. Extracting a shared `packages/astrology-core` is the real fix.
- `chart.transits.gochar` is the **live-sky** array (all 9 grahas' current sidereal position + `houseLagna` — house transited from the natal ascendant — plus `sign`, `deg`, `houseMoon`, `area`, `retro`). It drives the mobile Gochar map (below) and is computed in BOTH engine files — keep it in sync. It reflects `now` at chart-build time (per session), not a live tick.

### Deployment host: always-on Oracle VPS (Vercel still supported)
**Production now runs on an always-on Oracle VPS** (pm2 + nginx), deployed by GitHub Actions on push to `main` — see `.github/workflows/deploy.yml` and the deployment section below. The old Vercel serverless path is still supported in code (`process.env.VERCEL === '1'` branch) but is no longer the primary target. Because the VPS is a long-lived process, the app runs **as written**: `app.listen()` binds a port, the in-process `startScheduler()` (node-cron) drives engagement pushes, and connection pools persist (no cold-start churn). The Sequelize + persistent MySQL design now fits the host cleanly.
- `sequelize` dialect modules (`mysql2`) are still loaded dynamically; `backend/src/config/dbConfig.js` keeps an explicit `import 'mysql2'` to force bundle inclusion (matters for Vercel; harmless on the VPS). **Don't remove it.**
- `backend/src/server.js` holds **both** `createApp()` (the Express app — default-exported for the Vercel handler + tests) **and** the startup `start()`. On boot it runs `initDatabase()` (`authenticate` + seeds; `sync()` only in non-production) and `initFirebase()`; in production a failure does `process.exit(1)`, so an **unreachable DB → the process exits** (on the VPS pm2's health-check fails and CI rolls back; on Vercel every route returns `FUNCTION_INVOCATION_FAILED`). The Vercel branch is gated on `process.env.VERCEL === '1'` (exact string match — env vars are strings, so a bare `if (process.env.VERCEL)` treats `"0"` as truthy). On Vercel it skips `app.listen()` + the scheduler; on the VPS (no `VERCEL`) it binds the port and starts node-cron. **Never set `VERCEL` in a local `.env`** — it makes the dev server skip `app.listen()` and exit immediately ("clean exit"). The app exposes `GET /health` → `{status:'ok'}`, which the deploy workflow polls before flipping the release live.

### Firebase service account loading
`backend/src/config/firebase.js` tries three sources in order:
1. `FIREBASE_SERVICE_ACCOUNT_B64` env var (preferred — production)
2. `FIREBASE_SERVICE_ACCOUNT_JSON` env var (raw JSON)
3. `firebase-admin.json` file in `backend/src/config/` (dev only, gitignored)

Never commit the JSON file. It was leaked once already (see git history for commit `5c31ab2`); GitHub push protection now blocks it.

### Schema management
`backend/src/server.js` calls `sequelize.sync()` (non-destructive: creates missing tables, doesn't alter or drop) **only when `NODE_ENV !== 'production'`** — production is migrations-only. For schema changes that aren't simple table creation, write a migration. `sync()` alone won't add new columns to existing tables. On boot the server also seeds defaults (admin account, system settings, credit plans, notification templates) idempotently.
- **Production schema bootstrap:** `npm run sync-schema` (`backend/src/scripts/syncSchema.js`) is a one-off that forces a `sync()` **regardless of `NODE_ENV`** — run it ONCE against a fresh prod DB (e.g. on the Oracle VPS) before flipping to production, since `server.js` won't sync in prod. Because it builds tables fresh, it also emits the real FK constraints (`ON DELETE CASCADE`/`SET NULL`) from `models/index.js` — so a brand-new DB gets DB-level referential integrity. It will NOT add FKs/columns to tables that already exist; for that, migrate. `--alter` exists but is throwaway-DB-only (risky).
- ⚠️ **The Umzug migration harness is wired but there are currently ZERO migration files** — `backend/config/umzug.js`, `src/scripts/migrate.js`, and the `migrate`/`migrate:down`/`migrate:status` npm scripts all exist, but `backend/migrations/` does not. So once a prod DB is bootstrapped (via `sync-schema`), the schema is frozen at that snapshot, and **any column add to an existing table silently does nothing → `Unknown column` at runtime.** Before evolving the schema, establish a baseline migration (mirror the current 14 models with `CREATE TABLE IF NOT EXISTS` + indexes, "fake" it as already-run on existing DBs) and add the missing `Purchase.planId` index. The deploy workflow has a commented-out `npm run migrate` hook (runs after the symlink flip, before the health-check) ready to wire once a baseline exists.

### Credits & payments
Every paid feature deducts **credits** from `User.credits`; an append-only `CreditTransaction` ledger records every grant/spend (never updated, only inserted — keep it that way for auditability). Feature costs (`chat_cost`, `insights_cost`, `daily_cost`, `palm_cost`) and the signup bonus (`initial_credits`) live in the `Setting` table, not in code, and are editable from the admin panel — read them live via `settingsService` (60s cache).
- `creditService.charge()` does an atomic guarded decrement (`... WHERE credits >= cost`) and throws HTTP 402 `INSUFFICIENT_CREDITS` if the user can't cover it. Clients surface this as a low-credits prompt.
- Purchases: `purchaseService` opens a `Purchase` (snapshotting plan credits + price so later plan edits don't rewrite past orders), then settles via Razorpay or a mock provider. **Razorpay verification recomputes the HMAC-SHA256 signature server-side**; `Purchase.providerTxnId` is UNIQUE so replays never double-credit (settlement is idempotent). Razorpay is active only when `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` are set; otherwise checkout falls back to mock.
  - **The mock checkout fails closed in production:** `createOrder` refuses to open a `mock`-provider order and `confirmOrder` refuses to settle one when `NODE_ENV === 'production'` (throws `503 PAYMENTS_NOT_CONFIGURED`). So in prod, Razorpay **must** be configured — the old free-credit path (any authed client hitting `/credits/purchase` while Razorpay was unset) is closed server-side, not just behind the mobile client's `__DEV__` guard.
- **Mobile native IAP** (web stays Razorpay): the mobile client (`mobile/src/features/credits/CreditsScreen.js`) uses `react-native-iap`. A plan opts into the store flow when its `CreditPlan.productId` (the App Store / Play Store SKU) is set — otherwise it falls through to the mock `/credits/purchase` path. After the native purchase, the client POSTs to `/credits/verify-iap` and the backend verifies the receipt: iOS via Apple's `verifyReceipt` (`APPLE_IAP_SECRET`, with the 21007 sandbox-retry), Android via the Play Developer API (`GOOGLE_IAP_SERVICE_ACCOUNT_JSON`). Verified grants are idempotent on `providerTxnId` (the store transaction/order id), same as Razorpay. **Idempotency ordering:** `verifyIapPayment` `INSERT`s the `Purchase` row (status `paid`) **before** calling `grant()`, so a concurrent duplicate verify aborts on the `UNIQUE(providerTxnId)` violation *before* any ledger write — the violation is caught and returned as `409 IAP_ALREADY_PROCESSED`, never a raw 500 or a double-grant. (Don't reorder grant-before-insert.)
  - **`react-native-iap` is now installed** (`^14.4.9`) with a real wrapper `mobile/src/features/credits/iapClient.js` (lazy native `require`, targets the v14+ nitro API) — the native store path is live code, not dead. **Remaining gaps:** no plan has a `productId` yet (the model + `purchaseService` support it, but the admin CRUD + `AdminPlans.jsx` don't expose the field), and the two store secrets aren't configured — so mobile still runs the mock path end-to-end until a plan opts in. **`react-native-iap` is a native module → no IAP in Expo Go; needs an EAS build.**
  - The backend IAP verify now **fails closed in production** when a store secret is missing (`verifyAppleReceipt`/`verifyGooglePurchase` return null + log an error instead of granting), so the old free-credit-farming gap is closed in prod; the mock txn id is still issued in dev only.

### Randomised engagement-push system
"Vibe" notifications sent at unpredictable times within a configurable IST waking window. All knobs live in the `Setting` table and are edited from the admin Notifications panel: `notif_enabled`, `notif_source` (`pool` curated templates vs `ai` Gemini-Flash-generated), `notif_audience` (`all` / `random_one` / `random_sample`), `notif_sample_pct`, `notif_window_start`/`notif_window_end` (IST hours), `notif_min_gap_hours`/`notif_max_gap_hours`, `notif_max_tokens` (fan-out cap so Vercel doesn't time out), and the internal auto-managed `notif_next_at` (epoch ms).
- Core logic: `backend/src/services/engageService.js` (picks a random gap, clamps to the window, atomic CAS on `notif_next_at` to prevent double-sends), `notificationService.js` (low-level FCM fan-out + dead-token pruning), `cronController.js` (job dispatch).
- **Two scheduling modes:** on Vercel, an external cron (cron-job.org / GitHub Actions / Vercel Cron) hits `GET /api/cron/run?job=engage` every ~5 min, authenticated by `CRON_SECRET` (`x-cron-secret` header or `Authorization: Bearer`); the handler no-ops until due + in-window. On an always-on host, `backend/src/config/scheduler.js` (node-cron) calls `sendEngagement()` directly. See `backend/NOTIFICATIONS_SETUP.txt`.

### Custom notification sound
A bundled `notification.wav` plays on incoming pushes. Per-platform reality differs:
- **Web, app open (foreground)**: `webPush.js` plays `new Audio('/notification.wav')` (file in `frontend/public/`). Best-effort — browser autoplay may block the first one.
- **Web, backgrounded**: **not possible** — a service-worker `showNotification` only triggers the system sound. Don't try to "fix" this from the backend payload.
- **Android**: the sound lives on a notification **channel** (`default-sound`), created with `sound: "notification"` in `push.js` (channel sound is immutable, so it's a NEW id, not the old `default`). The `.wav` is bundled into `res/raw` by the local config plugin `mobile/plugins/withNotificationSound.js` (from `mobile/assets/sounds/notification.wav`). Foreground uses notifee; background (FCM-drawn) is routed to the same channel by `notificationService.js` (`android.notification.channelId`).
- **iOS**: payload `apns.sound` + bundled file are set, but dormant until APNs/paid Apple account exists.
- ⚠️ **Deploy order**: the backend `channelId` points at a channel only the rebuilt app creates. Ship the **EAS build first, then the backend** — otherwise Android 8+ silently drops background notifications for not-yet-updated users. Sound + channel are a native change → **`eas build`, not `eas update`**.

### Admin back-office
Separate from user auth: a username/password `Admin` account (scrypt-hashed), seeded from `ADMIN_NAME`/`ADMIN_USERNAME`/`ADMIN_PASSWORD`, logs in for a role=`admin` JWT. `requireAdmin` middleware gates `/api/admin/*` (stats, user list/search, broadcast + per-user push, settings CRUD, credit-plan CRUD). The web UI lives under `frontend/src/admin/` (own context, layout, and pages incl. `AdminSettings.jsx` which renders the costs + notifications forms). Credit plans soft-delete via an `active` flag so historical purchases keep valid FKs.

### Security model
The app has had a full security pass; these invariants must hold (don't regress them):
- **Identity is token-bound (no IDOR).** Every user-data route derives the acting account from the verified JWT, never the request body: controllers wrap the form/query with `withAuthPhone(req, …)` (`backend/src/utils/authForm.js`), and `phone` is stripped from the Zod schemas. Phone lookups use **full E.164 matching for any country** (`utils/phone.js`) — don't reintroduce last-10-digit matching (cross-country collisions reopen IDOR).
- **Admin tokens are isolated.** Signed with a dedicated `ADMIN_JWT_SECRET` (required + **distinct** from `JWT_SECRET` in prod, enforced in `envConfig.js` superRefine) plus an `aud: astro-admin` claim, so a user JWT can't be verified as admin (`middleware/auth.js`). The default admin password is rejected at boot in production.
- **LLM inputs are fenced.** Wrap any untrusted text (fact sheet, daily `ctx`, `name`/`gender`, chat turns) with `fenceUntrusted`/`sanitizeInline` (`utils/promptSafety.js`) and append `UNTRUSTED_DATA_GUARD` to the system prompt before calling Gemini. The chat topic gate is **enforced** (off-topic → canned refusal + credit refund, no Pro call). Every Gemini call is capped with `maxOutputTokens` (`config/constants.js` → all three call paths in `ai/gemini.js`).
- **Uploads.** `validateImage` checks magic bytes **and** parses header dimensions to reject decompression bombs before Jimp decodes (`utils/imageValidator.js`). The client `skipGate` flag is **advisory** — `palmService.landmarksCredible()` must accept the supplied 21-point landmarks, else the server runs its own Flash gate.
- **Rate limiting** is per-account when authenticated, per-IP (IPv6-normalized via `ipKeyGenerator`) for pre-auth routes (`middleware/rateLimit.js`). **Every route runs a Zod schema** via `validate()` (`middleware/validate.js` + `validators/schemas.js`); the full `issues[]` is dev-only in the error response.
- **Transport.** Strict CSP (build-time `<meta>`, env-driven `connect-src`) in `frontend/vite.config.js` + HTTP headers in `frontend/vercel.json` — **no `$comment`/unknown top-level keys** there (Vercel's schema rejects them and fails the build). Mobile session JWT lives in the OS keychain via `expo-secure-store` (`mobile/src/utils/tokenStore.js`), not plaintext AsyncStorage; `redirectOn401:false` on the admin-login call so a bad-credential 401 shows the form error instead of bouncing to `/login`. The **admin web session validates the token `exp` client-side** (`AdminAuthContext.validStoredAdminToken` — drops an expired token so `AdminRoute` redirects before the back-office shell mounts), and admin API 401/403s clear the admin session → `/admin/login` (the shared user 401 handler deliberately preserves `admin_token`, so admin auth failures are handled in `adminApi.js`, not the shared client).
- **OTP bypass is a production-gated toggle.** `POST /auth/dummy-login` no longer exists; it was replaced by `POST /auth/verify-otp`, which takes either a Firebase `idToken` (real verify) or a bare `phone` (bypass). The bypass is allowed in non-prod always, and in production **only if `OTP_ENABLED='false'` is explicitly set** (`authService.bypassOtp` throws `OTP_BYPASS_DISABLED` otherwise; default `OTP_ENABLED='true'`). ⚠️ **`OTP_ENABLED='false'` on a live deployment is a full auth bypass** — anyone can mint a session as any phone (`bypass:+<phone>` synthetic uid). Never set it in prod; prefer Firebase test phone numbers for QA.
- **Still open (close before a public launch):** real secrets are committed in the `*/.env.example` files (incl. the base64 Firebase service account, `JWT_SECRET`, `CRON_SECRET`, Razorpay/Gemini/Maps keys) — **rotate + scrub + purge git history**; and rate limiting uses an **in-memory store**, which is per-instance and effectively defeated under serverless scale-out (move to Redis/Upstash before relying on it on Vercel). Both mock-payment paths (IAP **and** Razorpay mock checkout) now fail closed in production (no longer open free-credit paths).

### Client-side palm gate
Before any palm photo reaches the backend, both clients run a local quality gate (`frontend/src/utils/palmGate.js`, `mobile/src/features/palm/palmGate.js`) using MediaPipe Hands + pixel heuristics (luminance, Laplacian blur, palm coverage, edge score, lighting variance, claimed-hand check). It rejects bad photos locally — saving Gemini tokens — and returns an ordered `checks` array plus 21 hand landmarks (drawn by `PalmSkeletonOverlay.jsx`). The scored `checks` are rendered as a pill checklist: web in `PalmGateChecklist.jsx`, mobile in `mobile/src/features/palm/sections/GateChecklist.js`. **Keep the check labels identical across both gate files** (they carry the measured scores, e.g. `Palm lines visible (edge score 411)`) and **keep thresholds + logic in sync like the astrology engine.** On mobile the checklist is shown **only on the scanning screen** (`UploadView.js`, scanning state) — the pre-scan picker shows just a plain "Reading photo…" spinner, no numbers. Mobile must pre-resize via `expo-image-manipulator` before decoding (full-res decode takes 40–50s).
- On a **passing** photo the gate also returns `confidence` (0–100) via `confidenceScore()` — a blend of brightness/sharpness/coverage with an identical formula in both gate files. The checklist shows it as an "AI Confidence" header (green/amber/red). Not shown on rejects (the reject card shows instead).
- The pre-scan picker carries a **truthful privacy badge** — the backend persists only a SHA-256 hash + the text reading, never the image bytes, so the copy says "never saved." **Don't claim "encrypted"** (no at-rest DB encryption).

### Shared display / terminology layer (`uiStrings.js`, `planetText.js`, `panchangText.js`, `labels.js`)
A presentation layer that converts the engine's Vedic Sanskrit jargon into professional English **at render time only** — the data layer keeps Sanskrit keys (they're the lookup keys for guidance content), so these helpers are display-only and must **never mutate chart data**. Several web↔mobile twin pairs, identical except the "keep in sync" comment direction — **keep in sync like the astrology engine**:
- `shared/uiStrings.js` — the `STRINGS` dictionary (CHART / LABELS / PANCHANG / INSIGHTS / ACTIONS / COMMON groups). Single source of UI copy across both clients; centralizes the English relabelling (Lagna→Ascendant, Janma Nakshatra→Birth Star, Tithi→Lunar Day, Nakshatra→Lunar Mansion, Mahadasha→Major Period, Antardasha→Sub-Period, "Ask"→"Interpret", etc.). Reach for `STRINGS.*` instead of hardcoding user-facing strings in the kundali/reading components.
- `utils/labels.js` — the `LABELS` flat dictionary: broader UI copy than `STRINGS`, covering credits, auth/OTP, the palm-gate reject titles+tips, scanning messages, birth-details form, and dosha/condition labels. Same relabelling intent (Lagna→Ascendant, Tithi→Lunar Day, Mangal/Kaal Sarp/Sade Sati/Pitra doshas → plain-English condition names). Reach for `LABELS.*` instead of hardcoding. ⚠️ The two files' **values** match but some palm-gate **key names diverge** (web `FINGERS_CLOSED`/`TILTED_HAND`/`OBSTRUCTED`/`UNEVEN_LIGHT` vs mobile `SPREAD_FINGERS`/`HAND_STRAIGHT`/`PALM_BLOCKED`/`LIGHTING_UNEVEN`) — when editing one side, match the *value*, not necessarily the key name.
- `shared/planetText.js` — `planetEnglish(name)` / `periodEnglish(period)`: the only graha names without an English form are the nodes, so these translate **Rahu→North Node, Ketu→South Node** for display while leaving the raw period string (the `dashaGuidanceFor` lookup key) intact.
- `shared/panchangText.js` — `tithiEnglish(tithi)`: turns the engine's `"<Paksha> Paksha · <TithiName>"` into `"Waxing/Waning Moon · Day N"` (Purnima→Full Moon, Amavasya→New Moon); leaves genuine proper nouns (nakshatra/yoga/karana) untouched (no English name).

### Reading trust & interactivity (the "Show Your Work" layer)
Cross-cutting features that make the reading feel computed and credible rather than generated. Most are mobile-first; the web twins are noted.
- **Show-Your-Work badges.** The kundali prompt (`backend/src/ai/prompts.js`) returns an `evidence` object (personality/career/relationships → the exact placements behind each section); rendered as an "Astrology logic" badge in `InsightsTab.jsx` (web) + `ReadingTab.js` (mobile). The palm reading attaches the **measured** geometry buckets (`backend/src/utils/palmGeometry.js` → `parsed.geometry`) — the "Palmistry Math" chips render from that real data, **never model-invented numbers**.
- **Timeline Check.** The kundali prompt returns `pastCheck` `{question, basis}` — a grounded yes/no tied to a real dasha window. The card (`ReadingTab.js` / `InsightsTab.jsx`) is **honest by design**: the acknowledgement reflects the user's actual Yes/No, never a fake "confirmed." The answer is **persisted** keyed by `timelineCheck:<question>` (mobile `utils/storage` AsyncStorage; web `localStorage`) so it's never re-asked. Persistence is on-device, not synced to the account.
- **Prediction Confidence** ("Backed by Your Chart"): reuses `chart.confidence` (count of independent chart signatures per theme), surfaced in `ReadingTab.js` next to the analysis (full breakdown lives in `TimelineTab.js`).
- **Shared content (`planetInfo.js`)**: `PLANET_INFO` (per-planet meaning) + `DASHA_GUIDANCE` (per-lord Do's/Don'ts) + the `planetInfoFor`/`dashaGuidanceFor` resolvers. **`frontend/src/features/reading/planetInfo.js` and `mobile/src/features/reading/planetInfo.js` are intentional twins — keep in sync** (same rule as the astrology engine).
- **Interactive planets** (web + mobile): planet rows are tappable → a detail modal/sheet using `planetInfo.js`; the placement line is pulled live from the chart. Mobile = `PlanetDetailSheet.js` (RN `Modal`, reanimated `SlideInDown`, Expo-Go-safe); web = `PlanetDetailModal.jsx` (bottom-sheet on mobile widths, centered on desktop; Esc/backdrop close).
- **Expandable dasha forecast** (web + mobile): forecast cards expand to show the `why` reasoning + static Do's/Don'ts. Mobile `TimelineTab.js` (`LayoutAnimation` + reanimated `FadeIn` + `haptics`); web `TimelineTab.jsx` (`ForecastItem`, animated max-height).
- **Bi-wheel / Gochar map** (web + mobile twins): `mobile/src/features/kundali/GocharMap.js` + `frontend/src/features/kundali/GocharMap.jsx` — an SVG sidereal **dual wheel**: inner ring = NATAL planets (`chart.planets` by `sid`), outer ring = LIVE transits (`chart.transits.gochar`) with a pulsing halo (mobile: reanimated; web: SVG SMIL `<animate>`), natal lagna marked, dashed connectors for transit↔natal conjunctions (≤7° orb, e.g. live Saturn over birth Moon = Sade Sati) listed as "Active Alignments". Both datasets are client-side already — **no API call**. Each alignment row has an **"Interpret ›"** button (label from `STRINGS.ACTIONS`) that deep-links to chat and auto-asks that exact conjunction's question (mobile: `navigation.navigate("Chat", { ask })` → `route.params.ask`; web: `navigate("/chat", { state: { ask } })` → `location.state.ask`). Once asked, the row is **persisted as asked** under the `asked_alignments` key (web `localStorage` JSON; mobile `utils/storage` `getItem`/`setItem`) keyed by `<transit>-<natal>`, and the button flips to a disabled **"Analyzed"** state so the same alignment isn't re-asked. Keep the two `GocharMap` files in sync like the astrology engine.

## Build and deployment

### Backend (Oracle VPS — primary; Vercel still supported)
Production deploys to an **always-on Oracle VPS** via GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`. Capistrano-style atomic release:
- **`verify` job (CI runner):** installs + runs `npm test` (vitest on sqlite, no DB), then builds two **immutable artifacts** — a prod-only backend tarball (`package.json` + `package-lock.json` + `node_modules --omit=dev` + `src`; verified zero native `.node` binaries so the x64-CI build is portable to ARM64/x64) and the frontend `dist`. **Nothing is built on the prod host.** A failure here leaves prod untouched.
- **`deploy` job:** SCPs the artifacts, unpacks into `releases/<sha>/`, symlinks `shared/.env` (real prod env, lives outside releases) into the release, **atomically flips `current -> releases/<sha>`**, then `pm2 reload astrology-backend` (started through the symlink, so reload re-execs the new release). **Health-check** polls `http://127.0.0.1:$PORT/health` up to 10×; on failure it **flips the symlink back and reloads** (rollback). Frontend is rsync'd (`--delete`) into nginx's web root only after the backend is healthy. Keeps the last 5 releases.
- **First-time setup:** create `$DEPLOY_PATH/shared/.env` on the box once (deploy fails loudly if missing), and bootstrap the DB schema with `npm run sync-schema` before the first deploy. Required GH secrets: `SERVER_HOST`/`SERVER_USER`/`SERVER_SSH_KEY`, `DEPLOY_PATH`, `FRONTEND_DEPLOY_PATH`, `BACKEND_PORT`, `VITE_API_URL`.
- Process manager is **pm2** (`astrology-backend`); logs in `shared/logs/`. The in-process node-cron scheduler runs here (no external cron needed — that's the Vercel-only path).
- **Vercel (legacy/alt):** still works — Root Directory = `backend` (project settings, not `vercel.json`), env vars + base64 Firebase credential in the dashboard, external cron for engagement pushes. Migrations run manually against the DB; don't auto-run on cold starts.

### Mobile (EAS)
- Build profile `preview` produces an APK with internal distribution + OTA updates on the `preview` channel
- iOS distribution requires a paid Apple Developer account; no workaround exists for free iOS install
- `eas update --branch preview` ships JS-only changes to installed APKs
- `eas build` is required for: new native modules, `app.json` icon/splash/permissions changes, SDK upgrades
- EAS env vars are separate from local `.env`. Set with `eas env:create --environment preview --name X --value Y --visibility plaintext`

### Mobile native modules in use
`expo-updates` (OTA), `expo-image-picker` (palm photos), `expo-image-manipulator` (palm pre-resize), `expo-constants` (Expo-Go detection), `expo-haptics` (tap/select feedback via `mobile/src/utils/haptics.js`), `expo-location` + `expo-localization` (daily-guidance GPS / locale), `expo-secure-store` (JWT keychain), `@react-native-community/datetimepicker`, `react-native-reanimated`, `react-native-svg`, `react-native-gesture-handler`, `react-native-iap` (credit IAP — wrapper `features/credits/iapClient.js`), `@react-native-firebase/{app,auth,messaging,analytics}` + `@notifee/react-native` (push + analytics), plus a local native module `./modules/hand-landmarker` (MediaPipe via `react-native-nitro-modules`) and `expo-camera`/`expo-gl`/`expo-file-system`/`react-native-fs`/`jpeg-js` (palm capture + decode). Adding more native modules requires `eas build`, not `eas update`.
- `expo-blur` is a declared dependency but currently **not imported** anywhere in `mobile/src` (the login-card blur was removed); leave it or prune it, but don't document it as in-use.
- A **local config plugin** `mobile/plugins/withNotificationSound.js` (registered in `app.json`) bundles `assets/sounds/notification.wav` into Android `res/raw` + the iOS bundle on prebuild — don't point it at a missing file or the EAS build fails.
- **App branding**: display name is **"Astro AI"** (`expo.name`); slug stays `astrology-ai` (don't change — it's the EAS project identity). Icon / adaptive-icon / native-splash all use `assets/homescreen-logo.png`. Icon/name/splash changes need `eas build`.
- **These native modules don't exist in Expo Go**, so push (`@react-native-firebase/messaging` + Notifee), analytics, and IAP no-op there. The code guards every call behind `const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient` (see `mobile/src/features/notifications/push.js`, `analytics.js`, `index.js`, `CreditsScreen.js`) so the app runs cleanly in Expo Go with those features silently disabled. To actually exercise them, do an EAS dev/preview build.

## Conventions

- **Comments:** terse, explain *why*, not *what*. The existing codebase has good examples — match its style.
- **Env validation:** new backend env vars must be added to `backend/src/config/envConfig.js` Zod schema, or they won't be loaded.
- **Sequelize models:** register associations in `backend/src/models/index.js`, don't scatter them.
- **Routes:** mount under `/api` in `backend/src/server.js`. Each feature has its own router + controller + service trio. Every route needs a Zod schema via `validate(...)`, and any user-data route must scope by the **token** (`withAuthPhone(req, …)`) — never trust a client-supplied `phone`/`userId`. See the Security model section.
- **Tunable values go in `Setting`, not code.** Feature costs, signup bonus, and all `notif_*` knobs are DB-backed and admin-editable — read them via `settingsService`. If you add a new tunable, also add its default to the settings seed and surface it in `AdminSettings.jsx`.
- **Credit ledger is append-only.** Charge/grant through `creditService` (atomic guarded updates); never mutate `User.credits` directly or update old `CreditTransaction` rows.
- **API responses are enveloped** as `{ success, message, data }` by `responseWrapper`; clients unwrap `data` and read `.code` for error handling (e.g. `INSUFFICIENT_CREDITS`).
- **Mobile theme:** all colors flow from `mobile/src/theme/ThemeContext.js` and `tokens.js`. Don't hardcode colors in components if a token exists.
- **Mobile back navigation:** the app uses a single "home base" model — every top-level drawer screen sends Android hardware-back to the Reading/Kundali screen via the `useBackToKundali(navigation)` hook (Profile, Help, Palm, PalmStep, PalmCompare, Chat, Credits). Reading itself backs sub-tab → Kundali → exit-app. New screens of this kind should add the hook too. `RootNavigator` also waits for `ChartContext` to hydrate before mounting the drawer, so `initialRoute` is deterministic (returning users open straight on Reading, not the Home form).

## Things that have bitten in the past

- **Secrets in chat / screenshots.** Multiple keys (`firebase-admin.json`, Gemini API key, MySQL root password) have been visible in screenshots and pasted into conversations. Treat each as compromised when that happens. Rotate immediately; never reuse. ⚠️ **Real secrets are currently committed in the `backend/`, `frontend/`, `mobile/` `.env.example` files** (incl. the base64 Firebase service account, `JWT_SECRET`, Gemini/Maps keys, `CRON_SECRET`, Razorpay secret) — these need rotating and scrubbing to placeholders before the repo is shared.
- **`VERCEL=1` in a local `.env`** makes `server.js` skip `app.listen()` and the dev server "clean exits" immediately. It's a platform-injected var — never set it locally. The check is `process.env.VERCEL === '1'` (the string `"0"` is truthy, so `VERCEL=0` does **not** disable it — just leave it unset).
- **`OTP_ENABLED='false'` is a production auth bypass** — the old ungated `POST /auth/dummy-login` is gone, but `POST /auth/verify-otp` still accepts a bare `phone` (no OTP) whenever bypass is allowed: always in non-prod, and in prod if `OTP_ENABLED='false'`. Setting that env var on a live URL lets anyone mint a session as any phone. Keep `OTP_ENABLED` unset/`'true'` in production.
- **`vercel.json` schema is strict** — only known top-level keys (`headers`, `redirects`, `rewrites`, …). A custom `$comment` (or any unknown key) fails the Vercel build with "should NOT have additional property". JSON has no comments; annotate in surrounding code instead.
- **`backendColor: "transparent"` + `elevation` on Android** = dark inner fill (bug in RN's elevation shadow when there's no opaque background). Remove elevation or use a solid background.
- **EAS local `.env` is not uploaded to cloud builds.** Use `eas env:create` instead, or APKs ship pointing at `localhost`.
- **Vercel root directory misconfiguration** — if logs show `/var/task/backend/src/...` instead of `/var/task/src/...`, Root Directory isn't set to `backend`, and `npm install` won't run for the backend.
- **Sequelize sync race on serverless cold starts** — current code accepts this; if it becomes a problem, gate `sync()` behind a one-time flag or move to migrations-only.
- **Double-crediting on payment replay** — guarded by the UNIQUE `Purchase.providerTxnId` and an atomic settlement. Don't weaken either; a retried webhook/verify must never grant twice.
- **Razorpay signature must be verified server-side** — never trust a client-reported "paid" status; `purchaseService` recomputes the HMAC and constant-time compares.
- **Engagement-push double-sends** — the engage job relies on an atomic compare-and-set of `notif_next_at`. If you refactor scheduling, preserve that guard or overlapping cron hits will fan out twice.
- **Mock payments fail closed in prod (don't reopen)** — two separate mock paths, both now prod-gated: (1) **IAP** — when `APPLE_IAP_SECRET` / `GOOGLE_IAP_SERVICE_ACCOUNT_JSON` are unset, `verifyAppleReceipt`/`verifyGooglePurchase` return a fake `mock_*_<timestamp>` txn id **only in dev**; in production they log + return null (no grant). iOS also binds the receipt to the requested plan's product (`appleTxnForProduct` matches `in_app[*].product_id`). (2) **Razorpay mock checkout** — `createOrder`/`confirmOrder` throw `503 PAYMENTS_NOT_CONFIGURED` in production instead of settling a `mock` order for free. Don't reintroduce either dev mock into a production branch.
- **IAP double-credit on concurrent verify** — `verifyIapPayment` inserts the `Purchase` row before `grant()` so the `UNIQUE(providerTxnId)` constraint aborts a racing duplicate before any ledger write (caught → `409 IAP_ALREADY_PROCESSED`). Don't reorder to grant-before-insert — that reopens a post-grant 500/double-grant window (the Razorpay path locks the existing row first instead).
- **Admin settings can corrupt pricing if unvalidated** — feature costs/bonus and `notif_*` knobs are admin-editable free-form strings; `adminSettingsBody` (`validators/schemas.js`) now `superRefine`s each known key (costs/`initial_credits` = bounded non-neg int; notif hours/gap/pct bounded; enum keys constrained). A bad value used to silently make a feature free or disable the signup bonus (`Math.max(0,…)` clamps it). Keep the per-key validation when adding a new tunable.
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

# Bootstrap prod schema ONCE on a fresh DB (forces sync() incl. FK constraints)
cd backend && npm run sync-schema

# Run migrations against the prod DB (no baseline migration exists yet — see Schema management)
cd backend && DB_HOST=<host> DB_PORT=<port> DB_USER=root DB_PASS='<pass>' DB_NAME=<db> NODE_ENV=production npm run migrate

# Deploy to prod: just push to main (GitHub Actions → Oracle VPS, .github/workflows/deploy.yml)
git push origin main

# Manually trigger an engagement push (needs CRON_SECRET)
curl -H "x-cron-secret: <secret>" "http://localhost:5000/api/cron/run?job=engage_now"
```

## Where to look

- API entry point + route mounts: `backend/src/server.js`
- Models + associations: `backend/src/models/` (`index.js` for associations)
- AI prompts (canonical) / Gemini wrapper: `backend/src/ai/prompts.js`, `backend/src/ai/gemini.js`
- Chart math (web + mobile): `frontend/src/shared/astrology.js` + `mobile/src/shared/astrology.js` (incl. `transits.gochar` live-sky array — keep in sync)
- Reading UI (mobile): `mobile/src/features/reading/sections/` (`ReadingTab.js`, `PlanetsTab.js`, `TimelineTab.js`, `PlanetDetailSheet.js`); web reading: `frontend/src/features/reading/` (`InsightsTab.jsx`, `PlanetsTab.jsx`, `TimelineTab.jsx`, `PlanetDetailModal.jsx`)
- Reading content (web + mobile twins, keep in sync): `…/features/reading/planetInfo.js` (`PLANET_INFO` + `DASHA_GUIDANCE`)
- Display/terminology layer (web + mobile twins, keep in sync): `…/shared/uiStrings.js` (`STRINGS`), `…/utils/labels.js` (`LABELS`), `…/shared/planetText.js` (`planetEnglish`/`periodEnglish`), `…/shared/panchangText.js` (`tithiEnglish`)
- Notifications: web `frontend/src/features/notifications/webPush.js` + `frontend/public/firebase-messaging-sw.js`; mobile `mobile/src/features/notifications/push.js`; backend fan-out `backend/src/services/notificationService.js`; custom-sound bundling `mobile/plugins/withNotificationSound.js`
- Gochar map (web + mobile twins): `frontend/src/features/kundali/GocharMap.jsx` + `mobile/src/features/kundali/GocharMap.js` (alongside `DashaWheel`, `AshtakvargaWheel`)
- Palm geometry / "Palmistry Math": `backend/src/utils/palmGeometry.js` → attached as `reading.geometry`; rendered in palm `ReadingResult` (web `pages/PalmPage.jsx`, mobile `sections/ReadingResult.js`)
- Credits & payments: `backend/src/services/creditService.js`, `purchaseService.js`, `config/razorpay.js`
- Engagement pushes: `backend/src/services/engageService.js`, `notificationService.js`, `config/scheduler.js`, `backend/NOTIFICATIONS_SETUP.txt`
- DB-backed settings: `backend/src/services/settingsService.js` (+ `settingsSeed.js`)
- Admin (API): `backend/src/routes/adminRoutes.js`, `controllers/adminController.js`, `services/adminService.js`
- Admin (web): `frontend/src/admin/` (settings UI: `admin/pages/AdminSettings.jsx`)
- Palm gate (keep in sync): `frontend/src/utils/palmGate.js` + `mobile/src/features/palm/palmGate.js`; gate checklist UI: `frontend/src/components/PalmGateChecklist.jsx` + `mobile/src/features/palm/sections/GateChecklist.js`
- Mobile palm flow: `mobile/src/features/palm/PalmScreen.js` (+ `sections/UploadView.js`, `ReadingResult.js`), `PalmStepScreen.js`, `PalmCompareScreen.js`
- Mobile credits / IAP: `mobile/src/features/credits/CreditsScreen.js` + `iapClient.js` (react-native-iap wrapper); backend IAP verify: `backend/src/services/purchaseService.js` (`verifyIapPayment`)
- Deployment: `.github/workflows/deploy.yml` (Oracle VPS, pm2 + nginx, atomic release); prod schema bootstrap: `backend/src/scripts/syncSchema.js` (`npm run sync-schema`)
- Mobile back-nav hook: `mobile/src/utils/useBackToKundali.js`
- Web entry / routes: `frontend/src/App.jsx` → `frontend/src/routes.jsx`; API client: `frontend/src/common/apiClient.js`
- Shared client state: `frontend/src/context/ChartContext.jsx` (mobile: `mobile/src/context/ChartContext.js`)
- Mobile root: `mobile/App.js` → `mobile/src/navigation/RootNavigator.js`
- Mobile splash: `mobile/src/components/SplashScreen.js`
- Mobile drawer: `mobile/src/components/DrawerContent.js`
- Auth (mobile): `mobile/src/features/auth/AuthContext.js`
- Security (backend): identity binding `backend/src/utils/authForm.js` + phone normalization `utils/phone.js`; prompt-injection containment `utils/promptSafety.js`; image magic-byte + dimension guard `utils/imageValidator.js`; palm landmark trust check `services/palmService.js` (`landmarksCredible`); auth/admin JWT `middleware/auth.js`; rate limiting `middleware/rateLimit.js`; request validation `middleware/validate.js` + `validators/schemas.js`; env/secrets schema `config/envConfig.js`; CORS `config/cors.js`; cron-secret compare `middleware/cronAuth.js`; log redaction `config/logger.js`
- Security (clients): web CSP/headers `frontend/vite.config.js` + `frontend/vercel.json`; mobile token keychain `mobile/src/utils/tokenStore.js`; shared HTTP client + 401 handling `frontend/src/common/apiClient.js`
