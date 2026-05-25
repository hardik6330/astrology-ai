# Astrology AI Pro

> An AI-powered astrology companion that delivers personalized **kundali (birth chart) interpretations**, **palm readings**, **daily horoscopes**, and a **conversational astrologer chat** — built with React 19, Express 5, MySQL, and Google Gemini 2.5 Pro.

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
| **Backend** | Node.js 20+, Express 5, Sequelize 6 + MySQL 2, Zod, Pino, Helmet |
| **AI** | Google Gemini 2.5 Pro (`@google/generative-ai`) |
| **Tooling** | ESLint, Prettier, Husky + lint-staged, Umzug migrations |

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
└── frontend/
    └── src/
        ├── components/            # BottomNav, KundaliChart, …
        ├── pages/                 # Home, Reading, Palm, Chat
        ├── context/               # ChartContext
        ├── services/api.js        # Backend client
        ├── astrology.js           # Client-side chart calculations
        └── theme/tokens.js
```

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

Open http://localhost:5173 in your browser. Done.

---

## Environment Variables

### Backend ([backend/.env.example](backend/.env.example))

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Google Gemini API key |
| `PORT` | | `5000` | Backend port |
| `NODE_ENV` | | `development` | `development` / `production` / `test` |
| `CORS_ORIGINS` | prod only | — | Comma-separated allowed origins |
| `DB_HOST` | | `localhost` | MySQL host |
| `DB_USER` | | `root` | MySQL user |
| `DB_PASS` | | `` | MySQL password |
| `DB_NAME` | | `astrology_db` | MySQL database name |

The backend **fails fast at boot** with a clear message if anything required is missing (validated by Zod).

### Frontend ([frontend/.env.example](frontend/.env.example))

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API URL. Leave default in dev — the frontend auto-derives it from the page hostname, so opening `http://<pc-ip>:5173` on your phone automatically targets `http://<pc-ip>:5000/api`. |

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

---

## Security Notes

- **Never commit `.env` files.** Both `backend/.env` and `frontend/.env` are gitignored. Use `.env.example` as a template.
- **If a key leaks**, Google auto-disables it — rotate at https://aistudio.google.com/apikey.
- The backend enforces Helmet headers, a CORS allowlist (strict in production), and per-endpoint rate limits.

---

## Troubleshooting

**`AI is busy right now` / `AI_OVERLOADED`** — Usually a transient Gemini rate-limit. If it persists, check backend logs for the underlying error — a 403 means your API key was revoked (leaked or invalid).

**`Invalid environment configuration` at boot** — Check the error list; copy [backend/.env.example](backend/.env.example) to `.env` and fill required values.

**Backend won't connect to MySQL** — Verify MySQL is running and the `DB_*` vars match your local setup. Run `npm run migrate:status` to confirm DB reachability.

**Phone can't reach dev server** — Make sure both devices are on the same Wi-Fi, and access via your PC's LAN IP (e.g. `http://192.168.1.42:5173`), not `localhost`.

---

## License

ISC
