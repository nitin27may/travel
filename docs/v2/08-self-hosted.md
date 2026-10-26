# 08. Self-hosted Supabase on the home server (decided 17 Oct 2026; historical, superseded 24 Oct 2026)

> **Superseded (owner, 24 Oct 2026).** The database, auth and realtime now run on **Neon** (Postgres, Managed Better
> Auth, Realtime), selected and provisioned; see [NEON-SETUP.md](build/public-site/NEON-SETUP.md) and the banner in
> [04-stack.md](04-stack.md). Nothing in this file is deployed: no home server, Supabase stack, Studio, tunnel, worker
> container or backup job exists. It is kept as the decision record. Its **requirements still apply** to whatever is
> chosen next: offline Today mode, ICS alarms as a reminder backstop, rotated secrets with no service key in a browser,
> no admin console exposed publicly, offsite backups with a monthly restore test, pinned upgrades, uptime alerts, and a
> documented way out. Hosting, object storage, functions and the worker runtime are **not selected**; do not read the
> Supabase, Docker or Cloudflare Tunnel answers below as current. (Last verified 25 Oct 2026 against main 4230210:
> hosting is now Vercel, project `travel`, R-61; object storage, functions and the worker are still not selected. MCP
> over a tunnel, section 5, is replaced by [mcp/auth-and-sign-in.md](mcp/auth-and-sign-in.md).)

**Decision (historical):** run the whole platform on the owner's Ubuntu machine with Docker: self-hosted Supabase
(Postgres + PostGIS, Auth, Realtime, Storage, Studio) plus our own containers. Audience: the family.
This replaces Neon, Better Auth, R2, the Cloudflare trip rooms and Vercel from 04-stack.md section 1.7;
everything else in 04 stands. Section 1.8a's objections (a second vendor beside Neon, an auth bridge,
free-plan pausing) do not apply when Supabase is the only backend and it runs on your own box.

**Owner, 17 Oct 2026:** the home server has room for the Supabase stack, so the sizing risk below is
not a concern. A Supabase Cloud free or trial account is also acceptable; the plan stays the same
either way, since only the connection settings differ.

## 1. What changes from the earlier plan

| Concern | Was | Now | Why it is better here |
|---|---|---|---|
| Database | Neon | **Supabase Postgres** (PostGIS, pg_trgm, pgvector, pg_cron are in the image) | always on, no compute-hour budget, no pause |
| Auth | Better Auth | **Supabase Auth** (email magic link, Google, MFA); users managed in Studio | comes in the box; RLS uses `auth.uid()`; Realtime authorisation works natively |
| Live co-editing | Cloudflare Durable Object per trip | **Supabase Realtime**: Broadcast for committed operations, Presence for who is editing what (section 4) | no extra platform |
| Files | Cloudflare R2 | **Supabase Storage** (signed URLs for tickets) + offsite backup | in the box |
| Reminders | Cloudflare cron + KV trick | a **worker container** polling due reminders every 30 s | the database never sleeps, so the KV trick is unnecessary |
| App hosting | Vercel Hobby | **Next.js in a container on the same machine** | SSR next to the database instead of every query crossing the internet to your house |
| Public access | Vercel / Cloudflare URLs | **Cloudflare Tunnel** (free) to `app.<domain>` | phones on a trip and Claude's MCP connector must reach it; no ports opened on the home router |
| MCP auth | Better Auth MCP plugin | **Supabase Auth's OAuth 2.1 server** (verify on self-hosted in M0; section 5) | same users, same RLS |

Unchanged: the operation layer is the only writer (the browser uses supabase-js for sign-in, Realtime
and uploads, never for direct table writes), the domain model, the MCP tools, the UX, Next.js, Hono
inside a Next route for `/api` and `/mcp`.

## 2. Stress test: what can go wrong with a server at home

| Risk | When it bites | Mitigation |
|---|---|---|
| **Home internet or power goes down while you are travelling** | the exact moment the app matters most | Today mode reads from the phone's offline copy (planned anyway; download before leaving is a Prepare task); edits queue and sync later. Reminders for the trip are **also written into the trip's ICS feed** as events with alarms, which live in your phone's calendar once synced. A UPS for the box and router covers short cuts. An uptime check (Healthchecks.io or UptimeRobot, free) alerts your phone when the box disappears |
| **Default secrets** | the self-hosting compose ships example JWT secret, anon and service keys and dashboard password | generate new ones before first start (checklist in section 6); the service key never leaves the server |
| **Studio exposed to the internet** | Studio is an admin console for everything | never route it through the tunnel publicly; LAN only, or behind Cloudflare Access (free for small teams) |
| **No managed backups** | disk failure, a bad migration, ransomware | nightly `pg_dump` of the database (including the `auth` and `storage` schemas) and a copy of the storage volume to an offsite bucket (Backblaze B2 or Cloudflare R2 free tier, or Google Drive via rclone); **a monthly restore test** into a scratch container |
| **Upgrades** | Supabase images move fast; a blind `pull` can break | pin image tags in compose; update monthly with a backup first; read the self-hosting changelog |
| **Resources** | official minimum 4 GB RAM, 2 cores, 40-50 GB SSD; 8 GB and 4 cores recommended | drop services we do not use (edge runtime, imgproxy; analytics/logs are already optional) |
| **One machine** | it is a single point of failure | acceptable for family use; the move to Supabase Cloud or a VPS is the same compose file or a documented dump-and-restore (section 7) |

## 3. Containers

```
ubuntu box (docker compose)
├─ supabase: db (Postgres + PostGIS), auth, rest, realtime, storage, studio, meta, gateway, pooler
├─ web       Next.js 16 standalone build: pages + Hono /api + /mcp; talks to db through the pooler
├─ worker    Node: reminders (every 30 s), staleness and coverage (nightly), digests, email import
├─ backup    nightly pg_dump + storage sync to offsite (rclone), keeps 14 daily + 8 weekly
└─ cloudflared   Cloudflare Tunnel: app.<domain> → web, (optional) api.<domain>; Studio not routed
```

Email out through Resend or any SMTP relay (Supabase Auth's magic links need SMTP configured too).
Web Push signed by the worker with VAPID keys.

## 4. Live co-editing with Supabase Realtime

1. A client sends an operation to `/api/ops/...`; the op layer commits it with the caller's JWT, so
   RLS applies.
2. In the same transaction it inserts `op_event`; a trigger calls `realtime.send(...)` (or
   `realtime.broadcast_changes`) with the operation and the new trip version on the private topic
   `trip:<id>`.
3. Clients subscribed to `trip:<id>` (private channel, `setAuth` with their session) apply the
   operation with the shared op reducer; a gap in versions triggers "ops since version N".
4. Presence on the same channel shows who has the trip open and which item each person is editing.
5. Authorisation: an RLS policy on `realtime.messages` lets a user join `trip:<id>` only if they are
   a `trip_member` of that trip.

Postgres Changes (row-level change feeds) are not used for trips: they send raw rows, not intent, and
are checked per subscriber. They are fine for small admin screens (the review queue updating live).

## 5. MCP over the tunnel

Claude's remote connectors call our `/mcp` over the public internet, so the tunnel is required for
the MCP. Auth plan, to be proven in M0 before anything depends on it:
1. **Supabase Auth's OAuth 2.1 server** (with dynamic client registration on, consent screen ours).
   Documented for Supabase Cloud; its availability and maturity in the self-hosted auth image must be
   checked against the image version we pin.
2. Fallback for the owner's own clients: **personal access tokens** created in Settings and sent as a
   header (works for Claude Code and other clients that accept custom headers), scoped like OAuth
   tokens. This is enough for family use while (1) matures.

## 6. First-start checklist

1. Ubuntu LTS, Docker Engine + compose plugin; a disk with 50 GB free; ideally a UPS.
2. Clone the Supabase self-hosting `docker` folder at a pinned release; copy `.env.example`.
3. Generate a new JWT secret, anon key, service-role key, Postgres password, dashboard user and
   password; set `SITE_URL` and `API_EXTERNAL_URL` to `https://app.<domain>`; configure SMTP.
4. Remove services not needed; pin every image tag.
5. Add our containers (`web`, `worker`, `backup`, `cloudflared`) in an override file.
6. Apply our migrations (`schema.sql` → Drizzle migrations) with PostGIS, pg_trgm, unaccent, ltree.
7. Create the tunnel and DNS for `app.<domain>`; Studio stays on the LAN.
8. Run the backup once and restore it into a scratch container before trusting it.
9. Uptime check on `https://app.<domain>/health` to your phone.

## 7. The way out (kept open on purpose)

- **To Supabase Cloud**: dump and restore the database (with `auth` and `storage`), copy storage
  objects, change two environment variables. Same code.
- **To a VPS** (when trips depend on it while you are away): copy the compose folder and the volumes
  to a small VPS; 8 GB machines cost roughly €8-15 a month at budget hosts.
- **Off Supabase entirely**: the domain, ops and schema are plain Postgres; only auth (`auth.users`,
  `auth.uid()` in policies) and Realtime would need replacing. That is the lock-in we accept.

## 8. Effect on the milestones

M0 now means: the compose stack running at home with secrets, tunnel, backups and a restore test;
Supabase Auth sign-in; the OAuth 2.1 spike for MCP (or the token fallback); the op layer running as the
caller under RLS. M2's live co-editing uses section 4. M3's reminders run in the worker. Everything
else in 05-roadmap.md is unchanged.
