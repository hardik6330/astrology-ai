# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repo.

## What this project is

Astrology AI Pro — a Vedic astrology + palmistry product with three deployable apps that share one backend:

- `backend/` — Express 5 + Sequelize + MySQL + Firebase Admin + Google Gemini
- `frontend/` — React 19 + Vite (web app, PWA)
- `mobile/` — React Native + Expo SDK 54 (iOS + Android)

Single MySQL DB persists users, kundalis (birth charts), palm readings, daily readings, and chat messages. Firebase Phone Auth is the single identity source for both clients; backend verifies ID tokens and issues its own JWTs.

## Core user features

1. **Kundali interpretation** — natal chart + AI reading
2. **Daily guidance** — transit-based personalized reading for any date
3. **AI astrologer chat** — topic-gated Q&A, persisted per user
4. **Palm reading** — Gemini vision analyzes uploaded hand photos

## Important architecture notes

### Duplicated astrology engine
`frontend/src/astrology.js` and `mobile/src/shared/astrology.js` are ~950-line **intentional duplicates**. Both clients compute charts locally via `astronomy-engine`, then POST the facts to the backend for Gemini interpretation. **When changing chart logic, edit both files** until a shared package is extracted. Same goes for `prompts.js`.

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
`backend/src/server.js` calls `sequelize.sync()` (non-destructive: creates missing tables, doesn't alter or drop) on every boot. Migrations live in `backend/migrations/` (Umzug). For schema changes that aren't simple table creation, write a migration. `sync()` alone won't add new columns to existing tables.

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
`expo-blur` (login card), `expo-updates` (OTA), `expo-image-picker` (palm photos), `@react-native-community/datetimepicker`, `react-native-reanimated`, `react-native-svg`, `react-native-gesture-handler`. Adding more native modules requires `eas build`, not `eas update`.

## Conventions

- **Comments:** terse, explain *why*, not *what*. The existing codebase has good examples — match its style.
- **Env validation:** new backend env vars must be added to `backend/src/config/envConfig.js` Zod schema, or they won't be loaded.
- **Sequelize models:** register associations in `backend/src/models/index.js`, don't scatter them.
- **Routes:** mount under `/api` in `backend/src/server.js`. Each feature has its own router + controller + service trio.
- **Mobile theme:** all colors flow from `mobile/src/theme/ThemeContext.js` and `tokens.js`. Don't hardcode colors in components if a token exists.

## Things that have bitten in the past

- **Secrets in chat / screenshots.** Multiple keys (`firebase-admin.json`, Gemini API key, MySQL root password) have been visible in screenshots and pasted into conversations. Treat each as compromised when that happens. Rotate immediately; never reuse.
- **`backendColor: "transparent"` + `elevation` on Android** = dark inner fill (bug in RN's elevation shadow when there's no opaque background). Remove elevation or use a solid background.
- **EAS local `.env` is not uploaded to cloud builds.** Use `eas env:create` instead, or APKs ship pointing at `localhost`.
- **Vercel root directory misconfiguration** — if logs show `/var/task/backend/src/...` instead of `/var/task/src/...`, Root Directory isn't set to `backend`, and `npm install` won't run for the backend.
- **Sequelize sync race on serverless cold starts** — current code accepts this; if it becomes a problem, gate `sync()` behind a one-time flag or move to migrations-only.

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
```

## Where to look

- API entry point: `backend/src/server.js`
- AI prompts (canonical): `backend/src/ai/prompts.js`
- Chart math (web + mobile): `frontend/src/astrology.js` + `mobile/src/shared/astrology.js`
- Mobile root: `mobile/App.js` → `mobile/src/navigation/RootNavigator.js`
- Mobile splash: `mobile/src/components/SplashScreen.js`
- Mobile drawer: `mobile/src/components/DrawerContent.js`
- Auth (mobile): `mobile/src/features/auth/AuthContext.js`
