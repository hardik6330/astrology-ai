# Database Backup & Restore

Simple guide: how to save a copy of the database, and how to load it into a new one.

The database is **Railway MySQL**.

---

## Before you start

You need 5 things from the Railway console (open the MySQL service → *Variables*
or *Connect*):

| What | Value looks like |
|---|---|
| Host | `something.proxy.rlwy.net` |
| Port | a random number |
| User | `root` |
| Password | (copy from the console) |
| Database name | `railway` |

The password goes in front of the command as `MYSQL_PWD='...'`. This keeps it out
of your command history.

---

## Backup (save a copy)

```bash
MYSQL_PWD='your-password' mysqldump \
  -h your-host.proxy.rlwy.net -P your-port -u root \
  --single-transaction --routines --triggers \
  railway > backend/railway_backup.sql
```

You now have a `.sql` file. **That file is your backup.** Copy it somewhere safe
(Google Drive, another computer) — it is not saved to Git, so if you lose the
machine you lose the backup.

> Railway's public host goes over the internet. If you connect with TLS, add
> `--ssl` to the command.

---

## Restore (load the copy into a database)

Same command, but `mysql` instead of `mysqldump`, and `<` instead of `>`.

```bash
MYSQL_PWD='your-password' mysql \
  -h your-host.proxy.rlwy.net -P your-port -u root \
  railway < backend/railway_backup.sql
```

The dumps have no `CREATE DATABASE` / `USE` line, so they import into whichever
database you name on the command line.

### Importing an older dump

`backend/aiven_backup.sql` is a plain MySQL dump of the previous host and imports
into Railway with the exact command above — just point it at that file instead.
**Keep it.** Until Railway holds a verified copy of that data, it is the only
copy of it that exists.

---

## Check that it worked

Count the rows:

```bash
MYSQL_PWD='your-password' mysql \
  -h your-host.proxy.rlwy.net -P your-port -u root railway -e "
SELECT (SELECT COUNT(*) FROM Users) users,
       (SELECT COUNT(*) FROM Settings) settings,
       (SELECT COUNT(*) FROM CreditTransactions) ledger;"
```

If the numbers look right, the import worked.

Then apply any pending schema migrations and check the app can connect:

```bash
cd backend && npm run migrate:status   # what's pending
cd backend && npm run migrate          # apply it
cd backend && npm run dev
```

If it starts without a database error, you're done.

---

## After moving to a new database

1. Open `backend/.env` and update these:
   ```
   DB_HOST=...
   DB_PORT=...
   DB_USER=root
   DB_PASS=...
   DB_NAME=railway
   DB_SSL=true      # only if you connect over TLS
   ```

2. **Don't forget the live server.** The website uses a *different* `.env` file
   that lives on the server (`shared/.env`), not in this project. Update it over
   SSH and restart with `pm2 reload astrology-backend` — otherwise the live site
   keeps using the old database.

3. On a brand-new empty database, build the schema once before the first deploy:
   ```bash
   cd backend && npm run sync-schema
   ```
   After that, schema changes are migrations only (`npm run migrate`).

---

## If something goes wrong

| Error you see | What it means |
|---|---|
| `Can't connect ... (111)` | The database isn't running yet. A new Railway service takes a minute or two to start — check the console says **Active**. |
| `Lost connection ... initial communication packet` | The database is switched off or deleted. Check the Railway console before blaming your password. |
| `Access denied` | Wrong user or password. Railway uses `root`. |
| `Unknown database 'railway'` | The database name differs — check `MYSQL_DATABASE` in the service variables. |
| `Unknown column ...` | The schema is behind the code. Run `npm run migrate`. |
| `SSL connection error` | Either drop `--ssl`, or set `DB_SSL=true` consistently on both sides. |
| App closes as soon as it starts | It can't reach the database. In production the server exits on an unreachable DB by design. Fix the connection details, not the app. |

---

## Backup files in `backend/`

Both are gitignored (`*.sql`) because they contain real user data. They are the
only backups — keep copies off this machine.

- `railway_backup.sql` — Railway dump
- `aiven_backup.sql` — dump from the previous host; the source to import from
