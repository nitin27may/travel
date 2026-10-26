# Security policy

## Reporting a vulnerability

Please report security problems privately, through GitHub's private vulnerability reporting: open the repository's
**Security** tab and choose **Report a vulnerability**. Do not open a public issue, pull request or discussion for a
suspected vulnerability.

Include what you found, where (file, route or URL), how to reproduce it, and the impact you expect. You will get an
answer in the advisory thread; this is a one-person project, so allow a few days.

## Scope

- The code in this repository: `core/`, `web/` (including the `/api/v1/` route handlers) and `tools/`.
- The deployed site built from it.

Out of scope: the frozen legacy pages in `legacy/` (static HTML), third-party services the site calls (report those to
the service), and findings that need a compromised device or account of the reporter.

## Secrets

No credential belongs in this repository. Configuration and secrets live in environment variables (see the
"Environment variables" table in `docs/v2/build/public-site/README.md`). If you find something that looks like a live
secret, report it privately as above.
