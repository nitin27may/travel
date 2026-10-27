#!/usr/bin/env bash
# CI guard (WORKFLOW-EFFICIENCY 4.6 D3, D4; task WF-2): the job environment may hold the decoy home point and nothing that points at
# production. Run as the first step of every job that executes repository code. It prints only variable NAMES, never values.
set -euo pipefail
fail=0
# The decoy of core/test/setup/home-point.ts: open ocean, not a place anyone lives.
if [[ "${HOME_POINT_LAT:-}" != "10.5" || "${HOME_POINT_LON:-}" != "-140.5" ]]; then
  echo "guard: only the decoy home point may be set in CI (HOME_POINT_LAT / HOME_POINT_LON)"; fail=1
fi
for v in DATABASE_URL TEST_DATABASE_URL NEON_API_KEY ORS_API_KEY RESEND_API_KEY GOOGLE_CLIENT_SECRET VERCEL_TOKEN GH_TOKEN GITHUB_TOKEN; do
  if [[ -n "${!v:-}" ]]; then echo "guard: $v must not be set in CI"; fail=1; fi
done
exit "$fail"
