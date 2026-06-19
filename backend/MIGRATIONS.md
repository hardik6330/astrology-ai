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


# GEMINI_API_KEY=AIzaSyAWlbLX9Wgv7im1FpbaqzCiaT9qmb3oYPQ

GEMINI_API_KEY=AIzaSyDVC4nMf27WbrK8ykiMJ9LmqT6vHGCoyMs

GOOGLE_MAPS_API_KEY=AIzaSyB_OJFJZVfVoaGgNIHljBYPoSqApkyJzJY


# railway db 
# DB_HOST=acela.proxy.rlwy.net
# DB_PORT=39231
# DB_USER=root
# DB_PASS=ZjVnJowfSziLAoWsoXKiGRJpmoRQeHdR
# DB_NAME=railway


# local db 
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=astrology_db


JWT_SECRET=sdfsdfwe.rwer324234rdfdvcbfgh.5r6456tDFGERTY34535656.dfgFDGDGDFGtreer.tterterter
ADMIN_JWT_SECRET=dlksjdgfsddfs.fdgertrert34erter3retert34232.fghdfgsdwerwe.345fdgdfg.rtrete
JWT_EXPIRES_IN=30d
NODE_ENV=development

CORS_ORIGINS=http://144.24.117.60
OTP_ENABLED=false

Firebase_token=AdpetEZOYUCj13s-mYiUlrK-hEbnkGSoYytL_GnDsWBdszYBccqroOmUCiNS5ogM146Q0QLZf7rY_vek8xar3KcN2BsE-pwJz2pXKLB8nlcCf-g86st0P-DhM9k8BAtUfhn08hV93PduI5DxtEJ1skGT

FIREBASE_SERVICE_ACCOUNT_B64=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiZnV0dXJlLWFpLWIwNWFkIiwKICAicHJpdmF0ZV9rZXlfaWQiOiAiODZkYmMyYTBhM2Y4ZTdjNjc0Y2NkMTMyNDRmNWQ1ODcxMTVjZTc0OCIsCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZRSUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS2N3Z2dTakFnRUFBb0lCQVFEQXBGTWREVnIyak1PdVxuVnZNZmVlU3ZOL094Yng2NVB0TTl3WkdZbEc2cGY1QkVITVlWOVJxd3EvVXI3S1pFUWFLRkg4aWRjRmxMVHY5WlxuQVJVcm1JczhGc1FXdGEzdllOMEUydlduTFczL3hNQU9kR1Z1UkRVLzY4T2J6QkRaaFp6WVZBWHcya3BFMWNGcVxueTcveWhhMzFqNXJTd2RYL0R6a2xBNktXdWhhcDVJYWRobTBMRm5NcFo5SkxqQ3BtaTh1cG9Za3dNcXhkcUpObFxuSkl0UDA2bVdkUEhCWkJISVQyME1xMkQrQys0Y0lxb29DUm1rSzEwWWM1bnp4Z3IyYkwzMjhFVjFlcHVSVkxWMlxuaUp5Qk01em11bEF0R1Rid0REV3VmWkJUZUJiT1ZVbnNIVnNXL2FkT3BJcnprNHBWMXNWUDZnbEh1KzJOS0YvOFxuWGJkdFR5S0pBZ01CQUFFQ2dnRUFBc3Z0Y1FpOWR4c0NuSFFpcGt2czJFb2NQMkgvd2xGRWtqZDF1VmtKMDlnUFxubzhQMHlROWxCZ3dRR05rV1BNREhRQ2dtRDQ1SGRlSWhKWlN3SjR3ZHZFTUZ6c09YVVdIeWxVeFRtZ3Z6TzBHM1xuVUwwc2FsTUVETTQzL1VPeENMTEE5WG16UUhTUjRTem0ySG5EdExvMGJhQzh4NDRQVWk3V1g2dXEyN2N3NS85L1xuN0tvN3RpNjdsM1ozSkZJR3Fqd1Z4TEIvakEyYU4raUtMOENiUTFXMFI2MFhGTEVzZWJVcDhjTDNIVlk3VGdiMVxuWkVTUHFPU1h3VndocExqZW5wUk5GZVoyTTd6bE15ckJWaFJmek5xU0dWM0ZhMGZUM0RkblJlZWFZUjNwWnpHM1xuVEZubkZSd1AvSkg2aUIvdURxR0gxdzNpWGhRMG53eHZtbDV1dkNpeUJRS0JnUUR5Sk1yMWhocExwZFh4eERJZ1xuWmp5QXdWRDBEbEx4aXgxM2NpajZLR1p3Qm11V20yUG42alM0V25wZ0lCWWF2WXQ3VXFRN2lTQTdSYWk3N2pUZlxuaUpMZE15SlJqaDAyd2tSOUdlbUFBZ2FBQlBlTnpVU3hCNnJpSE92ZzNEMzNZYXZMU3BaZEVFZXFxMHN2dVVuWlxuTXl1OURlQnlZRk5OaDY2QkRUdE5XYmxOWlFLQmdRRExxbDdnTlNHRFlHNEJQMy9ieU5WZjNPcCtGTm5ONXpxZlxuN2hJaENFamxBd1lkYXZpSnEzMnJYYUNsZHloYnUxU0tpd25JdmZGR3hhSU9CaUg4VEREK1d3blVzd2Q0eHJGVVxuSGF4dFBHRzhLOUZHVWs5Y0hJcUNIUTVuUWdtSW5DQ01IUDZqN0gvRFNnZkRQVG9hbGlVM1VzeXVLYjMrRlVPQlxuK3IzZ1M1ZXdWUUtCZ0hYZ3MyMFMrM29ZSVM2dzlEWVJqeUtlK1duV0QwckhEbkUzZ2Z0Rjc1aFpoOGFwbnRrblxuaXNLMFNSN0NnQUJFaGNKaldOQWkwUzRKbXpyaG01dTJRTWl1TythMzZFRGdFYmRWQmZickJYOE02L1o4RnhTWFxuUnZrTVcwZjc3NjZlUGFPWmk5bUNNMkZDUWpmWlc3b0F6eW9adDBuMjJwYkRsby84Z1FJR3k4NkJBb0dCQU1ndlxuV1B3bUhSL0dDN3BjVU8rV011ejc5dDBnMzRqOHErb0JGbjZ6WnZyN0F1cXRkMGZTY1Q2Y1U4ZndISkkxeW40MlxuOWRJRHFRRjRSclprSHNtZmxsU2M1VWZWQlJZWXJycFFSR2hHZm9aM3gwYklwc3FTSHk2UEl0WXAyYmNXUndPUlxuaUZWVm82c3Z1L3VTMWViR0NDU2QxU09uVWVGSncwWWlVTG9EYzBEVkFvR0FIODMwMzVZdnZjUlFNTkxyRU1Zb1xuR29RSkpKamRXaU4wOVJjVjFlandDQy8vejNsckpmN0llY0Z6bGFDNGkycmF1blFDOTJIb3hYUEtkTitlR3N1VlxuYitsMHhSU3VnYk1raEtmQkZyOHBaN1N4WWNTTzU4QkR5ZG9oWW5iWWt6bm4xNGpieERYeWw3ZUdqUG5rV2MzelxuVFJoZkk4LzlyU0VCWEtuMHdyTjlWL2s9XG4tLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tXG4iLAogICJjbGllbnRfZW1haWwiOiAiZmlyZWJhc2UtYWRtaW5zZGstZmJzdmNAZnV0dXJlLWFpLWIwNWFkLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAiY2xpZW50X2lkIjogIjEwNzY0ODk3NTkyNTcwNTE1NDkxMyIsCiAgImF1dGhfdXJpIjogImh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi9hdXRoIiwKICAidG9rZW5fdXJpIjogImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwKICAiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsCiAgImNsaWVudF94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL3JvYm90L3YxL21ldGFkYXRhL3g1MDkvZmlyZWJhc2UtYWRtaW5zZGstZmJzdmMlNDBmdXR1cmUtYWktYjA1YWQuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K

CRON_SECRET=b276f327ac0d30818c4dc1873a6aec84403f161918d7198dbda7ab892058f698
FIREBASE_SERVICE_ACCOUNT_PATH=./src/config/firebase-admin.json

VITE_FIREBASE_VAPID_KEY1=9YyX4PnyiFazMVxbN4xDAT9L_m5a9fXRlSlOkZDZQ9c

BACKEND_URL=https://astrology-ai-pro-ez9t.vercel.app
VERCEL=0

APPLE_IAP_SECRET=
GOOGLE_IAP_SERVICE_ACCOUNT_JSON=

CORS_ALLOW_VERCEL_PREVIEWS=false

# Default back-office admin — seeded once on boot if no admin exists.
# Change ADMIN_PASSWORD after first login.
ADMIN_NAME=Administrator
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@admin@00123

# Razorpay test keys — paste your rzp_test_... key id + secret here.
# Until both are set, the buy flow uses the mock checkout.
RAZORPAY_KEY_ID=rzp_test_SxqIJBzDR117nz
RAZORPAY_KEY_SECRET=L69uKHN5RgoT5Q3k9SKEJc5p

VITE_FIREBASE_VAPID_KEY=BG4OWujIS2bny2aJrozm5_xWHBPhPFsjSjaIMPwJ6F4M0MZBqvITw1EZ9NGzTP22_gGt7Xyz51M3FRnGA4Dpx-s