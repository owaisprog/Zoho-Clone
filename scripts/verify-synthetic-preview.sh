#!/usr/bin/env bash
# P3.10: local CI smoke, NOT a real staging deployment.
set -euo pipefail
host="127.0.0.1"
port="${P3_SMOKE_PORT:-4177}"
case "$port" in *[!0-9]*|"") echo "Invalid P3_SMOKE_PORT" >&2; exit 2;; esac
if [ "$port" -lt 1024 ] || [ "$port" -gt 65535 ]; then echo "P3_SMOKE_PORT must be 1024..65535" >&2; exit 2; fi
HOST="$host" PORT="$port" node backend/dist/server.js > /tmp/zoho-p3-smoke.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; rm -f /tmp/zoho-p3-smoke.log' EXIT
alive=0
for attempt in $(seq 1 30); do
  if curl --silent --fail "http://$host:$port/health/live" > /tmp/zoho-p3-live.json; then alive=1; break; fi
  sleep 1
done
if [ "$alive" -ne 1 ]; then echo "Local P3 liveness failed" >&2; exit 1; fi
grep -q '"status":"alive"' /tmp/zoho-p3-live.json
ready_code="$(curl --silent --output /tmp/zoho-p3-ready.json --write-out '%{http_code}' "http://$host:$port/health/ready")"
if [ "$ready_code" != 503 ]; then echo "Unverified DB/IdP readiness must fail closed, got $ready_code" >&2; exit 1; fi
grep -q '"status":"not_ready"' /tmp/zoho-p3-ready.json
rm -f /tmp/zoho-p3-live.json /tmp/zoho-p3-ready.json
echo "PASS: local synthetic liveness 200, dependency readiness 503 (fail closed)"
