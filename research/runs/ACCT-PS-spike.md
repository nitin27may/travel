# ACCT-PS: server-side `updateUser({ name })` on the Neon child branch

Run id: `ACCT-PS-spike` - 27 Oct 2026 - model Sonnet 5.5 (`claude-sonnet-5-5`) - spec
[account-profile-and-travellers.md](../../docs/v2/features/account-profile-and-travellers.md) 4.3.

**Verdict: works. No guarded proxy entry needed; `update-user` stays 404 in the browser proxy.**

Scope: project `damp-queen-64719841`, child branch `br-damp-breeze-b41mtvn5` only (Neon Auth base URL from
`neon neon-auth status`, which is not a secret). Production never touched; root `.env.local` not read. Cookie secret was
a random value in a mode-600 scratchpad file. `next dev -p 3199` from the worktree with `NEON_AUTH_BASE_URL`,
`NEON_AUTH_COOKIE_SECRET`, `NEXT_PUBLIC_SIGN_IN=1` and a throwaway route handler that called
`getAuth().updateUser({ name })` then `getAuth().getSession()` (deleted, not committed). Synthetic users
`acctps+<epoch>@travel-e2e.invalid` were signed up at the Neon Auth URL (Require Verification is off on the child) and
signed in through the app proxy; both deleted at the end (`neon_auth.user` count 0).

| Step | Result |
|---|---|
| Sign in through proxy | 200; sets `session_token` (7 d) and `local.session_data` (299 s) |
| `POST /api/auth/update-user/` via proxy, signed in | 404 |
| Server `updateUser({ name: 'Renamed By Server' })` | `{ data: { status: true }, error: null }`, 163 ms |
| `getSession()` in the same request | old name (cached session_data cookie) |
| Response cookies | new `local.session_data` (299 s) and `session_token` set |
| Next request with the updated jar | new name |
| Next request with only the original sign-in cookies | old name (cache, up to 299 s) |
| Request with `session_token` only (cache miss, upstream) | new name; Neon `get-session` also new |

Consequences for the build: the action returns the validated name instead of re-reading the session; the header catches
up on the next request of the same browser, other devices within 5 minutes. Pinned by
`web/tests/auth/update-user-shape.test.ts` (mocked SDK, exactly `{ name }`).
