# S23. Settings: household, notifications, connected clients, tokens

> **Amended 25 Oct 2026:** the "Connected apps" and "Tokens" parts are superseded by one page, Account, Connected apps and
> access (`/account/connected-apps/`), in [auth-and-sign-in.md](../../mcp/auth-and-sign-in.md) section 14.6: a named access
> level per app instead of scope lists, add-ons for codes, people and removals, Revoke that also clears the consent at
> Neon, Pause all, a default level for new apps and an activity view. Built by MCP-U. The other sections here are unchanged.

**Status (R-60, Oct 2026):** this remains a future settings design, not a built screen. The current account foundation has email/password sign-in and private drafts; household setup, notifications, connected MCP clients, tokens, offline storage, export and deletion are not implemented. The OAuth provider and file-storage provider are not selected.

## Purpose
Everything personal in one place: household (S17), notification channels and quiet hours, connected
MCP clients and their scopes, personal access tokens (the fallback for clients without OAuth), the
email-forward address, offline storage, account export and delete.

## Entry points
You → Settings; S01 consent footer; Inbox "turn on push".

## Wireframes

```
┌ Settings ──────────────────────────────────────────────────────────────┐
│ [Household] [Notifications] [Connected apps] [Tokens] [Email in] [Data] │
│ ── Notifications ──                                                     │
│ Push on this device   [On]   (iPhone: works only from the Home Screen)  │
│ Email                 [On]   weekly digest in Book & Prepare [On]       │
│ Calendar feed         [Copy link]  [Regenerate]                         │
│ Quiet hours           22:00–07:00 (booking openings ring anyway [On])   │
│ Per trip              Dolomites: push+email · Algonquin: push           │
│ ── Connected apps ──                                                    │
│ Claude (claude.ai)   since 12 Oct · trips read/write · last used 2 h ago│
│                      [Change access] [Disconnect]                       │
│ ── Tokens ──                                                            │
│ "Claude Code laptop"  trips:write research:propose · expires 12 Jan     │
│ [New token]  (shown once; copy it now)                                  │
│ ── Email in ──  trips+k7q2@in.<domain> [Copy] [New address]             │
│ ── Data ──  Offline storage 212 MB [Manage] · Export all · Delete account│
└─────────────────────────────────────────────────────────────────────────┘
```

Phone: a list of sections, each opening its own screen.

## Regions and components
SettingsTabs · ToggleRow · ClientRow (name, scopes as sentences, last used, actions) · TokenRow ·
NewTokenSheet (name, scopes, expiry; token shown once with copy) · OfflineStorageList (per trip, size,
remove).

## Primary action
Per section (toggle, Disconnect, New token).

## States
Push unsupported → explanation and the email fallback. Token just created → "Copy it now; you won't
see it again." Disconnect → immediate revocation, client gets 401.

## Interactions
Disconnect asks once ("Claude will lose access to your trips"), with no undo (security), and an
easy reconnect path.

## Copy
Scopes always as sentences, same text as the consent screen.

## Accessibility
Toggles are switches with labels; token value has a copy button announced on success.

## Data and operations
`notification_pref`, `push_subscription`, `calendar_feed`, OAuth clients and tokens (OAuth provider
not selected), personal tokens table (hashed), email-in address; export job. These are proposed
surfaces, not current Neon account capabilities.

## Acceptance criteria
1. Revoking a client stops its next request.
2. A personal token is stored hashed and shown once.
3. Export produces every trip, reservation and household record the user owns.

## Share
"Share settings" is not offered; household members are invited from Household (S17).
