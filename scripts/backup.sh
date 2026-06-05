#!/usr/bin/env bash
# Daily PostgreSQL backup → gzip → Cloudflare R2 (or any S3-compatible storage)
#
# Required environment variables:
#   DATABASE_URL     — PostgreSQL connection string
#   R2_ACCESS_KEY    — Cloudflare R2 (or AWS) access key ID
#   R2_SECRET_KEY    — Cloudflare R2 (or AWS) secret access key
#   R2_BUCKET        — bucket name (e.g. llm-observatory-backups)
#   R2_ACCOUNT_ID    — Cloudflare account ID (omit if using AWS S3)
#
# For AWS S3, remove the --endpoint-url flag below.
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="llm_observatory_${TIMESTAMP}.sql.gz"
TMPFILE="/tmp/${FILENAME}"

echo "→ Dumping database..."
pg_dump "$DATABASE_URL" | gzip > "$TMPFILE"
echo "  Size: $(du -sh "$TMPFILE" | cut -f1)"

echo "→ Uploading to s3://${R2_BUCKET}/backups/${FILENAME}..."
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_KEY" \
aws s3 cp "$TMPFILE" "s3://${R2_BUCKET}/backups/${FILENAME}" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

rm -f "$TMPFILE"
echo "✓ Backup complete: ${FILENAME}"
