# DB Backup Runbook

Daily automated `pg_dump` of the local `ketpet` Postgres → Cloudflare R2.
Created 2026-04-27 in response to the Docker Desktop wipe that destroyed the
local volume and forced a full re-seed (~$6 in DeepSeek calls + ~90 min).

## What runs, when, where

| Item | Value |
|---|---|
| Source | `docker exec ketpet-postgres pg_dump -U postgres -d ketpet --clean --if-exists` |
| Compression | `gzip` (~5x ratio; current dump 1.8 MB → 0.4 MB gz) |
| Destination | R2 bucket `cambridge-ket-pet-audio`, prefix `db-backups/` |
| Trigger | Windows Scheduled Task `ketpet-db-backup-daily`, daily 03:00 local (Asia/Shanghai) |
| Runner | `C:\Program Files\Git\bin\bash.exe -c '... apps/web/scripts/backup-db-to-r2.ts ...'` |
| Logs | `C:\Users\wul82\Desktop\cambridge-ket-pet\.backup.log` (appended; rotate manually if it grows) |

## Retention policy

Computed in `apps/web/scripts/backup-db-to-r2.ts` (`computeKeysToDelete`):

| Tier | R2 key pattern | Cadence | Keep |
|---|---|---|---|
| daily | `db-backups/daily/<YYYY-MM-DD>.sql.gz` | every run | last 7 |
| weekly | `db-backups/weekly/<YYYY-WW>.sql.gz` | only when run on Sunday (UTC) | last 4 |
| monthly | `db-backups/monthly/<YYYY-MM>.sql.gz` | only when run on the 1st (UTC) | last 12 |

Older objects are batch-deleted at the end of each run. Total cap: ≤23 objects in `db-backups/`.

## List backups in R2

```bash
cd apps/web
./node_modules/.bin/tsx -e '
  const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
  require("dotenv").config();
  const c = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
  c.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: "db-backups/" }))
    .then(r => (r.Contents ?? []).forEach(o => console.log(o.LastModified.toISOString(), o.Size, o.Key)));
'
```

## Restore a backup

1. **Pick the dump key** (from list above), e.g. `db-backups/daily/2026-04-27.sql.gz`.
2. **Download** to a local file:

   ```bash
   cd apps/web
   ./node_modules/.bin/tsx -e '
     const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
     const fs = require("node:fs");
     require("dotenv").config();
     const c = new S3Client({
       region: "auto",
       endpoint: process.env.R2_ENDPOINT,
       credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
     });
     const key = process.argv[1];
     c.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
       .then(async r => {
         const buf = Buffer.from(await r.Body.transformToByteArray());
         fs.writeFileSync("/tmp/restore.sql.gz", buf);
         console.log("downloaded", buf.length, "bytes -> /tmp/restore.sql.gz");
       });
   ' db-backups/daily/2026-04-27.sql.gz
   ```

3. **Restore into a fresh database** (NEVER restore over the live one without taking a fresh dump first):

   ```bash
   docker exec ketpet-postgres createdb -U postgres ketpet_restored
   gunzip -c /tmp/restore.sql.gz | docker exec -i ketpet-postgres psql -U postgres -d ketpet_restored
   docker exec ketpet-postgres psql -U postgres -d ketpet_restored \
     -c 'SELECT (SELECT COUNT(*) FROM "Word") AS words, (SELECT COUNT(*) FROM "GrammarQuestion") AS qs;'
   ```

4. **Promote `ketpet_restored` → `ketpet`** (after verifying counts):

   ```bash
   docker exec ketpet-postgres psql -U postgres -c 'ALTER DATABASE ketpet RENAME TO ketpet_old;'
   docker exec ketpet-postgres psql -U postgres -c 'ALTER DATABASE ketpet_restored RENAME TO ketpet;'
   # Drop ketpet_old once verified the app works against the restored DB.
   ```

## Disable / re-enable / inspect the task

```powershell
# Status + next run time
Get-ScheduledTaskInfo -TaskName ketpet-db-backup-daily

# Disable (stop running daily — keeps definition)
Disable-ScheduledTask -TaskName ketpet-db-backup-daily

# Re-enable
Enable-ScheduledTask -TaskName ketpet-db-backup-daily

# Run now (out of schedule, useful after restore or for manual smoke test)
Start-ScheduledTask -TaskName ketpet-db-backup-daily

# Remove entirely
Unregister-ScheduledTask -TaskName ketpet-db-backup-daily -Confirm:$false

# Re-install (idempotent)
powershell -ExecutionPolicy Bypass -File scripts/schedule-daily-backup.ps1
```

## Monitoring

Daily check (or after a Docker / Windows reboot):

```powershell
Get-ScheduledTaskInfo -TaskName ketpet-db-backup-daily |
  Select-Object LastRunTime, LastTaskResult, NextRunTime
```

`LastTaskResult` should be `0` (success). Anything else: tail the log.

```bash
tail -50 /c/Users/wul82/Desktop/cambridge-ket-pet/.backup.log
```

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `LastTaskResult != 0` and log says `pg_dump exit 1` | Postgres container down | `docker compose up -d postgres` |
| Log says `R2_ENDPOINT missing` | `apps/web/.env` not readable by the bash subprocess | Verify `.env` exists; check file permissions |
| `LastTaskResult = 0x1` repeatedly with no log | Bash path wrong (Git for Windows reinstalled to different path) | Edit `scripts/schedule-daily-backup.ps1`, update `-Execute` path, re-run installer |
| Daily backup missing one day | Laptop was off at 3 AM | Task setting `StartWhenAvailable` triggers it on next boot — should self-heal |

## Cost

R2: storage ≤ 10 MB total at full retention (23 dumps × ~400 KB each). Below
free-tier (10 GB). Egress only when restoring, also free for occasional use.
Effective monthly cost: **$0**.

## Related files

- `apps/web/scripts/backup-db-to-r2.ts` — the backup runner
- `apps/web/scripts/test/backup-db-to-r2.test.ts` — retention rotation unit tests
- `scripts/schedule-daily-backup.ps1` — Windows Task Scheduler installer
- `docs/superpowers/plans/2026-04-27-db-recovery-from-r2-and-deepseek.md` — Phase 8 (this runbook is the deliverable)
