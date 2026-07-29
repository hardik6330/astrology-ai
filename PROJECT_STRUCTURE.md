# 🪐 Astrology AI Pro — Project Overview

This document describes the full project structure, screens, and UI of the application.

> 📝 **Keep the docs current.** When a feature, screen, stack choice, or deployment detail changes, update this file **and** `CLAUDE.md` **and** (for mobile-facing changes) `mobile.md` in the same change. See the "Keeping the docs in sync" rule in `CLAUDE.md`.

---

## 🛠 Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4 (PWA)
- **Mobile:** React Native (Expo SDK 54)
- **Backend:** Node.js, Express 5, Sequelize + **MySQL**, Firebase Admin (Phone-OTP Auth), `helmet` + Zod validation, JWT sessions (`expo-secure-store` on mobile). Deployed on an **always-on Oracle VPS** (pm2 + nginx, GitHub Actions atomic releases)
- **AI:** Google Gemini 2.5 Pro (interpretation) & Flash (quality gating)
- **Astrology Engine:** `astronomy-engine` (NASA-grade precision, runs on-device)
- **Payments:** Razorpay (Web), Native IAP (Mobile)

---

## 📂 Project Structure

### 1. `/backend` (API & Server)
- **`src/controllers/`** — Business logic (e.g. `kundaliController.js`, `chatController.js`).
- **`src/services/`** — Database and external-service integrations.
- **`src/models/`** — Database schema (User, Kundali, PalmReading, etc.).
- **`src/routes/`** — All API endpoints (mounted under `/api` in `server.js`, which also holds `createApp()` + startup).
- **`src/ai/`** — Gemini AI prompts and the call wrapper (retry, model fallback, `maxOutputTokens` cap).
- **`src/middleware/`** — `requireAuth`/`requireAdmin`, rate limiting, Zod `validate`, response envelope, error handler.
- **`src/validators/`** — Zod request schemas. **`src/utils/`** — auth/identity binding, phone normalization, prompt safety, image + palm-geometry validation.
- **`src/config/`** — env schema (Zod), DB, CORS, Firebase, logger, scheduler.

### 2. `/frontend` (Web App)
- **`src/pages/`** — Main screens (HomePage, ReadingPage, ChatPage, etc.).
- **`src/features/`** — Feature-wise logic and components (auth, kundali, palm, chat).
- **`src/common/`** — Shared components (Button, Card, Loading).
- **`src/theme/`** — Color tokens and gradients.
- **`src/shared/`** — Astrology engine and text utilities.

### 3. `/mobile` (Native App)
- **`src/features/`** — Mobile screens and logic (Home, Reading, Palm, Chat).
- **`src/components/`** — Mobile-specific UI components.
- **`src/navigation/`** — Drawer and Stack navigation.

### 4. `/packages` (Shared logic — imported by both clients via relative path, no install step)
- **`astrology-core/`** (`@astrology-ai/core`) — the single source of truth for the **chart engine** (`computeChart`, `computeDaily`, `buildFactSheet`, transits). Both clients re-export it through thin `src/shared/astrology.js` proxies. **Edit the core, not the proxies.**
- **`palm-core/`** (`@astrology-ai/palm-core`) — the shared **palm hand-side classifier** (rotation-invariant Left/Right), **duplicate-hand check**, the quality thresholds, and the `confidenceScore()` formula. Both client palm gates import it. ⚠️ The **backend can't import `packages/`** (its prod tarball ships only `backend/src/`), so it keeps a byte-identical mirror at `backend/src/utils/palmHand.js` — change both together.

---

## 📱 Pages & Screens

### 1. **Login Screen**
- Firebase Phone-OTP authentication.
- Secure login flow.

### 2. **Home Screen (Birth Details)**
- Form to capture the user's name, date, time, and place of birth.
- City search via the Google Places API.

### 3. **Reading Page (The Dashboard)**
Four main tabs:
- **Kundali:** North/South Indian charts, Panchang, and doshas.
- **Planets:** Planetary positions (Sidereal/Tropical) and their strength.
- **Timeline:** Dasha wheel, Ashtakavarga, and transits (Gochar).
- **Insights:** AI-generated personalized report (Career, Love, Health).

### 4. **AI Astrologer Chat**
- A chatbot for asking questions based on the user's birth chart.
- Context-aware (it understands the user's chart before answering).

### 5. **Palmistry (Palm Reading)**
- Capture and scan a photo of the hand (single hand, or a both-hand "Potential vs Reality" comparison).
- On-device quality check via MediaPipe, including **rotation-invariant Left/Right verification** (a wrong hand is rejected client-side and re-verified on the backend) and **duplicate-hand detection** in the comparison flow.
- Line analysis via Gemini Vision; only a SHA-256 hash + the text reading is persisted — never the image.

### 6. **Daily Guidance**
- Daily horoscope, lucky color, and lucky number.
- Rahu Kaal and Panchang details.

### 7. **Admin Dashboard**
- User management, payment transactions, and push-notification sending.

---

## 🎨 UI & Design

- **Theme:** Cosmic Dark (deep blues & purples).
- **Glassmorphism:** Blurred backgrounds and translucent cards.
- **Animations:** Shooting stars, pulse effects, and smooth transitions.
- **Responsive:** Consistent experience across web and mobile.

---

## ⚙️ Core Logic

1. **On-Device Computation:** Chart math runs on the user's phone/browser, not on the server.
2. **Fact-Sheet Approach:** Instead of sending the user's personal data, only the astrological facts are sent to the AI.
3. **Credit System:** Every premium feature (AI Reading, Chat) consumes credits.

---

## 🗄️ Database & Auth

- **Database:** A single **MySQL** database (via Sequelize ORM). Hosted on **Aiven MySQL** (db `defaultdb`, TLS required → `DB_SSL=true`); migrated off Railway, whose workspace was restricted. Backups: gitignored dumps in `backend/*.sql` — see CLAUDE.md "Database host & backups".
- **Tables:** `User`, `Kundali`, `PalmReading`, `DailyReading`, `ChatMessage`, `CreditTransaction` (append-only ledger), `Purchase`, `Setting`, `PushToken`, `Admin`, and engagement-push templates.
- **Schema:** `sequelize.sync()` on boot **only in dev/test** (creates missing tables, never drops/alters). Production is migrations-only; a fresh prod DB is bootstrapped once with `npm run sync-schema` (forces a `sync()` incl. real FK constraints). Ongoing column changes go through `backend/migrations/` (Umzug) — note **no baseline migration exists yet**, so the schema is currently frozen at the `sync-schema` snapshot.
- **User Auth:** **Firebase Phone OTP** is the single identity source. The client verifies the OTP, obtains a Firebase ID token → the backend verifies it and issues its own **JWT** (signed with `JWT_SECRET`). On mobile the JWT is stored in the OS keychain via **`expo-secure-store`**, not plaintext AsyncStorage.
- **Admin Auth:** A separate username/password account (scrypt-hashed) → a role=`admin` JWT, signed with a **dedicated `ADMIN_JWT_SECRET`** (required + distinct from `JWT_SECRET` in production) and carrying an `aud: astro-admin` claim, so a user token can never be verified as an admin token. The `requireAdmin` middleware guards `/api/admin/*`. The default admin password is rejected at boot in production.
- **Identity binding (no IDOR):** every user-data route takes the acting account from the **verified token** (`req.auth.phone`), never from the request body — see `backend/src/utils/authForm.js` (`withAuthPhone`) + `utils/phone.js` (full E.164 match, any country); `phone` is stripped from the request schemas.

---

## 💳 Payments & Credits

- **Web:** **Razorpay** (falls back to a mock provider when keys are absent). The signature is verified **server-side** with HMAC-SHA256; `Purchase.providerTxnId` is UNIQUE so replays never double-credit.
- **Mobile:** **Native IAP** (`react-native-iap`) — iOS via Apple `verifyReceipt`, Android via the Play Developer API. A plan uses the store flow only when its `productId` is set; otherwise it falls back to mock.
- **Costs in DB:** Feature costs (`chat_cost`, `insights_cost`, `daily_cost`, `palm_cost`) and the signup bonus (`initial_credits`) live in the **`Setting` table**, not in code — editable from the admin panel (`settingsService`, 60s cache).
- **Ledger:** `creditService.charge()` performs an atomic guarded decrement; if credits are insufficient it returns HTTP 402 `INSUFFICIENT_CREDITS`.

---

## 🔒 Security & Hardening

The app has been through a full security pass. Key protections (all in `backend/src` unless noted):

- **Prompt-injection containment:** all untrusted text (chart fact-sheet, daily `ctx`, `name`/`gender`, chat turns) is fenced/sanitized before Gemini via `utils/promptSafety.js`, and system prompts carry a data-safety guard. The chat **topic gate is enforced** — off-topic → canned refusal + credit **refund**, skipping the expensive Pro call. Every Gemini call is capped with `maxOutputTokens` (`config/constants.js`).
- **File uploads:** palm images are validated by **magic bytes + a header-only dimension guard** (`utils/imageValidator.js`) — oversized bitmaps are rejected *before* Jimp decodes, stopping decompression bombs. The client `skipGate` flag is **advisory**: the server only honors it with credible 21-point landmark evidence (`palmService.landmarksCredible`), otherwise it runs its own Flash gate. Only a SHA-256 hash + the text reading is persisted — never the image bytes.
- **Transport & headers:** strict **CSP** (build-time `<meta>` with env-driven `connect-src` in `frontend/vite.config.js`) plus HTTP security headers (`frontend/vercel.json`: `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`). Backend runs `helmet()`. **CORS** is default-deny in production — `*.vercel.app` previews are opt-in via `CORS_ALLOW_VERCEL_PREVIEWS`.
- **Rate limiting** (`middleware/rateLimit.js`): keyed **per-account** when authenticated, per-IP (IPv6-normalized) for pre-auth routes — so rotating IPs can't multiply quota on the expensive AI routes.
- **Secrets & logs:** phone numbers are redacted from logs (`config/logger.js`); the cron secret is compared in **constant time on fixed-length hashes** (`middleware/cronAuth.js`); Firebase **hard-fails at boot** in production if its credentials are missing/invalid.
- **DB integrity:** the credit ledger is append-only with an atomic guarded decrement; the `literal()` credit math is integer-asserted (`creditService.js`). All queries go through Sequelize (parameterized).
- **Validation:** every route runs a **Zod schema** (`validators/schemas.js`); admin pagination + location queries are bounds-checked, and chat messages must be non-empty (`trim().min(1)`).

> **Resolved since the original audit:** `POST /auth/dummy-login` is gone — replaced by `POST /auth/verify-otp`, whose bare-phone bypass is **production-gated** behind `OTP_ENABLED='false'` (never set in prod); and the **IAP mock fallback now fails closed in production** (`verifyAppleReceipt`/`verifyGooglePurchase` return null + log instead of granting when a store secret is missing).
>
> **Still open before a public launch:** (1) real secrets are committed in the `*/.env.example` files (base64 Firebase service account, `JWT_SECRET`, `CRON_SECRET`, Razorpay/Gemini/Maps keys) — **rotate, scrub to placeholders, and purge git history**; (2) rate limiting uses an **in-memory store** (per-instance — fine on the single-process VPS, but defeated by Vercel scale-out — move to Redis/Upstash if running serverless). See CLAUDE.md "Security model" / "Things that have bitten" for detail.

---

## 🔔 Notifications

- **FCM** push delivery (web service-worker + mobile RN-Firebase/Notifee).
- **Engagement "vibe" pushes:** Randomly-timed notifications within an IST window — all knobs live in the `Setting` table, edited from the admin Notifications panel.
- **Scheduling:** On Vercel, an external cron hits `GET /api/cron/run?job=engage` (authenticated by `CRON_SECRET`); on an always-on host, node-cron is used.
- **Custom sound:** A bundled `notification.wav` (Android channel `default-sound`).

---

## 🚀 Deployment

### Backend → **Oracle VPS** (always-on; Vercel still supported)
Production runs on an **always-on Oracle VPS** (pm2 + nginx), deployed by **GitHub Actions** (`.github/workflows/deploy.yml`) on every push to `main` — Capistrano-style atomic release:
1. **`verify` job** (CI): `npm test` (vitest on sqlite, no DB), then builds two **immutable artifacts** — a prod-only backend tarball (`node_modules --omit=dev`, verified free of native `.node` binaries so it's portable to ARM64/x64) + the frontend `dist`. **Nothing is built on the prod host**; a failure leaves prod untouched.
2. **`deploy` job:** SCPs the artifacts, unpacks to `releases/<sha>/`, links the real `shared/.env` (lives outside releases) in, **atomically flips `current -> releases/<sha>`**, `pm2 reload astrology-backend`, then **health-checks `/health`** up to 10× — on failure it flips the symlink back and reloads (**rollback**). The frontend is rsync'd into nginx's web root only after the backend is healthy. Last 5 releases are kept.
- **First-time setup:** create `$DEPLOY_PATH/shared/.env` on the box (deploy fails loudly if missing) and bootstrap the schema once with `npm run sync-schema` (`server.js` doesn't `sync()` in production). GH secrets: `SERVER_HOST/USER/SSH_KEY`, `DEPLOY_PATH`, `FRONTEND_DEPLOY_PATH`, `BACKEND_PORT`, `VITE_API_URL`.
- Because the host is long-lived, the app runs **as written**: `app.listen()` binds a port and the in-process **node-cron** scheduler drives engagement pushes (no external cron needed). Every new env var must be added to `backend/src/config/envConfig.js` (Zod schema).
- **Vercel (legacy/alt):** still works — Root Directory = `backend` (project settings, not `vercel.json`), env vars + `FIREBASE_SERVICE_ACCOUNT_B64` in the dashboard, external cron for pushes. ⚠️ **`VERCEL` is injected by the platform** (`=1`) — **never set it in your local `.env`** (the check is `process.env.VERCEL === '1'`; a local `VERCEL=1`/`VERCEL=0` makes the dev server skip `app.listen()` and exit). On Vercel, env changes apply only to **new deployments** (redeploy), and an unreachable DB `process.exit(1)`s → `FUNCTION_INVOCATION_FAILED` on every route.
- **DB:** whatever `shared/.env` points at (MySQL — **Aiven** `*.aivencloud.com`, needs `DB_SSL=true`, or a MySQL local to the VPS). Migrations run manually:
  ```bash
  cd backend && DB_HOST=<host> DB_PORT=<port> DB_USER=root DB_PASS='<pass>' DB_NAME=<db> NODE_ENV=production npm run migrate
  ```

### Frontend → static / PWA host (Vercel)
- `cd frontend && npm run build` → deploy `dist/`. The API URL is env-driven.

### Mobile → **EAS (Expo)**
- **Build profile `preview`** → internal-distribution **APK** + OTA updates on the `preview` channel.
  ```bash
  cd mobile && eas build --platform android --profile preview     # APK
  cd mobile && eas build --platform ios     --profile preview     # iOS (paid Apple account required)
  cd mobile && eas update  --branch preview  --message "..."       # JS-only OTA
  ```
- **When `eas build` is required:** a new native module, `app.json` changes (icon/splash/permissions/plugins), or an SDK upgrade. JS-only changes → `eas update`.
- **EAS env vars** are separate (`eas env:create ...`) — the local `.env` is not uploaded to cloud builds.
- **iOS device install:** `eas device:create` (register the UDID), then build; iOS install is not possible on a free Apple account.
- **Firebase Phone Auth (Android):** the build keystore's **SHA-1 + SHA-256** fingerprints must be registered in the Firebase Console (get them via `eas credentials`), otherwise you hit `auth/missing-client-identifier`.

### Force-update gate
- Backend `/auth/config` → `{ latestVersion, forceUpdate }`. The app compares its own version; if it's older and `forceUpdate` is ON, a non-dismissible modal appears whose action opens the **store listing directly** (a `market://` / `itms-apps://` link built from the package id).

---

## 🔑 Key Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_B64` | Backend | Firebase Admin (token verify) |
| `DB_HOST/PORT/USER/PASS/NAME` | Backend | MySQL (Aiven) connection |
| `DB_SSL` | Backend | `'true'` enables TLS — required by Aiven |
| `DB_SSL_CA` | Backend | Path to Aiven's CA `.pem`; unset = encrypted but unverified |
| `GEMINI_API_KEY` | Backend | AI interpretation + palm vision |
| `JWT_SECRET` | Backend | User session-token signing |
| `ADMIN_JWT_SECRET` | Backend | Admin token signing — **required + distinct from `JWT_SECRET` in prod** |
| `CORS_ALLOW_VERCEL_PREVIEWS` | Backend | Opt-in (`true`/`false`) to allow `*.vercel.app` origins |
| `RAZORPAY_KEY_ID` / `..._SECRET` | Backend | Web payments (mock if absent) |
| `APPLE_IAP_SECRET` / `GOOGLE_IAP_SERVICE_ACCOUNT_JSON` | Backend | Mobile IAP receipt verification |
| `CRON_SECRET` | Backend | Engagement-push cron auth |
| `EXPO_PUBLIC_API_URL` | Mobile (EAS) | Backend API base URL (set per build profile in `eas.json`) |
| `VITE_*` | Frontend | API URL, OTP service flag |
| `VERCEL` | (auto) | Injected by Vercel as `1` — **never set manually** |

> ⚠️ **Secrets:** Never commit `firebase-admin.json` (gitignored). If any key appears in a screenshot/chat, rotate it immediately.

---

