<div align="center">
  <h1>✨ Astrology AI Pro</h1>
  <p><strong>A Next-Generation AI-Powered Vedic Astrology & Palmistry Platform</strong></p>
  
  [![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
  [![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
  [![Gemini AI](https://img.shields.io/badge/Gemini_AI-2.5_Pro-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)
  [![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
</div>

<br />

> **Astrology AI Pro** delivers deeply personalized **Kundali (birth chart) interpretations**, **Palm readings**, **Daily horoscopes**, and a **Conversational Astrologer Chat**. It is engineered as a cross-platform solution featuring a **PWA-ready Web App** and a **Native Mobile App**, powered by a highly secure Express API and Google's Gemini LLMs.

---

## 🌟 Key Features

- **🪐 Precision Kundali Engine** — Generates Vedic birth charts using `astronomy-engine` for sub-degree accuracy, calculating Shadbala, Doshas, and Dasha timelines entirely client-side.
- **✋ AI Palm Reading** — Upload palm images for structured, AI-driven palmistry analysis with built-in image quality validation.
- **📅 Daily Guidance & Gochar** — Day-by-day predictions mapped against real-time planetary transits (Gochar).
- **💬 Conversational AI Astrologer** — Context-aware chat interface utilizing deduplicated Gemini responses tailored to the user's chart.
- **📱 True Cross-Platform** — Seamless experience across Web (Vite + React) and Mobile (React Native + Expo).
- **🛡️ Enterprise-Grade Security** — Firebase Phone OTP Auth, Zod validation, Rate Limiting, Helmet, and strict CORS policies.

---

## How it Works: From Stars to Insights

Astrology AI Pro uses a hybrid engine to deliver "Swiss-grade" accuracy and deep psychological insights:

1.  **Precision Calculation**: Exact planetary degrees and house cusps are computed client-side using the `astronomy-engine` library. This ensures zero-latency and maximum privacy.
2.  **Vedic Logic**: The system derives complex technical facts including **Shadbala** (planetary strength), **Ashtakvarga** scores, and major **Doshas**.
3.  **AI Interpretation**: These raw technical facts are processed by **Gemini 2.5 Pro** using a specialized [Master Astrologer Prompt](backend/src/ai/prompts.js). The AI doesn't "guess"—it translates the mathematical blueprint of your life into clear, actionable guidance.

### Core Features in Action

| Feature | Description | Visual |
| :--- | :--- | :--- |
| **Celestial Wheel** | A precise North/South Indian style birth chart visualizing your planetary placements at the moment of birth. | <img src="frontend/src/assets/main/main-kundali.png" width="250" /> |
| **Dosha & Yoga** | Automated checks for significant conditions like Mangal Dosha, Kaal Sarp, and Sade Sati with status labels. | <img src="frontend/src/assets/main/dosh-yog-stuts.png" width="250" /> |
| **Panchang Snapshot** | The five vital Vedic time-elements (Tithi, Nakshatra, Yoga, Karana, Vaara) that define your base energy. | <img src="frontend/src/assets/main/panchang-data.png" width="250" /> |
| **Destiny Matrix** | Data-driven scores (out of 100) for key life areas like Career, Wealth, and Travel based on house-lord strengths. | <img src="frontend/src/assets/main/destini-matrix.png" width="250" /> |
| **Planetary Strength** | A 0-100 rating meter for each planet, calculating its functional power based on house placement and motion. | <img src="frontend/src/assets/main/palnetry-strength.png" width="250" /> |
| **Planetary Positions** | Side-by-side comparison of Vedic vs Western planetary placements using the Whole-sign house system. | <img src="frontend/src/assets/main/palnetry-potision.png" width="250" /> |
| **Dasha Timing** | Detailed breakdown of Mahadasha and Antardasha periods with completion percentages. | <img src="frontend/src/assets/main/palnetry-timing.png" width="250" /> |
| **Dasha Wheel** | A visual donut chart representing your current planetary cycle and upcoming life shifts. | <img src="frontend/src/assets/main/dasha-timiline.png" width="250" /> |
| **Ashtakvarga (Sarva)** | A heat-map style wheel identifying fortunate signs based on cumulative planetary bindus. | <img src="frontend/src/assets/main/years.png" width="250" /> |
| **Timeline Forecast** | AI-driven life predictions mapped against your planetary timeline for maximum context. | <img src="frontend/src/assets/main/timeline-forcast.png" width="250" /> |
| **Prediction Confidence** | Transparency layer showing how many independent chart signatures support each AI-driven theme. | <img src="frontend/src/assets/main/prediction-confidence.png" width="250" /> |
| **Current Sky (Gochar)** | Real-time planetary transits relative to your Moon sign, tracking immediate energetic shifts. | <img src="frontend/src/assets/main/curretn-sky.png" width="250" /> |

---

## Deep Dive: The Science & Soul of the App

This app isn't just a "horoscope generator"; it's a high-precision calculation engine that bridges ancient Vedic wisdom with modern technology. Here is how the data flows from the stars to your screen.

### 1. The Mathematical Foundation (Astronomy Engine)
The journey starts with the `astronomy-engine` library, which provides sub-degree precision for planetary longitudes.
- **Tropical to Sidereal**: We apply the **Lahiri Ayanamsha** (the most accepted standard in Vedic astrology) to shift Western tropical coordinates to the Sidereal (Vedic) zodiac.
- **Whole-Sign Houses**: We use the **Lagna (Ascendant)** as the 1st house. Every subsequent 30-degree sign becomes a full house. This provides a clear, consistent structure for analyzing life areas.

### 2. The Logic Layer (Vedic Math)
Once positions are fixed, the app runs several deterministic algorithms:
- **Planetary Strength (Shadbala-lite)**: Each planet is rated on a 0-100 scale. We look at its **Dignity** (is it exalted, in its own sign, or debilitated?) and its **Angular Strength** (planets in the 1st, 4th, 7th, and 10th houses are naturally more powerful).
  - <img src="frontend/src/assets/main/palnetry-strength.png" width="400" />
- **Destiny Matrix Scoring**: We calculate scores for 6 life areas (Career, Wealth, etc.) by analyzing the strength of the **House Lord**, the **Karaka** (natural significator), and the presence of any **Benefics** or **Malefics**.
  - <img src="frontend/src/assets/main/destini-matrix.png" width="400" />
- **Dasha Timeline**: Using the Moon's exact position at birth, we calculate the **Vimshottari Dasha**—a 120-year planetary cycle that determines the "timing" of your life events.
  - <img src="frontend/src/assets/main/dasha-timiline.png" width="400" />

### 3. The AI Bridge (Gemini 2.5 Pro)
This is where the math turns into wisdom. We don't send your personal data to the AI; we send the **Calculated Facts** (e.g., "Mars is in the 10th house, strong, ruling the 5th house").
- **The Prompt**: A specialized [Master Astrologer Prompt](backend/src/ai/prompts.js) instructs the AI to use "Cause -> Effect" logic. It doesn't just say "you are lucky"; it says "Because your 9th Lord is exalted, fortune follows your higher learning."
- **Prediction Confidence**: To ensure transparency, the system tracks how many independent "signatures" support a prediction. If three different factors point to a career shift, the confidence is **High**.
  - <img src="frontend/src/assets/main/prediction-confidence.png" width="400" />

### 4. How to use this in your Life?
- **Planning**: Use the **Dasha Timeline** and **Gochar (Transits)** to know when to push for career growth and when to focus on inner peace.
- **Self-Awareness**: The **Core Identity** and **Personality Matrix** help you understand your natural drives—why you react emotionally or why you are so ambitious.
- **Guidance**: The **Remedies** section provides modern, behavioral actions (like meditation or journaling) to balance planetary energies.

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

## 🏗️ Deployment Architecture

The application uses a modern, decoupled architecture designed for scale and security.

### Backend (API Layer) → Vercel + Railway
- **Compute:** Deployed as serverless functions on **Vercel** for automatic scaling and edge caching.
- **Database:** Hosted on **Railway (MySQL 8)** ensuring robust relational data integrity with automated backups.
- **Migration:** Run `npm run migrate` via CLI connected to Railway TCP Proxy to sync DB schemas.

### Frontend (Web App) → Static Edge Host
- **Hosting:** Fully static deployment to **Vercel / Netlify / Cloudflare Pages**.
- **PWA:** Generates a Service Worker for offline-ready assets and mobile installability.

### Mobile App (iOS & Android) → EAS Build & Update
- **Builds (APK/IPA):** Handled by **Expo Application Services (EAS Build)** in the cloud.
- **Over-The-Air (OTA) Updates:** Use `eas update` to push JS, style, and asset changes instantly to user devices without App Store review cycles.

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
