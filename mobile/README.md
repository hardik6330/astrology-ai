# Astrology AI — Mobile (React Native / Expo)

Native iOS + Android client for **Astrology AI Pro**, mirroring the web frontend's flow (Home → Reading → Chat / Palm) and talking to the same Express backend.

## Stack

| Layer | Choice |
|---|---|
| Runtime | **Expo SDK 54** (React Native 0.81, React 19) |
| Navigation | `@react-navigation/native-stack` |
| State | React Context + AsyncStorage (matches web parity; ready to upgrade to Zustand + React Query later) |
| Astrology engine | `astronomy-engine` — pure-JS, shared verbatim with the web app |
| Camera / Photo | `expo-image-picker` |
| Date/time | `@react-native-community/datetimepicker` |
| Build / Submit | EAS Build (`eas.json` included) |

## Project structure

```
mobile/
├── App.js                       # Root: providers + navigator
├── index.js                     # Expo entry
├── app.json                     # Expo config (icons, permissions, plugins)
├── eas.json                     # EAS build profiles
├── babel.config.js
└── src/
    ├── navigation/RootNavigator.js
    ├── context/ChartContext.js  # Form persistence via AsyncStorage
    ├── services/api.js          # Same endpoints as web — auto-derives dev URL
    ├── shared/                  # Verbatim copies from frontend/src
    │   ├── astrology.js         # astronomy-engine + dasha + scoring + facts
    │   └── prompts.js
    ├── theme/tokens.js
    ├── utils/storage.js
    ├── components/
    │   ├── BottomNav.js
    │   ├── CosmicCard.js
    │   ├── ErrorBoundary.js
    │   ├── MagicButton.js
    │   ├── Picker.js
    │   ├── PremiumInput.js
    │   └── ScreenContainer.js
    └── screens/
        ├── HomeScreen.js        # ✅ Fully ported (birth form)
        ├── ReadingScreen.js     # 🟡 Scaffold — port web's panels next
        ├── ChatScreen.js        # ✅ Functional chat with backend
        └── PalmScreen.js        # ✅ Pick / capture photo + analyze
```

## Quick start

```bash
cd mobile
npm install

# Make sure the backend is running on your dev machine (default :5000):
#   cd ../backend && npm run dev

npm start           # opens Expo dev tools
# then press 'i' for iOS, 'a' for Android, or scan the QR with Expo Go
```

The frontend's URL-derivation trick is preserved: when you open the app on a
physical phone via Expo Go on the same Wi-Fi, it automatically targets
`http://<your-pc-ip>:5000/api`. No config needed.

## Environment

| Variable | When to set |
|---|---|
| `EXPO_PUBLIC_API_URL` | Only for staging / prod builds (or to override the auto-derived URL). |

Set EAS secrets for production builds:

```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value https://api.your-domain.com/api
```

## Production builds

```bash
# One-time setup
npm install -g eas-cli
eas login
eas build:configure

# Build
eas build --platform android --profile production
eas build --platform ios     --profile production

# Submit
eas submit --platform android
eas submit --platform ios
```

## Roadmap (next, in suggested order)

1. **Port KundaliChart** → `react-native-svg` (the web SVG translates 1-to-1).
2. **Port reading panels** (Planets table, Timeline, Daily) — pure render work, logic already in `shared/astrology.js`.
3. **Authentication** — add a `deviceId` middleware on the backend, then layer email/Google sign-in (Firebase Auth or Supabase).
4. **Push notifications** for daily horoscope (`expo-notifications`).
5. **Offline mode** — cache last reading + chat via React Query persisters.
6. **Crash + analytics** — Sentry (`sentry-expo`) and PostHog.
7. **TypeScript migration** when the surface stabilises.

## Conventions

- Design tokens live in [src/theme/tokens.js](src/theme/tokens.js) — never hard-code colors in screens.
- Screens own layout; reusable surfaces (`CosmicCard`, `MagicButton`, `Picker`) live in `components/`.
- All AI/API access goes through [src/services/api.js](src/services/api.js).
- Anything astrological is computed by `src/shared/astrology.js` — keep it in sync with the web's copy (or extract to a shared workspace later).
