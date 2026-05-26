# Astrology AI Pro

> An AI-powered astrology companion that delivers personalized **kundali (birth chart) interpretations**, **palm readings**, **daily horoscopes**, and a **conversational astrologer chat** — available as both a **web app (React 19 + Vite)** and a **native mobile app (React Native + Expo)**, backed by an Express 5 + MySQL API and Google Gemini.

---

## Features

- **Kundali Interpretation** — Generate and interpret Vedic birth charts from birth details (date, time, place). Charts are computed client-side using `astronomy-engine` for speed and privacy.
- **Palm Reading** — Upload a palm photo and receive a structured reading from the AI (with image validation and history tracking).
- **Daily Guidance** — Personalized day-by-day predictions, browsable by date.
- **AI Astrologer Chat** — Conversational interface with deduped, context-aware Gemini responses.
- **PWA-ready** — Installable on mobile via `vite-plugin-pwa`; works on the same Wi-Fi from your phone with zero config.
- **Production-grade backend** — Zod env validation, rate limiting, structured Pino logs, Helmet, CORS allowlist, Sequelize migrations.

---

## Tech Stack

| Layer | Stack |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 7, vite-plugin-pwa, astronomy-engine |
| **Mobile** | React Native 0.81, Expo SDK 54, React Navigation 7, Reanimated 4, expo-blur, expo-updates |
| **Backend** | Node.js 20+, Express 5, Sequelize 6 + MySQL 2, Zod, Pino, Helmet, Firebase Admin |
| **AI** | Google Gemini (`@google/generative-ai`) — text + vision |
| **Auth** | Firebase Phone Auth (OTP) — client sends ID token, backend verifies + issues JWT |
| **Tooling** | ESLint, Prettier, Husky + lint-staged, Umzug migrations, EAS Build + EAS Update |

---

## Project Structure

```
astrology-ai/
├── backend/
│   ├── migrations/                # Umzug SQL migrations
│   └── src/
│       ├── ai/                    # Gemini client, prompts, dedupe
│       ├── config/                # env, db, cors, logger, aiConfig
│       ├── controllers/           # Request handlers per feature
│       ├── middleware/            # errorHandler, rateLimit, validate
│       ├── models/                # Sequelize models (User, Kundali, …)
│       ├── routes/                # Express routers
│       ├── services/              # Business logic per feature
│       ├── utils/                 # Shared helpers
│       ├── validators/            # Zod schemas
│       └── server.js              # Entry point
├── frontend/
│   └── src/
│       ├── components/            # BottomNav, KundaliChart, …
│       ├── pages/                 # Home, Reading, Palm, Chat
│       ├── context/               # ChartContext
│       ├── services/api.js        # Backend client
│       ├── astrology.js           # Client-side chart calculations
│       └── theme/tokens.js
└── mobile/
    ├── App.js                     # Root + providers + splash gate
    ├── app.json                   # Expo config (icon, splash, permissions)
    ├── eas.json                   # EAS Build profiles (preview/production)
    ├── assets/                    # icon, splash, logo
    └── src/
        ├── screens/               # LoginScreen, HomeScreen, ReadingScreen, …
        ├── components/            # SplashScreen, DrawerContent, …
        ├── navigation/            # RootNavigator (drawer + stack)
        ├── shared/astrology.js    # Mirror of frontend/src/astrology.js
        ├── shared/prompts.js      # Mirror of prompts
        ├── context/               # AuthContext, ChartContext, ThemeContext
        ├── services/api.js        # Backend client
        └── theme/                 # tokens, ThemeContext
```

> **Note:** `frontend/src/astrology.js` and `mobile/src/shared/astrology.js` are intentional copies. Edits must be applied to both until extracted into a shared package.

---

## Quick Start

### Prerequisites

- **Node.js 20+**
- **MySQL 8+** running locally (or a remote instance)
- A **Google Gemini API key** — get one at https://aistudio.google.com/apikey

### 1. Clone

```bash
git clone https://github.com/palak-commit/astrology-ai-pro.git
cd astrology-ai-pro
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env       # then fill in GEMINI_API_KEY + DB credentials
npm run migrate            # create tables
npm run dev                # http://localhost:5000
```

### 3. Frontend setup

In a new terminal:

```bash
cd frontend
npm install
cp .env.example .env       # optional — auto-detects backend in dev
npm run dev                # http://localhost:5173
```

Open http://localhost:5173 in your browser.

### 4. Mobile setup (optional)

In a third terminal:

```bash
cd mobile
npm install
cp .env.example .env       # set EXPO_PUBLIC_API_URL if needed
npx expo start             # opens Metro bundler + QR code
```

Scan the QR code with **Expo Go** (App Store / Play Store) on your phone. The app must be on the same Wi-Fi as the dev machine, or run `npx expo start --tunnel` for cross-network access.

---

## Environment Variables

### Backend ([backend/.env.example](backend/.env.example))

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Google Gemini API key |
| `JWT_SECRET` | ✅ | — | Secret for signing user JWTs (min 16 chars) |
| `PORT` | | `5000` | Backend port |
| `NODE_ENV` | | `development` | `development` / `production` / `test` |
| `CORS_ORIGINS` | prod only | — | Comma-separated allowed origins |
| `DB_HOST` | | `localhost` | MySQL host |
| `DB_PORT` | | `3306` | MySQL port |
| `DB_USER` | | `root` | MySQL user |
| `DB_PASS` | | `` | MySQL password |
| `DB_NAME` | | `astrology_db` | MySQL database name |
| `JWT_EXPIRES_IN` | | `30d` | JWT lifetime |
| `FIREBASE_SERVICE_ACCOUNT_B64` | prod | — | Base64-encoded Firebase service-account JSON (use instead of file in production) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | dev | — | Raw JSON string of service account (alternative to base64) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | dev | — | Path to local `firebase-admin.json` file (dev only — never commit) |

The backend **fails fast at boot** with a clear message if anything required is missing (validated by Zod).

### Frontend ([frontend/.env.example](frontend/.env.example))

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API URL. Leave default in dev — the frontend auto-derives it from the page hostname, so opening `http://<pc-ip>:5173` on your phone automatically targets `http://<pc-ip>:5000/api`. |

### Mobile ([mobile/.env.example](mobile/.env.example))

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend API URL (must include `/api` suffix, e.g. `https://your-backend.vercel.app/api`). For EAS builds, also register this in EAS env vars: `eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value <url> --visibility plaintext`. |

---

## API Reference

All routes are mounted under `/api`.

### Kundali
- `GET  /api/interpret` — fetch saved interpretation for a user
- `POST /api/interpret` — generate a new chart interpretation

### Palm
- `GET  /api/palm` — latest saved palm reading
- `GET  /api/palm/history` — list past readings
- `GET  /api/palm/:id` — get a specific reading
- `POST /api/palm` — analyze a new palm photo

### Daily
- `GET  /api/daily` — saved daily guidance
- `GET  /api/daily-dates` — list dates with readings
- `POST /api/daily` — generate daily guidance

### Chat
- `GET  /api/chat` — chat history
- `POST /api/chat` — send a message to the AI astrologer

All write endpoints are **rate-limited** and **body-validated** with Zod schemas.

---

## Scripts

### Backend

```bash
npm run dev              # nodemon hot reload
npm start                # production
npm run migrate          # apply pending migrations
npm run migrate:down     # roll back last migration
npm run migrate:status   # show migration state
npm run format           # prettier write
```

### Frontend

```bash
npm run dev              # vite dev server
npm run build            # production build → dist/
npm run preview          # preview the build
npm run lint             # eslint
npm run format           # prettier write
```

### Mobile

```bash
npx expo start                                       # local dev (Expo Go)
npx expo start --tunnel                              # cross-network dev
eas build --platform android --profile preview       # cloud-build Android APK
eas build --platform ios --profile preview           # cloud-build iOS IPA (needs Apple Developer account)
eas update --branch preview --message "..."          # push JS-only updates to installed APKs (OTA)
eas env:list --environment preview                   # view EAS env vars
```

---

## Deployment

### Backend → Vercel + Railway

Backend is deployed on **Vercel** (serverless functions) with **Railway-hosted MySQL**.

1. **Vercel → Project Settings**
   - **Root Directory:** `backend`
   - Set env vars: `GEMINI_API_KEY`, `JWT_SECRET`, `NODE_ENV=production`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `FIREBASE_SERVICE_ACCOUNT_B64`
2. **Railway MySQL service**
   - Use `RAILWAY_TCP_PROXY_DOMAIN` as `DB_HOST` and `RAILWAY_TCP_PROXY_PORT` as `DB_PORT`
   - Rotate `MYSQL_ROOT_PASSWORD` if it has been exposed in any way (screenshots, chat, screen shares)
3. **Run migrations once** against the Railway DB:
   ```bash
   cd backend
   DB_HOST=<railway-host> DB_PORT=<port> DB_USER=root DB_PASS='<pass>' DB_NAME=railway NODE_ENV=production npm run migrate
   ```

### Frontend → static host (Vercel / Netlify / Cloudflare Pages)

```bash
cd frontend && npm run build
# Deploy the contents of dist/ to any static host. Set VITE_API_URL to your backend URL at build time.
```

### Mobile → EAS Build + EAS Update

- **First-time setup:** `npm install -g eas-cli && eas login`
- **Build APK to share with Android testers:**
  ```bash
  cd mobile
  eas build --platform android --profile preview
  ```
- **Push JS updates to installed APKs (no rebuild needed):**
  ```bash
  eas update --branch preview --message "what changed"
  ```
- **iOS distribution:** requires a paid Apple Developer Program subscription ($99/yr). Free option for iOS testers: have them install **Expo Go** and open your project URL.

When to rebuild vs. update:
- **JS / styles / images / API URL** → `eas update`
- **app.json icon/splash/permissions, new native modules, SDK upgrade** → `eas build`

---

## Security Notes

- **Never commit `.env` files or `firebase-admin.json`.** All are gitignored. Use `.env.example` as a template.
- **Never paste secrets into chat, screenshots, or screen shares** — treat them as compromised the moment they leave your terminal.
- **If a key leaks:**
  - Gemini → rotate at https://aistudio.google.com/apikey (Google often auto-revokes)
  - Firebase service account → Google Cloud Console → IAM → Service Accounts → delete the key + create new one
  - MySQL → Railway dashboard → regenerate `MYSQL_ROOT_PASSWORD`
- The backend enforces Helmet headers, a CORS allowlist (strict in production), Firebase-verified phone-OTP auth, JWT sessions, and per-endpoint rate limits.
- GitHub secret-scanning is enabled on this repo. Pushes containing detected secrets will be blocked.

---

## Troubleshooting

**`AI is busy right now` / `AI_OVERLOADED`** — Usually a transient Gemini rate-limit. If it persists, check backend logs for the underlying error — a 403 means your API key was revoked (leaked or invalid).

**`Invalid environment configuration` at boot** — Check the error list; copy [backend/.env.example](backend/.env.example) to `.env` and fill required values.

**Backend won't connect to MySQL** — Verify MySQL is running and the `DB_*` vars match your local setup. Run `npm run migrate:status` to confirm DB reachability.

**Phone can't reach dev server** — Make sure both devices are on the same Wi-Fi, and access via your PC's LAN IP (e.g. `http://192.168.1.42:5173`), not `localhost`.

---

## License

ISC
