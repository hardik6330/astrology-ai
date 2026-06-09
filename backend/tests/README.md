# Backend tests

Runner: **Vitest** (`npm test`, or `npm run test:watch`). `setup.js` injects the
minimum env (`GEMINI_API_KEY`, `JWT_SECRET`) the app validates at import time.

## What's covered (no database required)

- `health.test.js` — app is importable + routable without a port (proves the
  `app.js` / `server.js` split).
- `auth.test.js` — `requireAuth` / `requireAdmin` rejection paths (401/403) and
  the accept paths. The route-level 401s return before any DB call.
- `errors.test.js` — the single error type (`AppError`) + the global
  `errorHandler` envelope and status mapping.

## Still owed — money-path integration tests (need a test DB)

These touch Sequelize and need a real/compatible MySQL, so they aren't wired up
yet. Add them once a disposable test DB is available (a `mysql` service in CI, or
point `DB_*` at a throwaway schema and run migrations first):

- **`creditService`** — `charge()` atomic guarded decrement rejects overspend
  with 402 `INSUFFICIENT_CREDITS`; `grant()`/`charge()` write exactly one ledger
  row in the same transaction; concurrent charges don't double-spend.
- **`purchaseService`** — Razorpay HMAC verify accepts a correctly-signed payload
  and rejects a tampered one; settlement is idempotent (a replayed verify with
  the same `providerTxnId` grants once); IAP verify is idempotent per
  transaction id.

Recommended approach: a `beforeAll` that connects + `sequelize.sync({ force })`
against the test schema, seeds a user, and a `afterAll` that drops it.
