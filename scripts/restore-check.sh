#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
RESTORE_DATABASE="asoudeh_restore_check"
RESTORE_URI="mongodb://127.0.0.1:27017/$RESTORE_DATABASE?directConnection=true"

for tool in mongorestore mongosh npm sha256sum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "$tool is required." >&2
    exit 127
  fi
done

mapfile -t archives < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'asoudeh-*.archive.gz' -print |
    sort -r
)
if ((${#archives[@]} == 0)); then
  echo "No backup archive found in $BACKUP_DIR." >&2
  exit 2
fi
archive="${archives[0]}"
checksum="$archive.sha256"
if [[ ! -f "$checksum" ]]; then
  echo "Checksum file is missing for $(basename "$archive")." >&2
  exit 2
fi
(
  cd "$(dirname "$archive")"
  sha256sum --check --status "$(basename "$checksum")"
) || {
  echo "Backup checksum verification failed." >&2
  exit 1
}

if ! mongosh "$RESTORE_URI" --quiet --eval "
  const targetDb = db.getSiblingDB('$RESTORE_DATABASE');
  if (targetDb.getCollectionNames().length !== 0) {
    print('Restore-check database is not empty.');
    quit(2);
  }
" >/dev/null 2>&1; then
  echo "Refusing to overwrite a non-empty local $RESTORE_DATABASE database." >&2
  exit 2
fi

cleanup() {
  status=$?
  trap - EXIT
  if ! mongosh "$RESTORE_URI" --quiet --eval "
    db.getSiblingDB('$RESTORE_DATABASE').dropDatabase();
  " >/dev/null 2>&1; then
    echo "Failed to drop local $RESTORE_DATABASE; remove it manually after inspection." >&2
    exit 1
  fi
  exit "$status"
}
trap cleanup EXIT

if ! mongorestore \
  --uri="$RESTORE_URI" \
  --gzip \
  --archive="$archive" \
  --nsInclude='asoudeh.*' \
  --nsFrom='asoudeh.*' \
  --nsTo="$RESTORE_DATABASE.*" \
  >/dev/null 2>&1; then
  echo "mongorestore failed; no remote target was contacted." >&2
  exit 1
fi

(
  cd backend
  NODE_ENV=test \
  MONGODB_URI="$RESTORE_URI" \
  RESTORE_CHECK_MONGODB_URI="$RESTORE_URI" \
  JWT_SECRET=restore-check-not-a-secret \
  AUTH_HASH_SECRET=restore-check-another-placeholder \
  CLIENT_URL=http://localhost:3000 \
  npm run db:restore-integrity
  NODE_ENV=test \
  MONGODB_URI="$RESTORE_URI" \
  JWT_SECRET=restore-check-not-a-secret \
  AUTH_HASH_SECRET=restore-check-another-placeholder \
  CLIENT_URL=http://localhost:3000 \
  npm run db:report-orphans
)
