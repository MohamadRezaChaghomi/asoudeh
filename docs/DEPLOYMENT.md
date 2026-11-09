# Deployment

## Required production environment

| Variable | Requirement |
|---|---|
| `NODE_ENV` | `production` |
| `DOMAIN` | Public DNS name pointing to the Caddy host |
| `CLIENT_URL` | `https://$DOMAIN` exactly |
| `NEXT_PUBLIC_API_URL` | `https://$DOMAIN/api/v1` |
| `MONGODB_URI` | Authenticated URI to the `asoudeh` database with `replicaSet=rs0` |
| `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` | Staging MongoDB root account |
| `JWT_SECRET`, `AUTH_HASH_SECRET` | Separate random values, each at least 32 bytes |
| `OTP_DEV_SIMULATOR_ENABLED` | `false` |
| `SMSIR_MODE`, `SMSIR_API_KEY`, `SMSIR_VERIFY_TEMPLATE_ID` | `production` and valid SMS.ir Verify credentials |
| `TRUST_PROXY_HOPS` | `1` when Caddy is the only proxy |

Supply values through the deployment environment, never a committed file. Mongo credentials embedded in `MONGODB_URI` must be URI-encoded.

## Release checklist

- Review CI, dependency-audit output, migration/index changes, and the release diff.
- Back up the database; verify the replica set is healthy and its data volume persists.
- Deploy with the production variables above; do not enable the OTP simulator.
- Confirm HTTPS, cookie `Secure` flags, CORS origin, request-ID logs, and deletion-worker health.
- Roll out indexes separately: review the read-only orphan report and duplicate checks, then run `npm --prefix backend run db:ensure-indexes` against the intended database. Confirm index completion before relying on new constraints.

## Smoke test and rollback

Check `GET /api/v1/health`, `GET /api/v1/health/ready`, the public frontend, and a protected request returning `401` without a session. Use an approved test account and handset for OTP verification only when SMS delivery has been authorized.

If checks fail, route traffic back to the previous application image and retain the database volume. Do not roll back or drop indexes automatically; restore a database backup only through the approved recovery procedure.
