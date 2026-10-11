# Backup and recovery

The store's data lives in two places:

1. **The PostgreSQL database:** products, orders, payments, customers, settings, pages and the audit log. Losing it means losing order history.
2. **Image storage:** product photos (public) and customers' reference images (private), in the S3/R2 buckets or in the local `storage` folder.

The code itself lives in Git, and the secrets live in your hosting provider's environment settings. **Keep a copy of your environment variables in a password manager.** You need them to rebuild the site.

## What to set up

| What | How often | How | Keep |
|---|---|---|---|
| Managed database backups | Continuous or daily | Turn on your provider's automatic backups and point-in-time restore (Neon, Supabase and most managed Postgres services offer this; check how many days your plan keeps) | As long as your plan allows; 7 days or more |
| Independent database dump | Daily (server) or weekly (managed) | `scripts/backup.sh`, copied **off-site** | 14–30 days |
| Object storage | Continuous | Turn on **bucket versioning** or replication (S3 supports versioning; for R2, check Cloudflare's current options or sync to a second bucket with `rclone`) | 30 days |
| Local `storage` folder (Docker with `STORAGE_DRIVER=local`) | Daily | Included in `scripts/backup.sh` | 14–30 days |
| Restore test | Every 3 months | See [Test your backups](#test-your-backups) | — |

## Making a backup

The script needs the PostgreSQL client tools, `pg_dump` and `pg_restore`, at version 16 or newer:
- Debian or Ubuntu: `apt install postgresql-client-16`
- macOS: `brew install libpq`

```bash
# Uses DATABASE_URL from .env or the environment (use the DIRECT url, not a pooler)
./scripts/backup.sh

# Docker Compose setup (dumps from the db container and archives the uploads volume)
./scripts/backup.sh --compose

# Options
BACKUP_DIR=/mnt/backups KEEP_DAYS=30 ./scripts/backup.sh
```

The script:
- writes `backups/db-<timestamp>.dump` (PostgreSQL custom format, compressed)
- checks that the dump file can be read back
- when using local storage, also archives the uploads to `backups/storage-<timestamp>.tgz`
- deletes backups older than `KEEP_DAYS`

Files are created readable only by their owner.

**Copy backups off the server.** A backup on the same machine as the database won't survive that machine failing. For example, sync the folder to a separate bucket or provider every night:

```bash
rclone sync ./backups remote-backups:souvenir-galore-backups
```

Backups contain customer names, addresses, phone numbers and order history. Keep them in a private, access-controlled location, and delete old copies as your privacy policy says.

## Restoring the database

> Restoring replaces data. Restore into a **new, empty database** first, check it, and only then point the app at it. Put the store in maintenance (or stop the app) while you switch over so no new orders are lost.

```bash
# 1. Create an empty database (or a new Neon branch or project)
createdb -h <host> -U <user> souvenir_restore

# 2. Restore the dump
pg_restore --no-owner --no-privileges --dbname "postgresql://<user>:<pass>@<host>:5432/souvenir_restore" backups/db-20250101-023000.dump

# 3. Check it
psql "postgresql://<user>:<pass>@<host>:5432/souvenir_restore" -c 'SELECT count(*) FROM "Order";'

# 4. Point DATABASE_URL (and MIGRATE_DATABASE_URL) at the restored database and redeploy or restart.
#    Any migrations newer than the backup are applied automatically on deploy.
```

**Docker Compose:**

```bash
docker compose stop app
docker compose exec -T db dropdb -U souvenir souvenir_galore
docker compose exec -T db createdb -U souvenir souvenir_galore
docker compose exec -T db pg_restore -U souvenir -d souvenir_galore --no-owner --no-privileges < backups/db-<timestamp>.dump
docker compose start app
```

**Restoring local images:**

```bash
docker compose stop app
docker compose run --rm -T --entrypoint sh app -c 'rm -rf /app/storage/* && tar -xzf - -C /app' < backups/storage-<timestamp>.tgz
docker compose start app
```

**Managed point-in-time restore:** for "undo the last hour" situations, such as an accidental bulk change, use your provider's point-in-time restore. It's usually done as a new branch or database restored to a timestamp. Then switch `DATABASE_URL` to it, as in step 4.

## Test your backups

A backup you've never restored is a hope, not a backup. Every three months:

1. Restore the latest dump into a scratch database, as above.
2. Run the app locally against it: `DATABASE_URL=<scratch> npm run dev`.
3. Check that recent orders, products and images are there.
4. Delete the scratch database.

The backup script itself was tested by backing up a PostgreSQL 16 database, restoring it into an empty database and comparing the rows.

## If something goes wrong

| Situation | What to do |
|---|---|
| A product or page was edited by mistake | Check **Dashboard → Activity log** to see who changed what and when. Fix it by hand, or restore one table from a dump with `pg_restore --data-only --table=...` into a scratch database and copy the rows back. |
| Data was deleted or corrupted | Point-in-time restore to just before the incident, into a new database, then switch over. |
| The database provider is unavailable | Restore the latest off-site dump to another Postgres provider and update `DATABASE_URL`. |
| The server is lost (Docker) | Provision a new server, clone the repository, restore `.env` from your password manager, run `docker compose up -d --build`, then restore the database and images as above. |
| A secret has leaked | See [SECURITY.md](SECURITY.md#if-a-secret-leaks). |
