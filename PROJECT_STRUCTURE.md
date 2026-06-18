# 🪐 Astrology AI Pro — Project Overview

This document describes the full project structure, screens, and UI of the application.

---

## 🛠 Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4 (PWA)
- **Mobile:** React Native (Expo SDK 54)
- **Backend:** Node.js, Express 5, Sequelize + **MySQL** (Railway), Firebase Admin (Phone-OTP Auth), `helmet` + Zod validation, JWT sessions (`expo-secure-store` on mobile)
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
- Capture and scan a photo of the hand.
- On-device quality check via MediaPipe.
- Line analysis via Gemini Vision.

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

- **Database:** A single **MySQL** database (via Sequelize ORM). Hosted on **Railway MySQL** in production.
- **Tables:** `User`, `Kundali`, `PalmReading`, `DailyReading`, `ChatMessage`, `CreditTransaction` (append-only ledger), `Purchase`, `Setting`, `PushToken`, `Admin`, and engagement-push templates.
- **Schema:** `sequelize.sync()` on boot (creates missing tables only — never drops/alters). Column changes go through `backend/migrations/` (Umzug), run manually.
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

> **Known gaps to close before a public launch:** (1) `POST /auth/dummy-login` is **not yet gated out of production** (auth bypass); (2) the **IAP mock fallback** still grants free credits when the store secrets are unset — make it fail-closed; (3) real secrets are currently committed in the `*/.env.example` files — rotate and scrub them. See the audit thread / CLAUDE.md "Things that have bitten" for detail.

---

## 🔔 Notifications

- **FCM** push delivery (web service-worker + mobile RN-Firebase/Notifee).
- **Engagement "vibe" pushes:** Randomly-timed notifications within an IST window — all knobs live in the `Setting` table, edited from the admin Notifications panel.
- **Scheduling:** On Vercel, an external cron hits `GET /api/cron/run?job=engage` (authenticated by `CRON_SECRET`); on an always-on host, node-cron is used.
- **Custom sound:** A bundled `notification.wav` (Android channel `default-sound`).

---

## 🚀 Deployment

### Backend → **Vercel** (serverless)
- In Vercel project settings, **Root Directory = `backend`** (not in `vercel.json`).
- **Env vars** are set in the Vercel dashboard — Firebase credentials via `FIREBASE_SERVICE_ACCOUNT_B64` (base64). Every new env var must be added to `backend/src/config/envConfig.js` (Zod schema).
- **DB:** Railway MySQL (`RAILWAY_TCP_PROXY_DOMAIN` / `..._PORT`).
- **Migrations** are run manually against the Railway DB:
  ```bash
  cd backend && DB_HOST=<host> DB_PORT=<port> DB_USER=root DB_PASS='<pass>' DB_NAME=railway NODE_ENV=production npm run migrate
  ```
- ⚠️ Connection pools are re-created on serverless cold starts; for a more reliable host, Render / Railway / Fly can run the app as-is.
- ⚠️ **`VERCEL` is injected by the platform** (`=1`) — **never set it in your local `.env`.** `server.js` skips `app.listen()` when it sees Vercel, so a local `VERCEL=1` (or even `VERCEL=0` — env vars are strings and `"0"` is truthy) makes the dev server exit immediately. The check is `process.env.VERCEL === '1'`, so locally just leave it unset.
- ⚠️ **Env var changes only apply to new deployments** — after editing a value in the Vercel dashboard you must **Redeploy** for it to take effect.
- ⚠️ If the Railway DB is unreachable (`connect ETIMEDOUT`), cold-start init throws and the function `process.exit(1)`s → `FUNCTION_INVOCATION_FAILED` on every route. Verify `DB_HOST` is Railway's **public TCP proxy** (`*.proxy.rlwy.net`), not the internal `*.railway.internal` host, and that the DB service is running.

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
| `DB_HOST/PORT/USER/PASS/NAME` | Backend | MySQL (Railway) connection |
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

