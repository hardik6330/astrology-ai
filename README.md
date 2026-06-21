<div align="center">
  <h1>✨ Astrology AI Pro</h1>
  <p><strong>Precision Vedic astrology and AI palmistry — on web and mobile.</strong></p>
  <p><em>Real ephemeris math, not guesswork.</em></p>

  [![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-SDK_54-000020?logo=expo&logoColor=white)](https://expo.dev/)
  [![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
  [![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
  [![Gemini AI](https://img.shields.io/badge/Gemini_AI-2.5_Pro-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)
  [![License](https://img.shields.io/badge/License-ISC-blue.svg)](#license)
</div>

<br />

> **Astrology AI Pro** turns the exact sky at your birth into clear, personal guidance. It computes a **Vedic Kundali (birth chart)** to sub-degree precision *on-device*, derives the deterministic Vedic facts (dignities, Dashas, Doshas, Ashtakvarga, Yogas), then sends those facts — never your raw data — to **Google Gemini 2.5** for interpretation. On top of the chart it adds **AI-vision palm reading**, **transit-based daily guidance**, and a **context-aware astrologer chat** — all behind one secure Express API, delivered as a **web app (PWA)** and a **native iOS/Android app**.

### Why it's different

Most astrology apps either hard-code a few canned horoscopes, or send your birth data straight to an LLM and let it invent the math. This one does neither.

- **Real ephemeris, real math.** Planetary longitudes come from [`astronomy-engine`](https://github.com/cosinekitty/astronomy) (NASA JPL-grade), computed **on-device** for zero latency and privacy. The Vedic layer — Lahiri ayanamsha, Whole-Sign houses, Vimshottari Dasha, Ashtakvarga, Shadbala-lite strength, Dosha/Yoga detection — runs as deterministic code, not as a prompt.
- **The AI sees facts, not you.** The model receives a structured **fact sheet** ("9th lord exalted in the 5th, ruling fortune through higher learning") and is told to reason cause → effect. It never gets your name plus a vague vibe.
- **Honest by design.** A **Prediction Confidence** layer shows how many independent chart signatures back each theme, so "High" means several factors agree — not that the AI sounded sure. The palm reading shows its **measured** geometry, never invented numbers.
- **Genuinely cross-platform.** One backend, two first-class clients (web + native), and an offline astrology engine so charts compute without a network on both.

---

## 📑 Table of Contents

- [Market Opportunity & Positioning](#-market-opportunity--positioning)
- [Features at a Glance](#-features-at-a-glance)
- [The Four Pillars (Features in depth)](#-the-four-pillars-features-in-depth)
- [Core Features in Action](#core-features-in-action)
- [Tech Stack](#tech-stack)
- [Quick Start](#-quick-start)

---

## 📈 Market Opportunity & Positioning

Astrology is no longer a novelty category — it's a fast-growing, AI-driven digital-wellness market, and the incumbents have left a clear opening for an **AI-first, self-service** product.

### The market

| Metric | Figure | Note |
|---|---|---|
| **Global astrology-app market (2025)** | **~$4.73B** | Third-party market-research estimate |
| **Forecast (2030)** | **~$11.7B** | ~2.5× growth in five years |
| **CAGR (2025–2030)** | **~20%** | Cross-firm consensus |
| **Primary growth driver** | **AI integration** | Plus digital-wellness demand + personalization |

> *Market-size figures are synthesized from independent market-research firms (Research and Markets, MarkNtel, Business Research Company) and carry the usual vendor-forecast caveats — the ~20% CAGR is cross-firm consensus; absolute 2030 dollar values vary by source.*

### The competitive landscape splits in two

| Camp | Representative players | Model |
|---|---|---|
| **Western mood / identity apps** | Co-Star (20M+ downloads), The Pattern, Sanctuary, Chani, Nebula | Algorithmic horoscopes, Gen-Z aesthetic, self-service |
| **Indian astrologer marketplaces** | **Astrotalk** (FY25 ~₹1,214 cr, 50M+ downloads), AstroSage (50M+), Astroyogi, GaneshaSpeaks, InstaAstro | **Human astrologers** via paid chat/call |

### Where Astrology AI Pro fits — the wedge

The dominant Indian leader, **Astrotalk (~₹1,214 cr FY25 revenue, 13,000+ astrologers)**, is a **human-marketplace** business — users pay per-minute to chat with a person. The high-scale Western apps are **single-purpose** (mood horoscopes), not full Vedic engines. **Neither is an AI-first, multi-service Vedic ecosystem.** That's the gap this product is built for:

- **🤖 AI-first, not headcount-first.** Instant, 24/7, self-service readings with no per-minute marketplace economics — scalable margins instead of a human supply constraint.
- **🔱 One ecosystem, not one feature.** Kundali + palm reading + daily transits + numerology + compatibility + astrologer chat under a single account and credit wallet.
- **🧮 Real math as the moat.** On-device NASA-grade ephemeris + deterministic Vedic logic means the AI interprets **verifiable facts**, not invented numbers — a credibility signal most "AI astrology" apps can't make. (The AI-ecosystem niche *is* contested — e.g. AskNumeroAI — so defensibility comes from this rigor + UX, not first-mover status.)
- **🌍 Global-ready by construction.** Full-E.164 phone identity, IANA-correct timezones, English-relabelled Vedic terminology, and a web PWA + native apps — built to travel beyond a single market.

### Go-to-market reality check (SEO)

Astrology **head terms are effectively unwinnable** for a new brand — "horoscope" (~1.2M monthly searches) and "birth chart" (~246K) carry keyword-difficulty scores in the high 80s–90s. The viable path is **(1)** a strong, ownable **brand name** to capture branded search, **(2)** evergreen educational content (zodiac/transit guides) for long-tail informational intent, and **(3)** voice/conversational-search optimization — *not* head-term combat. (A `.ai` domain, notably, gives **no** algorithmic SEO boost — Google treats it as a generic gTLD — its value is brand/trust signal only.)

---

## ⚡ Features at a Glance

A quick brief on everything the app does — each item is expanded further down.

**Core readings**
- **🪐 Kundali (birth chart)** — sub-degree natal chart computed on-device, plus a full AI reading (life theme, identity, career, relationships, strengths, growth zones, key placements, remedies).
- **✋ Palm reading** — on-device quality gate (MediaPipe Hands) → Gemini Vision per-line analysis; **both-hands** "inborn potential vs. lived reality" comparison.
- **📅 Daily guidance** — transit-mapped reading for any date: Moon house, alignment %, lucky colour/number, auspicious windows, Rahu Kaal — cached per day.
- **💬 AI astrologer chat** — topic-gated, chart-grounded Q&A that remembers prior turns and folds in your latest palm reading; persisted per user.

**Charts & visualizations**
- **Celestial Wheel** (North/South Indian), **Dasha Wheel**, **Ashtakvarga heat-wheel**, **Destiny Matrix** (0–100 life-area scores), **Planetary Strength** meters (Shadbala-lite), and **Panchang** snapshot.
- **🌀 Bi-Wheel Gochar map** *(web + mobile)* — dual wheel of natal vs. live transits with conjunction connectors and **"Active Alignments"**, each with an **"Ask ›"** button that deep-links to chat and auto-asks that exact transit.

**Trust & interactivity ("show your work")**
- **🔎 Show-Your-Work evidence** — every AI section cites the exact placements behind it; palm reading shows **measured** geometry (never model-invented numbers).
- **⏳ Timeline Check** — a grounded past-event yes/no tied to a real dasha window; honest by design and remembered on-device.
- **📊 Prediction Confidence** — how many independent chart signatures back each theme (High = factors agree, not "the AI sounded sure").
- **👆 Interactive planets & dasha** — tap any planet for a detail sheet; expand any forecast window for its *why* + behavioural Do's/Don'ts.

**Platform & system**
- **🔐 Phone-OTP auth** (Firebase) with backend-issued JWTs; **💳 credits + payments** (Razorpay web, native IAP mobile) with an append-only ledger; **🛠 admin back-office** for users, plans, feature costs, and pushes.
- **🔔 Randomised engagement pushes** with a bundled custom notification sound; **🌍 geocoding + IANA timezone** cache; **🎨 dark/light theming** and polished haptics/animations across both clients.

---

## 🔱 The Four Pillars (Features in depth)

### 1. 🪐 Kundali — Birth Chart + AI Reading

The flagship experience. From a name, gender, date, time, and birthplace it builds a complete natal chart and a multi-tab dashboard:

- **Birth Chart tab** — Big Three (Sun / Moon / Lagna), Janma Nakshatra, the **Celestial Wheel** (North & South Indian styles), **Dosha** indicators (Mangal, Kaal Sarp, Pitra, Sade Sati), the **Panchang** snapshot (Tithi, Nakshatra, Yoga, Karana, Vaara), and a **Destiny Matrix** of 0–100 life-area scores.
- **Planets tab** — Every graha in both **Sidereal (Vedic)** and **Tropical (Western)** zodiacs, Whole-Sign house placement, dignity (exalted / own / debilitated), retrograde status, and a **0–100 strength meter** per planet.
- **Timeline tab** — The **Dasha Wheel** and **Ashtakvarga Wheel**, the **Bi-Wheel Gochar map** (a dual SVG wheel: inner ring = natal placements, outer ring = live transits, with dashed connectors for transit↔natal conjunctions surfaced as **"Active Alignments"**), a written **Timeline Forecast** of upcoming Mahā/Antardashā windows with tone and dates, the **Prediction Confidence** transparency card, and **Gochar** (live transits, including Sade Sati phase). Each active alignment has an **"Ask ›"** button that deep-links straight into the astrologer chat and auto-asks that exact transit's question. *(Web + mobile.)*
- **Insights tab** — The AI synthesis: a Life-Theme headline, Core Identity, Personality Matrix, Career, Relationships, Strengths, Growth Zones, Key Placements, and modern behavioural **Remedies**.

> Interpretation is generated by **Gemini 2.5 Pro** (`thinkingBudget: 768` — the deepest of any task) from `INTERP_SYSTEM`, the "Master Vedic Astrologer" prompt in [`backend/src/ai/prompts.js`](backend/src/ai/prompts.js).

### 2. ✋ Palm Reading — AI Vision + On-Device Quality Gate

Upload or capture a palm photo and get a structured palmistry reading — with two layers of quality control so the AI never wastes a call on a bad photo:

- **On-device gate first.** A **MediaPipe Hands** model runs *locally* to reject obviously unusable shots instantly — `not_a_palm`, `back_of_hand`, `blurry`, `too_dark`, `too_far`, `cropped`, `multiple_hands`, `wrong_hand` — each with a friendly retake hint. Web uses `@mediapipe/tasks-vision` (WASM); mobile uses a **native hand-landmarker module** (`mobile/modules/hand-landmarker`, MediaPipe via `react-native-nitro-modules`) — it replaced the earlier TensorFlow.js path for speed.
- **Server gate second.** A cheap **Gemini Flash** pass (`PALM_GATE_SYSTEM`, `thinkingBudget: 0`) double-checks usability before any expensive Pro call.
- **The reading.** **Gemini 2.5 Pro Vision** returns per-line analysis (Life, Head, Heart, Fate lines, Mount of Venus, Marriage lines), an overall vibe, strengths, watch-outs, practical career/love guidance, and classical palmistry cross-checks.
- **Both-Hands "Full Life Comparison."** A single Pro call (`PALM_BOTH_HANDS_SYSTEM`) reads the **left hand as inborn potential** against the **right as lived reality**, returning a per-hand summary plus an evolution/alignment synthesis — "what you were given vs. what you've made of it."
- **Efficiency built in.** Photos are compressed (≤1024 px, JPEG q0.7) before upload; images are **never stored** — only a SHA-256 hash, used to dedupe and serve cached readings.

### 3. 📅 Daily Guidance — Transit-Aware, Per-Day

Pick any date on the month strip and get a reading mapped to that day's sky against *your* chart:

- Moon transit house, daily **alignment %**, lucky colour & number, auspicious windows, and **Rahu Kaal**.
- Generated by **Gemini 2.5 Pro** (`DAILY_SYSTEM`, `thinkingBudget: 256`) and **cached per user, per date** — a green dot marks days already computed, so revisits are instant and free.
- Mobile can use **live GPS** (via `expo-location`) to localise transit timings to where you actually are.

### 4. 💬 AI Astrologer Chat — Grounded, Topic-Gated, Persistent

A conversational astrologer that stays anchored to *your* chart:

- **Topic gate.** A fast `GUARD_SYSTEM` (Flash-Lite) classifier answers ALLOW / BLOCK first — off-topic questions (general knowledge, coding, third-party readings, NSFW) are politely refused, keeping the Pro model focused.
- **Context replay.** The service groups prior turns by detected topic (career, marriage, health, money, family, timing, travel, education) and replays the most relevant Q&A pairs, so follow-ups feel continuous.
- **Cross-feature awareness.** Your most recent palm reading is folded into the chat context, letting the astrologer reference both chart and hand.
- **One-tap deep-links.** Tapping **"Ask ›"** on a Bi-Wheel transit alignment opens the chat pre-loaded with that exact question and sends it automatically — no typing.
- **Answered by Gemini 2.5 Pro** (`CHAT_SYSTEM`) with a warm, plain-English Vedic persona that handles sensitive questions with care. Every turn is **persisted per user** so history survives reloads and re-installs.

### ➕ Supporting systems

- **🌍 Location & Timezone engine.** City autocomplete is served by the backend from a **MySQL cache first**, falling back to **OpenStreetMap Nominatim** (free, keyless). Each resolved city is enriched with its IANA timezone via `tz-lookup` — correctly handling half/quarter-hour zones (IST +5:30, Nepal +5:45) — then cached permanently.
- **🔐 Phone-OTP auth.** Firebase Phone Auth is the single identity source for both clients; the backend verifies the Firebase ID token with the Admin SDK and issues its own 30-day JWT.
- **🎨 Theming (mobile).** A full dark/light palette system (`ThemeContext` + design tokens) with persisted preference and a `useStyles((c) => …)` factory pattern — no hard-coded colours.
- **🪄 Polished UX.** Haptic feedback, press-scale animations, cross-fade tab transitions, animated splash + login starfields, skeleton loaders, and an Android back-button that returns to the chart instead of exiting.

---

## Core Features in Action

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
| **Daily Guidance** | Transit-mapped guidance for any date, with alignment score, lucky color/number, and Rahu Kaal. | <img src="frontend/src/assets/main/daily-data.png" width="250" /> |
| **Timeline Forecast** | AI-driven life predictions mapped against your planetary timeline for maximum context. | <img src="frontend/src/assets/main/timeline-forcast.png" width="250" /> |
| **Prediction Confidence** | Transparency layer showing how many independent chart signatures support each AI-driven theme. | <img src="frontend/src/assets/main/prediction-confidence.png" width="250" /> |
| **Current Sky (Gochar)** | Real-time planetary transits relative to your Moon sign, tracking immediate energetic shifts. | <img src="frontend/src/assets/main/curretn-sky.png" width="250" /> |

---

## Tech Stack

| Layer | Stack |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 7, TanStack Query 5, vite-plugin-pwa, astronomy-engine, `@mediapipe/tasks-vision` (MediaPipe Hands, WASM) |
| **Mobile** | React Native 0.81, Expo SDK 54, React Navigation 7 (drawer + native-stack), Reanimated 4, expo-image / image-picker / image-manipulator, expo-haptics, expo-updates, expo-location, react-native-svg, react-native-iap, native `hand-landmarker` module (MediaPipe via react-native-nitro-modules) |
| **Backend** | Node.js 20+, Express 5, Sequelize 6 + MySQL (`mysql2`), Zod, Pino, Helmet, express-rate-limit, Firebase Admin, jsonwebtoken, Razorpay, googleapis (Play IAP), node-cron |
| **AI** | Google Gemini 2.5 (`@google/generative-ai`) — Pro for synthesis, Flash/Flash-Lite for gating — text + vision |
| **Geo** | OpenStreetMap Nominatim + `tz-lookup` (IANA timezone), MySQL-cached |
| **Auth** | Firebase Phone Auth (OTP) — client sends ID token, backend verifies + issues JWT |
| **Tooling** | ESLint, Prettier, Husky + lint-staged, Umzug migrations, EAS Build + EAS Update, GitHub Actions → Oracle VPS (pm2 + nginx, atomic releases) |

---

## 🚀 Quick Start

Get all three apps running locally in a few minutes.

### Prerequisites

- **Node.js 20+** (repo pins `20.11.0` via [`.nvmrc`](.nvmrc))
- **MySQL 8+** running locally (or a remote instance)
- A **Google Gemini API key** — get one at https://aistudio.google.com/apikey
- *(Optional)* A **Firebase project** with Phone Auth enabled, for real OTP login

### 1. Clone

```bash
git clone https://github.com/palak-commit/astrology-ai-pro.git
cd astrology-ai-pro
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env       # then fill in GEMINI_API_KEY + JWT_SECRET + DB credentials
npm run dev                # http://localhost:5000 — in dev, sync() auto-creates tables on boot
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

> 💡 Added or moved a file? Restart Metro with `npx expo start --clear` to bust the bundler cache.

---

## 🤝 Contributing

This project combines Vedic logic, astronomy, and AI — there's room to contribute in any of them:

- **Astrology** — refine the Vedic logic (Dashas, Yogas, Dosha rules) in the shared engine.
- **AI** — improve the multi-model Gemini routing, prompts, and in-flight dedupe.
- **Frontend** — polish the SVG charts and the bi-wheel transit map.

**Before you start:**

1. Read [CLAUDE.md](CLAUDE.md) — it documents the architecture, the **intentional duplication** rule (edit both `astrology.js` engines + `prompts.js`), and known gotchas.
2. Run `npm run lint` and `npm run format` in the package you touched; keep comments terse and explain *why*, not *what*.
3. Open a focused PR — small, well-scoped changes are reviewed fastest.

> 💡 Good first issues: add a screenshot for the Bi-Wheel Gochar map, extend a Dosha rule, or tighten a Gemini prompt.

---

## License

ISC © Astrology AI Pro
</content>
</invoke>
