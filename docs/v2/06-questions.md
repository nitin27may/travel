# 06. Decisions and questions for the owner

**Revised 17 Oct 2026: Q1 = self-hosted Supabase on the home server (Docker on Ubuntu), Supabase
Auth and Realtime, Next.js in a container, Cloudflare Tunnel; see 08-self-hosted.md.** Earlier the
same day: Q1 = C (Neon + Better Auth); Q10 = family first, public later; Q12 = live
co-editing like Wanderlog (built as an op broadcast, 04-stack.md 1.8); Q3/Q4 = Next.js on Vercel
for year one, with the conditions in 04-stack.md 1.9.

Each has a recommendation; "blocks" says which milestone cannot start without an answer.

## Decisions

| # | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| Q1 | Data host and auth | A Supabase all-in · B Supabase as plain Postgres + Better Auth · **C Neon + Better Auth + R2 + Workers** | **C**; B if one dashboard and less to build matter more than cost and portability (04-stack.md 1.5) | M0 |
| Q2 | Free plan for year one | stay free until outside users · pay from day one | **Free until the first outside user relies on reminders**, with our own nightly backup; then Neon Launch (~$5-20/mo) | M3 |
| Q3 | Hosting | **Cloudflare Workers** · Vercel | **Decided: Vercel Hobby** for the app; Cloudflare for cron and trip rooms | M0 |
| Q4 | Web framework | **React Router 7** on Workers · keep Next.js 16 (OpenNext) | **Decided: Next.js 16 on Vercel** for year one (04-stack.md 1.9) | M0 |
| Q5 | Source of truth | Postgres now · stay with JSON in git | **Postgres now**, pause P4c | M0 |
| Q6 | First destination | **Banff and Lake Louise** · Patagonia | **Banff**: well mapped in OSM, your 2029 trip has the richest data to import | M1 |
| Q7 | Accounts | now · later | **Now** (households, MCP OAuth and sharing all need them) | M0 |
| Q8 | Server-run research | owner only · paid users · never | **Owner only**; others use their own chat client via MCP | M6 |
| Q9 | Public catalog licence | keep OSM-derived layer separate (ODbL) · avoid OSM data entirely | **Separate layer**, legal advice before selling data | M1 |

## Questions where your answer changes the design

| # | Question | Why it matters | My default if you don't answer |
|---|---|---|---|
| Q10 | Is this for **your family first, then others**, or a **public product from launch**? | public launch adds moderation, terms, abuse limits and support before M2 | family first; public from M5 |
| Q11 | Region: start **Ontario + day trips** (the Travel Finder idea) or **big trips worldwide**? | day trips need dense local coverage and drive times; big trips need deep research per destination | both, but the first catalog is Banff + your 64 places + the 40 local day trips |
| Q12 | Should **collaborators edit at the same time** (Google Docs style) or is "someone else changed this, refresh" enough? | real-time needs a sync engine (ElectricSQL, Zero) and changes M2's size | refresh is enough in v1 |
| Q13 | Flights: just **items with a booking and a deadline**, or **fare tracking**? | fare tracking needs paid APIs | items only |
| Q14 | Do you want an **in-app AI chat** at all, or only the MCP for outside clients? | in-app chat costs model tokens per user | MCP only; in-app later if asked |
| Q15 | Is the **trip page for others** (the published HTML today) still needed, or is the app's read-only link enough? | the legacy pages are rich, designed one-pagers; the app view is functional | app link, with a print-friendly view |
| Q16 | Kids' data: is storing **birth year and height** acceptable, or only an age band? | eligibility checks (via ferrata 12+, 40-120 kg) need numbers | birth year + optional height, private to the household |
| Q17 | **Brand and domain** for the product (not nks-travel.pages.dev)? | OAuth consent screens, email sender, cookies | decide before M3 (email) |
| Q18 | Which **design direction** from the commissioned previews? | colour, type, density | wait for the previews |
| Q19 | **Budget per month** you are comfortable with once others use it? | decides Neon vs Supabase Pro, email tier | $25 |
| Q20 | Who besides you will **review research** (moderators)? | review queue permissions and volume | you only |
