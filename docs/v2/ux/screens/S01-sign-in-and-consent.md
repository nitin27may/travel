# S01. Sign in, sign up and MCP consent

## Purpose
Get a person into their household with the least friction (magic link or Google), and let a chat
client (Claude, ChatGPT, any MCP client) act on their trips only after a consent screen that says
plainly what it can and cannot do. Auth is Managed Better Auth on Neon (R-60, Oct 2026); the
self-hosted Supabase Auth plan in [../../08-self-hosted.md](../../08-self-hosted.md) is historical.

**Status.** Built today, behind the sign-in capability flag: email/password sign-in (`/sign-in/`)
and sign-up (`/sign-up/`) forms that lead to `/account/` (private drafts), plus sign-out. Everything else on this screen is planned and not built:
the magic link and code fallback, Google, invite landing, household creation on first sign-in, the
signed-out draft import, and the MCP OAuth consent screen. The wireframes below are the target
design, not the shipped one.

## Entry points
- "Sign in" in the top bar; "Sign in to keep this" on a signed-out draft trip.
- An invite email ("Priya invited you to Dolomites 2027") → sign in → straight into that trip.
- An MCP client's OAuth redirect → sign in if needed → consent.

## Wireframes

Desktop and phone share one centred card (max 420 px):

```
┌──────────────────────────────────────┐
│  [logo]  Sign in                      │
│                                      │
│  Email                               │
│  [ nitin@…                       ]    │
│  [ Email me a sign-in link       ]    │  ← primary
│                                      │
│  ───────────── or ─────────────       │
│  [ G  Continue with Google       ]    │
│                                      │
│  New here? The same button creates   │
│  your account.                       │
└──────────────────────────────────────┘

after sending:
┌──────────────────────────────────────┐
│  Check your email                    │
│  We sent a link to nitin@…. It works │
│  for 1 hour, on this device or any.  │
│  [ Open Gmail ]  [ Use a code instead]│
│  Wrong address? Change it            │
└──────────────────────────────────────┘
```

MCP consent (after sign-in):

```
┌──────────────────────────────────────────────┐
│  Claude wants to use your Travel account      │
│                                              │
│  It will be able to:                         │
│   ✓ Search places, trails and guides         │
│   ✓ Read and change your trips               │
│   ✓ Add reservations you paste or describe   │
│   ✓ Propose research (you review it first)   │  ← only if scope requested
│                                              │
│  It will not be able to:                     │
│   ✗ See passport dates, heights or tickets   │
│   ✗ See confirmation codes  [allow ▢]        │  ← reservations:read, off by default
│   ✗ Change your account or household         │
│                                              │
│  Trips it can use: (•) all  ( ) only these ▾ │
│  [ Allow ]          [ Cancel ]               │
│  You can disconnect it any time in Settings. │
└──────────────────────────────────────────────┘
```

## Regions and components
Card · EmailField · PrimaryButton · ProviderButton · ConsentScopeList (each scope a row with icon and
plain sentence) · TripScopePicker · Toast.

## Primary action
"Email me a sign-in link"; on consent, "Allow".

## States
- **Loading**: button shows a spinner and stays the same width; no layout jump.
- **Error**: "That email doesn't look right" inline; "We couldn't send the email. Try again or use
  Google." on SMTP failure (self-hosted SMTP is a real failure mode).
- **Expired link**: "This link has expired. Send a new one." with the email pre-filled.
- **Offline**: "You're offline. Sign-in needs a connection." The local draft stays untouched.
- **Signed-out draft present**: after sign-in, "Keep 'Weekend at Elora Gorge' in your account?" (Keep / Discard).
- **Invite for another email**: "This invite was sent to priya@…. Sign in with that address, or ask
  for a new invite."
- **Consent with unknown client**: a warning line "This client isn't verified. Only allow it if you
  set it up yourself."

## Interactions
Enter submits; the code fallback (6 digits) for when the link opens on another device; Google opens
in the same tab on phone, popup on desktop.

## Copy
Buttons are verbs. Never "Authenticate" or "Authorize application"; use "Allow Claude to…".

## Accessibility
Labels on every field; error text tied with `aria-describedby`; the scope list is a real list;
consent buttons have equal visual weight so "Cancel" is not hidden.

## Data and operations
Managed Better Auth: email and password (built); magic link, OTP and Google (planned). Planned: an
`app_user` row on first sign-in; household created on first sign-in ("Your household" with the user
as owner); an OAuth 2.1 authorize endpoint for MCP clients with scopes
`catalog:read trips:read trips:write reservations:read research:propose review`; a personal access
token fallback is S23.

## Acceptance criteria
1. A new user reaches an empty Trips screen in under 30 s from typing their email.
2. An invitee lands inside the invited trip after sign-in, with no extra clicks.
3. The consent screen lists exactly the requested scopes; `reservations:read` is unticked by default.
4. Denying consent returns the client an OAuth error and creates nothing.
5. Works with JavaScript-light conditions (the magic link page renders server-side).
