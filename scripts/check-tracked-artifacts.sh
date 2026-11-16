#!/usr/bin/env bash
# P3.07/P3.09: inspect tracked file paths, not customer data contents.
set -euo pipefail
tracked="$(git ls-files)"
if printf '%s\n' "$tracked" | grep -E '(^|/)\.env($|\.(local|development|production|staging)$)' >/dev/null; then
  echo "FAIL: real environment files are tracked" >&2
  exit 1
fi
if printf '%s\n' "$tracked" | grep -E '(^|/)(node_modules|\.next|dist|coverage)/' >/dev/null; then
  echo "FAIL: generated artifacts are tracked" >&2
  exit 1
fi
echo "PASS: tracked path safety checks (not a substitute for secret scanning)"
