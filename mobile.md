# Selora — Mobile App Guide

A quick, non-technical-but-accurate tour of the **Selora** mobile app (React Native + Expo, iOS + Android). Read this and you'll have a solid mental picture of *what the app does* and *what it looks like* — its screens, flows, colors, and fonts.

> Codebase: `mobile/` · Brand name: **Selora** · Expo slug `astrology-ai`, deep-link scheme `astrologyai`.
>
> 📝 **Keep this current.** When a mobile screen, flow, theme value (color/font/token), or navigation behavior changes, update this file in the same change (and `CLAUDE.md` / `PROJECT_STRUCTURE.md` as relevant). See the "Keeping the docs in sync" rule in `CLAUDE.md`.

---

## 1. What the app is

Selora is a **Vedic astrology + palmistry** app. A user signs in with their phone number, enters their birth details once, and gets:

1. **Birth chart (Kundali)** — a computed natal chart with planets, houses, nakshatra, doshas, and a destiny scorecard.
2. **AI reading (Insights)** — a personalized, multi-section interpretation generated from the chart.
3. **Daily guidance** — a transit-based reading for any date.
4. **AI Astrologer chat** — ask astrology questions, answered against your chart.
5. **Palm reading** — photograph one or both palms; an on-device quality gate checks the photo, then AI analyzes the lines.

Paid features cost **credits**; users top up through the Credits store (Apple in-app purchase via RevenueCat; no mock path).

---

## 2. Look & feel (the design system)

The whole UI is driven by tokens in `mobile/src/theme/tokens.js` + `ThemeContext.js`. **Don't hardcode colors** — everything flows from these tokens. There's a full **dark mode (default) and light mode**, toggled from the drawer and saved to storage (`astro_theme_v1`).

### Color palette

**Dark theme (default):**

| Role | Value | Look |
|------|-------|------|
| Primary | `#a855f7` | vibrant purple |
| Primary light | `#c084fc` | softer purple |
| Accent | `#6366f1` | indigo |
| Accent light | `#a5b4fc` | light indigo |
| Success | `#22c55e` | green |
| Warning | `#fbbf24` | amber |
| Danger | `#f87171` / `#ef4444` | red (retrograde, errors) |
| Info | `#60a5fa` | blue |
| Text | `#ffffff` | white |
| Text body | `#cbd5e1` | light gray |
| Text dim / muted / faint | `#94a3b8` / `#64748b` / `#475569` | grays |
| Background | `#050508` | near-black |
| Card bg | `rgba(20,20,30,0.6)` | semi-transparent dark |
| Card border | `rgba(255,255,255,0.10)` | subtle light hairline |
| Gradient | `#6366f1` → `#a855f7` | indigo→purple |

**Light theme:** Primary `#7c3aed`, accent `#4f46e5`, text `#0f172a` on background `#f8fafc`, white cards, gradient `#4f46e5` → `#7c3aed`.

The vibe: **dark, cosmic, purple/indigo** with amber + pink celestial accents (used in the SVG zodiac art on splash/login).

### Typography

- **Body font:** **Inter** (`@expo-google-fonts/inter`) — weights 400/500/600/700.
- **Display / brand font:** **Space Grotesk** (`@expo-google-fonts/space-grotesk`) — 500/700, used for the "Selora" wordmark and hero headings (`fontFamily.display`).
- Fonts are loaded with `useFonts()` in `App.js` **before** any UI shows, so there's no system-font flash.
- A global patch (`theme/textScale.js`) applies Inter to all text and scales every font size **×1.1** for readability.

### Sizing scale

```
fontSize  xs 14 · sm 16 · md 18 · lg 20 · xl 24 · xxl 28 · hero 36
spacing   xs 8  · sm 12 · md 16 · lg 22 · xl 30 · xxl 40
radius    sm 12 · md 14 · lg 18 · xl 24 · pill 9999
```

Shadows: a soft **card shadow** (black, y+8, blur 16) and a glowy **"magic" shadow** (indigo `#6366f1`, y+4, blur 10) on primary CTAs.

### Reusable building blocks (`mobile/src/components/`)

- **CosmicCard** — the standard rounded, semi-transparent dark container used for every content section.
- **MagicButton** — primary (solid purple, white text, magic glow) and ghost (bordered, transparent) variants; haptic tap + press-scale.
- **SplashScreen**, **DrawerContent**, date/picker fields, modals, progress bars, SVG charts (below).

---

## 3. Navigation map

Type: a **front drawer** (280px wide) for signed-in users; a plain **stack** with just `LoginScreen` when signed out (`mobile/src/navigation/RootNavigator.js`).

```
Not signed in → LoginScreen
Signed in     → Drawer
                 ├─ Home          (birth-details form, 2-step)
                 ├─ Reading  ★    (main dashboard — 4 tabs)   ← returning users land here
                 ├─ Palm          (palm capture & reading)
                 ├─ Chat          (AI astrologer)
                 ├─ Profile       (details, credits, theme)
                 ├─ Help          (FAQ / contact / about)
                 ├─ Credits       (top-up store — hidden from drawer)
                 ├─ PalmStep      (optional palm onboarding — hidden)
                 └─ PalmCompare   (both-hand comparison — hidden)
```

- **Initial route is deterministic:** the app waits for the chart to hydrate, then sends returning users straight to **Reading**, new users to **Home**.
- **Drawer** shows: avatar + name + birth date/time/location (→ Profile), a **credits pill** (→ Credits), menu items (Birth Chart, Insights, Palm Reading, AI Astrologer, Profile, Help), and a footer with the **theme toggle** + logout.
- **Android back** uses a "home base" model — every top-level screen routes hardware-back to Reading/Kundali (via the `useBackToKundali` hook), and Reading backs sub-tab → Kundali → exit.

---

## 4. Screen-by-screen

### Login (`features/auth/`)
Firebase **phone OTP** sign-in. Animated floating logo, country dial-code auto-detected via locale, friendly error messages, shake animation on bad input. `AuthContext.js` holds the token and restores the saved chart on launch.

### Home (`features/home/`)
A **2-step birth-details wizard**: (1) name, gender, birth date & time, location (city search); (2) confirm → compute chart. The chart is stored in `ChartContext` and the user moves to Reading.

### Reading (`features/reading/`) — the heart of the app
A dashboard with **4 swipeable tabs** (gesture + haptics, animated slide):

1. **Kundali** — birth-chart wheel (North/South Indian style toggle, SVG), the "Big Three" (Sun/Moon/Ascendant with zodiac glyphs), nakshatra, a daily-guidance card, dosha status pills (Mars affliction / nodal / ancestral / Saturn cycle), panchang snapshot, and a **Destiny Matrix** of scores with color-coded bars (green ≥70 / amber 45–69 / red <45).
2. **Planets** — the 9 grahas with sign/house, retrograde flag (red), a strength bar, and a tappable **detail sheet** per planet.
3. **Timeline** — dasha periods (major/sub), current window highlighted, transits, and the honest **Timeline Check** (a grounded yes/no tied to a real dasha window).
4. **Insights** — the AI master reading: narrative cards (collapsible), "**Show your work**" evidence boxes naming the exact placements behind each section.

### Palm (`features/palm/`)
Pick a hand (Left/Right) → choose **Camera or Gallery** → an **on-device quality gate** (MediaPipe hand-landmark model + pixel heuristics) checks the photo and overlays the 21-point skeleton, with a scored checklist + an "AI Confidence" header. The gate also does **rotation-invariant Left/Right verification** — upload a right hand into the Left slot and it's rejected ("looks like your other hand"); the backend re-verifies authoritatively. Good photos go to the AI for a line-by-line reading; bad ones get a friendly retake card. Photos are **never stored** (only a hash + the text reading). `PalmCompareScreen` does the **both-hand** "Potential vs Reality" comparison (with **duplicate-hand detection** — same photo / same hand in both slots is rejected); `PalmStepScreen` is the optional onboarding version. The classifier + thresholds live in the shared `packages/palm-core` package.

### Chat (`features/chat/`)
AI **astrologer chat** — bubble UI (👤 user / 🔮 AI), suggested starter questions, persisted history, animated typing indicator. Topic-gated (off-topic questions are refused and refunded). Each message costs credits; a low-credits card offers a top-up shortcut.

### Profile (`features/profile/`)
Shows birth details + avatar, live credits balance, the per-feature cost breakdown, edit (→ Home), theme toggle, and logout.

### Credits (`features/credits/`)
The **top-up store**. Plans load from the backend; a plan with a store `productId` runs the **Apple IAP sheet via RevenueCat** (`react-native-purchases`, wrapper `features/credits/iapClient.js`); RevenueCat verifies with Apple and posts to the backend webhook, which grants the credits — the screen then re-polls the balance. A plan without a `productId` shows "Coming soon" (there is no mock grant). `AuthContext` calls `Purchases.logIn(account.userId)` on login and `logOut()` on sign-out so purchases bind to the right ledger. Shows balance + cost breakdown.

### Help (`features/help/`)
FAQ, quick contact (email / WhatsApp / website), and live app name + version from `app.json`.

---

## 5. Signature UI / motion details

- **Splash** (`components/SplashScreen.js`): a hand-drawn **animated SVG cosmos** — a 12-sign zodiac wheel slowly rotating (360° / 22s), a gradient planet with Saturn rings, a 50-star twinkling field, and a pulsing purple glow. Tagline "Precision Vedic astrology" with rotating loading lines ("Aligning the stars…"). Also grabs location permission during this time. ~2.8s then fades.
- **Charts (SVG, `react-native-svg`):** `KundaliChart` (North/South Indian, theme-aware ink), `GocharMap` (bi-wheel: inner natal ring + outer live-transit ring, pulsing halo, "Active Alignments" with an **Interpret ›** deep-link into chat), plus dasha/ashtakvarga wheels.
- **Motion:** `react-native-reanimated` everywhere (swipes, sliding bottom-nav pill, fades, login float/shake) + `expo-haptics` for tap/select feedback.
- **Glyph rendering note:** zodiac/planet unicode glyphs need a generous `lineHeight` + `includeFontPadding:false` on Android, or their tops/bottoms get clipped.

---

## 6. Branding & build facts (`app.json`)

- **Name:** Selora · **slug:** `astrology-ai` · **scheme:** `astrologyai` (these last two must not change — EAS identity / deep links).
- **Icon & splash:** `assets/homescreen-logo.png`; splash bg `#f8fafc` (light) / `#050508` (dark); Android adaptive-icon bg `#0b0a1f`.
- **Bundle id / package:** `com.astrologyai.app` · **orientation:** portrait · **version:** 1.0.0.
- **Permissions:** Camera, photo library, notifications (and mic, declared).
- Push, analytics, and IAP (`react-native-purchases`) are **native modules** — they no-op in Expo Go and need a real **EAS build** to exercise. The RC SDK key comes from `EXPO_PUBLIC_RC_IOS_KEY` (`eas env:create`).

---

## 7. Where things live (quick index)

| Area | Path |
|------|------|
| Theme tokens / context | `src/theme/tokens.js`, `ThemeContext.js`, `textScale.js` |
| Navigation | `App.js` → `src/navigation/RootNavigator.js`; drawer `src/components/DrawerContent.js` |
| Shared chart engine (proxy) | `src/shared/astrology.js` → `packages/astrology-core` |
| Shared palm classifier/config | `src/features/palm/palmGate.js` → `packages/palm-core` |
| Reading tabs | `src/features/reading/sections/` |
| Palm flow | `src/features/palm/` (`PalmScreen.js`, `PalmCompareScreen.js`, `palmGate.js`) |
| Charts | `src/features/kundali/` (`KundaliChart`, `GocharMap`, wheels) |
| Splash | `src/components/SplashScreen.js` |
| App config | `app.json`, dynamic `app.config.js` |

> For deeper engineering rules (security, payments, sync-twin files, deploy), see the root `CLAUDE.md`.
