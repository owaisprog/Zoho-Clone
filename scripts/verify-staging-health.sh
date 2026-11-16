#!/usr/bin/env bash
# P3.10 runbook check: explicitly requires an OWNER-APPROVED staging API URL.
set -euo pipefail
if [ -z "${STAGING_API_URL:-}" ]; then
  echo "STAGING_API_URL not set; actual staging has NOT been verified" >&2
  exit 2
fi
case "$STAGING_API_URL" in
  https://*) ;;
  *) echo "Only HTTPS staging endpoints are accepted" >&2; exit 2;;
esac
case "$STAGING_API_URL" in
  *"?"*|*"#"*|*"@"*) echo "URL must not contain query, fragment or credentials" >&2; exit 2;;
esac
base="${STAGING_API_URL%/}"
live_code="$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' "$base/health/live")"
if [ "$live_code" != 200 ]; then echo "Staging liveness failed ($live_code)" >&2; exit 1; fi
ready_code="$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' "$base/health/ready")"
if [ "$ready_code" != 200 ]; then echo "Staging dependency readiness failed ($ready_code); release blocked" >&2; exit 1; fi
echo "Staging health endpoint checks passed. This does NOT replace security/backup testing."
