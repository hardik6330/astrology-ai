# Database Migrations & Seeds

How schema and default data are managed now that the backend no longer relies on
`sequelize.sync()` in production.

## TL;DR

| Environment | Schema | Default data |
|---|---|---|
| **Local dev** | auto `sync()` on boot | auto-seeded on boot |
| **Production** (Vercel **and** private server) | `npm run migrate` (deploy step) | `npm run seed` (deploy step) |

- `sync()` runs **only when `NODE_ENV !== 'production'`** ([src/server.js](src/server.js)). It never ALTERs existing tables, so it can't add a column to a live table — that's what migrations are for.
- Seeds are idempotent. An always-on server seeds once at boot; on serverless run `npm run seed` per deploy (so it doesn't tax every cold start).

## Commands

```bash
npm run migrate         # apply all pending migrations (up)
npm run migrate:status  # show executed vs pending
npm run migrate:down    # roll back the last migration
npm run seed            # apply idempotent default-data seeds
```

All target the DB in your env vars. For Railway prod, pass them inline:

```bash
DB_HOST=<host> DB_PORT=<port> DB_USER=root DB_PASS='<pass>' DB_NAME=railway \
  NODE_ENV=production npm run migrate
```

## Migration strategy: baseline-and-forward

The live DBs already have every table (created by the old `sync()`-on-boot). So
instead of hand-writing 14 risky `createTable` migrations, history starts from a
**baseline**:

- **`0000-baseline.js`** — `up()` calls `sequelize.sync()`. Because `sync()` is
  non-destructive and idempotent, this is safe on both a fresh DB (builds
  everything) **and** the existing prod DB (no-ops — tables already exist). No
  manual `SequelizeMeta` marking needed.
- **`0001-add-performance-indexes.js`** — adds the hot-path indexes the models
  originally lacked (`AuthAccounts.phone`, `ChatMessages(userId,createdAt)`,
  `PushTokens.accountId`, `CreditTransactions(userId,createdAt)`,
  `Kundalis.userId`, `Purchases.userId`). Each is added only if missing, so it's
  safe to run anywhere.

**First rollout (existing prod DB):**
```bash
npm run migrate:status   # both migrations show as pending
npm run migrate          # 0000 no-ops, 0001 adds the missing indexes
```

## Adding a schema change going forward

1. Edit the model in [src/models/](src/models/) (so dev `sync()` reflects it).
2. Add a new migration `migrations/000N-describe-change.js` exporting
   `up({ context })` / `down({ context })`, where `context` is the Sequelize
   `QueryInterface`. Example — add a column:

   ```js
   export async function up({ context: q }) {
     await q.addColumn('Users', 'email', {
       type: (await import('sequelize')).DataTypes.STRING, allowNull: true,
     });
   }
   export async function down({ context: q }) {
     await q.removeColumn('Users', 'email');
   }
   ```
3. Run `npm run migrate` in each environment as a deploy step.

> ⚠️ Never run migrations on app boot. Keep them a discrete deploy step so a bad
> migration fails the deploy, not every cold-start request.
