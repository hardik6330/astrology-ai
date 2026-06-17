# 🪐 Astrology AI Pro — Project Overview

This document describes the full project structure, screens, and UI of the application.

---

## 🛠 Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4 (PWA)
- **Mobile:** React Native (Expo SDK 54)
- **Backend:** Node.js, Express 5, Sequelize + **MySQL** (Railway), Firebase Admin (Phone-OTP Auth)
- **AI:** Google Gemini 2.5 Pro (interpretation) & Flash (quality gating)
- **Astrology Engine:** `astronomy-engine` (NASA-grade precision, runs on-device)
- **Payments:** Razorpay (Web), Native IAP (Mobile)

---

## 📂 Project Structure

### 1. `/backend` (API & Server)
- **`src/controllers/`** — Business logic (e.g. `kundaliController.js`, `chatController.js`).
- **`src/services/`** — Database and external-service integrations.
- **`src/models/`** — Database schema (User, Kundali, PalmReading, etc.).
- **`src/routes/`** — All API endpoints.
- **`src/ai/`** — Gemini AI prompts and logic.

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
- **User Auth:** **Firebase Phone OTP** is the single identity source. The client verifies the OTP, obtains a Firebase ID token → the backend verifies it and issues its own **JWT**.
- **Admin Auth:** A separate username/password account (scrypt-hashed) → a role=`admin` JWT; the `requireAdmin` middleware guards `/api/admin/*`.

---

## 💳 Payments & Credits

- **Web:** **Razorpay** (falls back to a mock provider when keys are absent). The signature is verified **server-side** with HMAC-SHA256; `Purchase.providerTxnId` is UNIQUE so replays never double-credit.
- **Mobile:** **Native IAP** (`react-native-iap`) — iOS via Apple `verifyReceipt`, Android via the Play Developer API. A plan uses the store flow only when its `productId` is set; otherwise it falls back to mock.
- **Costs in DB:** Feature costs (`chat_cost`, `insights_cost`, `daily_cost`, `palm_cost`) and the signup bonus (`initial_credits`) live in the **`Setting` table**, not in code — editable from the admin panel (`settingsService`, 60s cache).
- **Ledger:** `creditService.charge()` performs an atomic guarded decrement; if credits are insufficient it returns HTTP 402 `INSUFFICIENT_CREDITS`.

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
| `RAZORPAY_KEY_ID` / `..._SECRET` | Backend | Web payments (mock if absent) |
| `APPLE_IAP_SECRET` / `GOOGLE_IAP_SERVICE_ACCOUNT_JSON` | Backend | Mobile IAP receipt verification |
| `CRON_SECRET` | Backend | Engagement-push cron auth |
| `EXPO_PUBLIC_API_URL` | Mobile (EAS) | Backend API base URL |
| `VITE_*` | Frontend | API URL, OTP service flag |

> ⚠️ **Secrets:** Never commit `firebase-admin.json` (gitignored). If any key appears in a screenshot/chat, rotate it immediately.

---

