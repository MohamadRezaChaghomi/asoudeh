# Deployment, Backup, and Recovery

## Deployment status

The repository includes Dockerfiles, `docker-compose.staging.yml`, and a Caddy reverse-proxy configuration. This is a staging scaffold, not evidence of a production deployment. Live SMS delivery, production index rollout, backup/restore drills, monitoring, and rollback have not been verified.

## Production environment requirements

| Variable | Requirement |
|---|---|
| `NODE_ENV` | `production` |
| `DOMAIN` | Public DNS name pointing to the Caddy host |
| `CLIENT_URL` | Exactly `https://$DOMAIN` |
| `NEXT_PUBLIC_API_URL` | `https://$DOMAIN/api/v1` |
| `MONGODB_URI` | Authenticated URI to `asoudeh` with the required replica-set configuration |
| MongoDB root credentials | Supplied through deployment secrets, never committed |
| `JWT_SECRET`, `AUTH_HASH_SECRET` | Separate high-entropy values, each at least 32 bytes |
| `OTP_DEV_SIMULATOR_ENABLED` | `false` |
| `SMSIR_MODE`, SMS.ir credentials | Production Verify configuration and approved template |
| `TRUST_PROXY_HOPS` | Exact trusted proxy count; `1` when Caddy is the only proxy |

Use the deployment secret manager or protected environment. URI-encode MongoDB credentials. Keep the frontend API URL public and free of credentials. See [Environment_and_Services.md](../02_API_and_Development/Environment_and_Services.md) for configuration boundaries.

## Release checklist

1. Review the release diff, CI results, dependency-audit output, and any migration/index changes.
2. Verify the replica set and persistent data volume, then create and verify a protected database backup.
3. Configure HTTPS, exact Origin/CORS values, secure cookies, secrets, trusted proxy hops, and provider-off/default settings as approved.
4. Review the read-only orphan report and duplicate checks. Roll out declared indexes separately with `npm --prefix backend run db:ensure-indexes`; confirm completion before relying on new constraints.
5. Confirm health/readiness, request-ID logging, deletion-worker health, and the agreed monitoring/alerting.
6. Smoke-test the public frontend, `GET /api/v1/health`, `GET /api/v1/health/ready`, and a protected request returning `401` without a session.
7. Test SMS only with an authorized account and a number under your control; provider acceptance is not handset-delivery evidence.

If checks fail, route traffic back to the previous application image and retain the database volume. Do not automatically roll back or drop indexes. Restore a backup only through an approved recovery procedure.

## Backup policy and handling

The documented **RPO 24 hours** (daily backup) and **RTO 4 hours** are targets, not guarantees. A pre-release backup is also recommended. Keep an encrypted off-site copy in access-controlled storage, retain encryption keys separately, and test retrieval. Archives include sensitive personal data such as phone numbers; never attach them to tickets or commit them.

Run `scripts/backup.sh` or `scripts/backup.ps1` with `BACKUP_MONGODB_URI` set in the process environment. The URI must select the `asoudeh` database and is not printed. `BACKUP_DIR` defaults to `backups`; `BACKUP_RETENTION_COUNT` defaults to `7`. Each compressed archive has a SHA-256 sidecar. Protect the backup directory like the database.

## Restore drill

1. Select the latest archive and verify its `.sha256` sidecar. Confirm MongoDB Database Tools and a local MongoDB instance are available.
2. Run `bash scripts/restore-check.sh`. It restores only to the fixed local `asoudeh_restore_check` database, refuses a non-empty target, reports collection counts, orphan inconsistencies, and missing schema indexes, and drops the temporary database on exit.
3. Review and record the report. If cleanup fails, inspect and drop only that local temporary database.
4. For an actual recovery, use an approved isolated host, preserve the original database, verify application compatibility and integrity, and switch traffic only after sign-off.

After any restore, identify accounts whose deletion completed after the backup timestamp and re-apply their purge before restored data is exposed. A backup can otherwise resurrect users and records that were subsequently deleted.

## Drill record

| Date/time (UTC) | Archive/checksum verified | Collections/orphans/indexes | Duration | Outcome/operator |
|---|---|---|---|---|
|  |  |  |  |  |

No production restore drill or deployment certification is recorded.
