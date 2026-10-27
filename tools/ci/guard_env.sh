#!/usr/bin/env bash
# CI guard (WORKFLOW-EFFICIENCY 4.6 D3, D4; task WF-2): the job environment may hold the decoy home point and nothing that points at
# production. Run as the first step of every job that executes repository code. It prints only variable NAMES, never values.
# The decoy is read from core/test/setup/home-point.ts, the one place it is defined (check.yml's env must repeat it; this checks that).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
decoy="$(sed -n 's/.*DECOY_HOME_POINT = { lat: \(-\{0,1\}[0-9.]*\), lon: \(-\{0,1\}[0-9.]*\) }.*/\1 \2/p' "$here/core/test/setup/home-point.ts" | head -1)"
[[ -n "$decoy" ]] || { echo "guard: cannot read the decoy from core/test/setup/home-point.ts"; exit 1; }
fail=0
if [[ "${HOME_POINT_LAT:-} ${HOME_POINT_LON:-}" != "$decoy" ]]; then
  echo "guard: only the decoy home point may be set in CI (HOME_POINT_LAT / HOME_POINT_LON)"; fail=1
fi
for v in DATABASE_URL TEST_DATABASE_URL NEON_API_KEY ORS_API_KEY RESEND_API_KEY GOOGLE_CLIENT_SECRET VERCEL_TOKEN GH_TOKEN GITHUB_TOKEN; do
  if [[ -n "${!v:-}" ]]; then echo "guard: $v must not be set in CI"; fail=1; fi
done
# The one database a job may name is the throwaway container of tools/ci/db_up.sh: loopback, port 54329, the CI owner role and a
# password that starts "ci-" (a plain workflow value, not a secret). Anything else, a Neon host above all, fails the job.
if [[ -n "${LOCAL_DATABASE_URL:-}" ]] && ! [[ "$LOCAL_DATABASE_URL" =~ ^postgres://neondb_owner:ci-[A-Za-z0-9-]+@127\.0\.0\.1:54329/neondb$ ]]; then
  echo "guard: LOCAL_DATABASE_URL may only name the throwaway CI container on 127.0.0.1:54329"; fail=1
fi
exit "$fail"
