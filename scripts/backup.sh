#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BACKUP_MONGODB_URI:-}" ]]; then
  echo "BACKUP_MONGODB_URI is required." >&2
  exit 2
fi

if [[ -z "${BACKUP_RETENTION_COUNT:-7}" || ! "${BACKUP_RETENTION_COUNT:-7}" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_RETENTION_COUNT must be a positive integer." >&2
  exit 2
fi

if [[ -z "${BACKUP_DIR:-}" ]]; then
  BACKUP_DIR="backups"
fi

if ! command -v mongodump >/dev/null 2>&1; then
  echo "mongodump is required (MongoDB Database Tools)." >&2
  exit 127
fi

if ! node -e '
  const uri = new URL(process.env.BACKUP_MONGODB_URI);
  if (decodeURIComponent(uri.pathname.replace(/^\/+/, "")) !== "asoudeh") process.exit(1);
' >/dev/null 2>&1; then
  echo "BACKUP_MONGODB_URI must select the asoudeh database." >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"
backup_dir="$(cd "$BACKUP_DIR" && pwd)"
timestamp="$(node -e 'process.stdout.write(new Date().toISOString().replace(/[-:]/g, "").replace(/\.(\d{3})/, "$1"))')"
archive="$backup_dir/asoudeh-$timestamp.archive.gz"
temporary="$archive.partial"

cleanup_partial() {
  rm -f -- "$temporary"
}
trap cleanup_partial EXIT

if ! mongodump --uri="$BACKUP_MONGODB_URI" --gzip --archive="$temporary" >/dev/null 2>&1; then
  echo "mongodump failed; command output suppressed to protect connection details." >&2
  exit 1
fi
mv -- "$temporary" "$archive"
(
  cd "$backup_dir"
  sha256sum "$(basename "$archive")" >"$(basename "$archive").sha256"
)
trap - EXIT
echo "Backup created: $(basename "$archive")"

while IFS= read -r old_archive; do
  [[ -n "$old_archive" ]] || continue
  rm -f -- "$old_archive" "$old_archive.sha256"
done < <(
  find "$backup_dir" -maxdepth 1 -type f -name 'asoudeh-*.archive.gz' -print |
    sort -r |
    tail -n "+$((BACKUP_RETENTION_COUNT + 1))"
)
