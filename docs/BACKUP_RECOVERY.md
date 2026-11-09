# Backup and recovery

## Policy and sensitivity

Proposed targets: **RPO 24 hours** with daily backups and **RPO before each release** with a pre-release backup; **RTO 4 hours** for a reviewed restore. These are targets, not a guarantee. Keep an encrypted off-site copy in access-controlled storage, retain encryption keys separately, and test retrieval. Archives contain sensitive personal data, including phone numbers; encrypt at rest and in transit, restrict access, and never attach archives to tickets or commit them.

Run `scripts/backup.sh` or `scripts/backup.ps1` with `BACKUP_MONGODB_URI` set in the process environment. The URI must select the `asoudeh` database and is not printed. `BACKUP_DIR` defaults to `backups`; `BACKUP_RETENTION_COUNT` defaults to `7`. Each compressed archive has a SHA-256 sidecar. Protect the backup directory like the database.

## Restore drill

1. Select the latest archive and verify its `.sha256` file. Confirm MongoDB Database Tools and a local MongoDB instance are available.
2. Run `bash scripts/restore-check.sh`. It restores only to the fixed local `asoudeh_restore_check` database, refuses a non-empty target, reports collection counts, orphan inconsistencies, and missing schema indexes, and drops the temporary database on exit.
3. Review the report and record the result below. A failed cleanup requires manually inspecting and dropping only the local temporary database.
4. For an actual recovery, use an approved isolated recovery host, preserve the original database, verify application compatibility and integrity, then switch traffic only after sign-off.

After **any** restore, identify accounts whose deletion was completed after the backup timestamp and re-apply their purge before restored data is exposed. A backup can resurrect users and records that were subsequently deleted.

## Drill record

| Date/time (UTC) | Archive / checksum verified | Collections / orphans / indexes | Duration | Outcome / operator |
|---|---|---|---|---|
|  |  |  |  |  |
