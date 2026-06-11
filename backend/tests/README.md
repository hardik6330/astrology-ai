# Backend tests

Runner: **Vitest** (`npm test`, or `npm run test:watch`). `setup.js` injects the
minimum env (`GEMINI_API_KEY`, `JWT_SECRET`) the app validates at import time,
and blanks the Razorpay/IAP keys so a developer's `.env` can't flip the suite
onto a real payment gateway.

## What's covered

No database:

- `health.test.js` — app is importable + routable without a port (proves the
  `app.js` / `server.js` split).
- `auth.test.js` — `requireAuth` / `requireAdmin` rejection paths (401/403) and
  the accept paths. The route-level 401s return before any DB call.
- `errors.test.js` — the single error type (`AppError`) + the global
  `errorHandler` envelope and status mapping.

Against a throwaway SQLite database (no MySQL server needed — `dbConfig.js`
switches to a file-backed SQLite DB in `os.tmpdir()` when `NODE_ENV=test`; WAL
mode lets the services' caller-owned + standalone transactions coexist):

- `money.test.js` — the invariants from CLAUDE.md's "things that have bitten":
  - `creditService.charge()` atomic guarded decrement — concurrent charges
    can't overspend, 402 `INSUFFICIENT_CREDITS` leaves no ledger row, every
    spend/grant appends exactly one ledger row with the running balance.
  - `purchaseService` settlement idempotency — a replayed `confirmOrder` /
    `verifyIapPayment` (same `providerTxnId`) grants once; order snapshots
    survive later plan edits; the IAP mock fallback is exercised explicitly.
  - `engageService` — the atomic claim of `notif_next_at`: of two overlapping
    cron ticks exactly one sends; not-due and kill-switch short-circuits.

## Known SQLite limits

`SELECT ... FOR UPDATE` is a no-op on SQLite, so the *truly concurrent*
double-confirm race in `purchaseService` (guarded by the row lock + in-txn
paid re-check) can only be exercised against MySQL. The sequential replay
tests cover the idempotency contract itself.
