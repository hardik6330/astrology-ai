# Database Backup & Restore

Simple guide: how to save a copy of the database, and how to load it into a new one.

Two hosts are covered — **Railway** (the old one) and **Aiven** (the one we use now).

---

## Before you start

You need 5 things from your database provider's website:

| What | Railway | Aiven |
|---|---|---|
| Host | `something.proxy.rlwy.net` | `something.aivencloud.com` |
| Port | a random number | a random number |
| User | `root` | `avnadmin` |
| Password | (copy from console) | (copy from console) |
| Database name | `railway` | `defaultdb` |

**Aiven:** open your service → *Connection information*. Everything is there.
**Railway:** open the MySQL service → *Variables* or *Connect*.

The password goes in front of the command as `MYSQL_PWD='...'`. This keeps it out
of your command history.

---

## Backup (save a copy)

### If your database is on Railway

```bash
MYSQL_PWD='your-password' mysqldump \
  -h your-host.proxy.rlwy.net -P your-port -u root \
  --single-transaction --routines --triggers \
  railway > backend/railway_backup.sql
```

### If your database is on Aiven

```bash
MYSQL_PWD='your-password' mysqldump --ssl \
  -h your-host.aivencloud.com -P your-port -u avnadmin \
  --single-transaction --routines --triggers --no-tablespaces \
  defaultdb > backend/aiven_backup.sql
```

Aiven needs two extra flags:
- `--ssl` — Aiven only accepts secure connections
- `--no-tablespaces` — the `avnadmin` user isn't a full admin, and the command fails without this

You now have a `.sql` file. **That file is your backup.** Copy it somewhere safe
(Google Drive, another computer) — it is not saved to Git.

---

## Restore (load the copy into a new database)

Same command, but `mysql` instead of `mysqldump`, and `<` instead of `>`.

### Into a Railway database

```bash
MYSQL_PWD='new-password' mysql \
  -h new-host.proxy.rlwy.net -P new-port -u root \
  railway < backend/railway_backup.sql
```

### Into an Aiven database

```bash
MYSQL_PWD='new-password' mysql --ssl \
  -h new-host.aivencloud.com -P new-port -u avnadmin \
  defaultdb < backend/aiven_backup.sql
```

**Moving from Railway to Aiven?** Just use the Railway backup command, then the
Aiven restore command. The `.sql` file works with any MySQL — only the connection
details change.

---

## Check that it worked

Count the rows:

```bash
MYSQL_PWD='your-password' mysql --ssl \
  -h your-host -P your-port -u your-user your-database -e "
SELECT (SELECT COUNT(*) FROM Users) users,
       (SELECT COUNT(*) FROM Settings) settings,
       (SELECT COUNT(*) FROM CreditTransactions) ledger;"
```

If the numbers look right, the import worked.

Then check the app can connect:

```bash
cd backend && npm run dev
```

If it starts without a database error, you're done.

---

## After moving to a new database

1. Open `backend/.env` and update these:
   ```
   DB_HOST=...
   DB_PORT=...
   DB_USER=...
   DB_PASS=...
   DB_NAME=...
   DB_SSL=true      # only for Aiven
   ```

2. **Don't forget the live server.** The website uses a *different* `.env` file
   that lives on the server (`shared/.env`), not in this project. Update it over
   SSH and restart with `pm2 reload astrology-backend` — otherwise the live site
   keeps using the old database.

---

## If something goes wrong

| Error you see | What it means |
|---|---|
| `Can't connect ... (111)` | The database isn't running yet. New Aiven services take ~5 minutes to start. Free Aiven databases also shut down when unused — open the console and check it says **Running**. |
| `Lost connection ... initial communication packet` | The database is switched off or deleted. Check the provider's website before blaming your password. |
| `Access denied` | Wrong user or password. Remember: Railway uses `root`, Aiven uses `avnadmin`. |
| `PROCESS privilege ... INFORMATION_SCHEMA.FILES` | You forgot `--no-tablespaces` on an Aiven backup. |
| `SSL connection error` | You forgot `--ssl` on an Aiven command. |
| App closes as soon as it starts | It can't reach the database. Fix the connection details, not the app. |

---

## Current setup (July 2026)

- **Now using:** Aiven MySQL, database `defaultdb`
- **Old Railway database:** gone — the account was blocked, and the data can only be recovered from the backup file
- **Backup files:** `backend/railway_backup.sql` (old data, 24 July) and `backend/aiven_backup.sql` (current)
