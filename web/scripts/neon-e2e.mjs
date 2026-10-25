// Opt-in, real end-to-end service proof for the Neon account path. NO MOCKS and NO swallowed
// errors: it drives a real browser against a real `next start` server talking to the real managed
// Better Auth + Realtime + Postgres, and every step throws on failure. It fails closed (exit 2,
// BLOCKED) when the shared `planner_draft` table is not yet present, rather than pretending to pass.
//
// Prerequisites:
//   - The server is running on $PW_E2E_URL (default http://localhost:3000), built with the Neon env.
//   - Run through the root-env wrapper so DATABASE_URL etc. are present:
//       NEON_E2E=1 node web/scripts/with-root-env.mjs node web/scripts/neon-e2e.mjs
//
// It creates safe synthetic users (…@travel-e2e.invalid), never disables email verification, never
// prints secrets, and at the end deletes only the drafts of the synthetic users it created.
import { chromium } from '@playwright/test';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
// The real shared transaction path (non-owner travel_app role + app.user_id + RLS), used to set up
// and to prove cross-user rejection exactly as the app runs it.
import { withUserTransaction, closePools } from '@travel/core/db/index.ts';

const BASE = process.env.PW_E2E_URL || 'http://localhost:3000';
const GPU_ARGS = ['--use-gl=angle', process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const TIMEOUT = 15_000;

if (process.env.NEON_E2E !== '1') {
  console.log('neon-e2e: set NEON_E2E=1 to run the real service E2E. Skipping.');
  process.exit(0);
}

const results = [];
function check(name, cond) {
  if (!cond) throw new Error(`CHECK FAILED: ${name}`);
  results.push(name);
  console.log('  ✓', name);
}

function uniqueUser(tag) {
  return { email: `e2e+${tag}-${randomUUID().slice(0, 8)}@travel-e2e.invalid`, password: `Str0ngPass-${randomUUID()}!`, name: `E2E ${tag}` };
}

/** Preflight: the schema lane must have shipped the shared table before a live-draft run can pass. */
async function requireTable() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('neon-e2e BLOCKED: DATABASE_URL not in env (run via with-root-env.mjs).'); process.exit(2); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const r = await client.query("select to_regclass('public.planner_draft') is not null as ok");
    if (!r.rows[0].ok) {
      console.error('neon-e2e BLOCKED: public.planner_draft does not exist yet. The database lane must apply its migrations to the target branch (core/bin/db-migrate.ts up) before the live-draft E2E can run. The app, auth, sealing and fail-closed paths are verified separately.');
      process.exit(2);
    }
  } finally {
    await client.end();
  }
}

/** Create an account through the real auth service; returns the new user id. Throws on failure. */
async function apiSignUp(context, user) {
  const res = await context.request.post(`${BASE}/api/auth/sign-up/email/`, { headers: { 'Content-Type': 'application/json', Origin: BASE }, data: user });
  if (!res.ok()) throw new Error(`sign-up failed (${res.status()}) for ${user.email}`);
  const body = await res.json();
  return body.user.id;
}

/** Sign in through the actual /sign-in/ UI and wait for the account page. Proves the form, not just the API. */
async function uiSignIn(page, user) {
  await page.goto(`${BASE}/sign-in/`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`${BASE}/account/`, { timeout: TIMEOUT });
}

/** The row element carrying a given title. */
const rowFor = (page, title) => page.locator('.draft-row', { hasText: title });

async function createDraftUI(page, title) {
  await page.getByLabel('Draft title').fill(title);
  await page.getByRole('button', { name: 'Create draft' }).click();
}

async function renameDraftUI(page, fromTitle, toTitle) {
  await rowFor(page, fromTitle).getByRole('button', { name: 'Draft actions' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByLabel('Rename draft').fill(toTitle);
  await page.getByRole('button', { name: 'Save' }).click();
}

async function deleteDraftUI(page, title) {
  await rowFor(page, title).getByRole('button', { name: 'Draft actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
}

async function main() {
  await requireTable();
  const synthetic = []; // user ids to clean up (own drafts only)
  const browser = await chromium.launch({ args: GPU_ARGS });
  try {
    // === Same user, two contexts: a write in one appears live in the other (no reload) ===
    const userA = uniqueUser('a');
    const ctxWrite = await browser.newContext();
    const idA = await apiSignUp(ctxWrite, userA);
    synthetic.push(idA);
    const ctxWatch = await browser.newContext({ storageState: await ctxWrite.storageState() }); // same user session
    const writer = await ctxWrite.newPage();
    const watcher = await ctxWatch.newPage();
    await writer.goto(`${BASE}/account/`, { waitUntil: 'networkidle' });
    await watcher.goto(`${BASE}/account/`, { waitUntil: 'networkidle' });

    const title = `Patagonia ${Date.now()}`;
    await createDraftUI(writer, title);
    await rowFor(watcher, title).waitFor({ timeout: TIMEOUT });
    check('same-user live insert propagates to a second context', true);

    // Reload persistence: the row survives a full reload (served from the SSR read).
    await writer.reload({ waitUntil: 'networkidle' });
    await rowFor(writer, title).waitFor({ timeout: TIMEOUT });
    check('draft persists across a full page reload', true);

    const renamed = `${title} (edited)`;
    await renameDraftUI(writer, title, renamed);
    await rowFor(watcher, renamed).waitFor({ timeout: TIMEOUT });
    check('same-user live rename propagates', true);

    await deleteDraftUI(writer, renamed);
    await rowFor(watcher, renamed).waitFor({ state: 'detached', timeout: TIMEOUT });
    check('same-user live delete propagates', true);

    // === Anonymous access is denied (proxy redirects to sign-in) ===
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(`${BASE}/account/`, { waitUntil: 'networkidle' });
    check('anonymous /account redirects to /sign-in/', anonPage.url() === `${BASE}/sign-in/`);

    // === Sign-in through the real UI lands on the account page ===
    const ctxUi = await browser.newContext();
    const uiPage = await ctxUi.newPage();
    await uiSignIn(uiPage, userA); // throws if the form or session fails
    check('sign-in UI authenticates and reaches /account/', uiPage.url() === `${BASE}/account/`);

    // === Sign out, then a renewal with the now-anonymous context is refused (401) ===
    await uiPage.getByRole('button', { name: 'Sign out' }).click();
    await uiPage.waitForURL(`${BASE}/`, { timeout: TIMEOUT });
    const renew = await ctxUi.request.post(`${BASE}/api/account/live-query/`, { headers: { 'Content-Type': 'application/json', Origin: BASE }, data: { userId: idA } });
    check('live-query renewal is denied after sign-out (401)', renew.status() === 401);

    // === Cross-user forged write rejection, via the real shared transaction path ===
    // User A owns a draft; user B attempts to change/delete it by id WITHOUT a user_id predicate —
    // RLS (travel_app role + app.user_id) must hide A's row, so 0 rows change and the title is intact.
    const forgedId = randomUUID();
    const original = `Owned by A ${Date.now()}`;
    await withUserTransaction(idA, (ctx) => ctx.query('insert into public.planner_draft (id, user_id, title) values ($1, $2, $3)', [forgedId, idA, original]));

    const userB = uniqueUser('b');
    const ctxB = await browser.newContext();
    const idB = await apiSignUp(ctxB, userB);
    synthetic.push(idB);
    check('two distinct user ids', idA !== idB);

    const upd = await withUserTransaction(idB, (ctx) => ctx.query("update public.planner_draft set title = 'hacked' where id = $1 returning id", [forgedId]));
    check('user B cannot update user A\'s row (RLS, 0 rows)', upd.result.rows.length === 0);
    const del = await withUserTransaction(idB, (ctx) => ctx.query('delete from public.planner_draft where id = $1 returning id', [forgedId]));
    check('user B cannot delete user A\'s row (RLS, 0 rows)', del.result.rows.length === 0);

    const still = await withUserTransaction(idA, (ctx) => ctx.query('select title from public.planner_draft where id = $1', [forgedId]));
    check("user A's row is intact after the forged attempts", still.result.rows[0]?.title === original);

    // User B's own account page shows none of user A's drafts.
    const pageB = await ctxB.newPage();
    await pageB.goto(`${BASE}/account/`, { waitUntil: 'networkidle' });
    await pageB.waitForTimeout(2000);
    check('user B sees none of user A\'s drafts (ownership isolation)', (await rowFor(pageB, original).count()) === 0);

    // === Degraded write: the write commits but the authenticated re-fetch fails ===
    // Inject a transport fault on the drafts re-fetch only (`/api/account/drafts/`). The create (a
    // server action) and the signal stream stay real, so the write is durable; only the refresh fails.
    // The committed row must stay visible and an explicit saved-but-not-refreshed notice must appear
    // (review follow-up: never hide a committed item on a sync failure).
    const userC = uniqueUser('c');
    const ctxC = await browser.newContext();
    const idC = await apiSignUp(ctxC, userC);
    synthetic.push(idC);
    const pageC = await ctxC.newPage();
    await pageC.goto(`${BASE}/account/`, { waitUntil: 'networkidle' });
    await pageC.route('**/api/account/drafts/**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"injected fault"}' }));
    const degradedTitle = `Durable but unsynced ${Date.now()}`;
    await createDraftUI(pageC, degradedTitle);
    // The committed row stays visible even though the authenticated refresh failed...
    await rowFor(pageC, degradedTitle).waitFor({ timeout: TIMEOUT });
    // ...and the explicit saved-but-not-refreshed notice is shown (not the generic refresh error).
    await pageC.getByText('The live list could not refresh').waitFor({ timeout: TIMEOUT });
    check('durable write + failed re-fetch keeps the committed row and shows the saved-but-not-refreshed notice', true);
    await pageC.unroute('**/api/account/drafts/**');
    // The write really committed: a fresh read under RLS as the owner returns exactly that row.
    const durable = await withUserTransaction(idC, (ctx) => ctx.query('select title from public.planner_draft where user_id = $1 and title = $2', [idC, degradedTitle]));
    check('the degraded-path write is durable in the database', durable.result.rows.length === 1);
  } finally {
    // Targeted cleanup: remove only the synthetic users' own drafts, each as its owner.
    for (const uid of synthetic) {
      await withUserTransaction(uid, (ctx) => ctx.query('delete from public.planner_draft where user_id = $1', [uid]));
    }
    await closePools();
    await browser.close();
  }
  console.log(`\nneon-e2e: ${results.length} checks passed.`);
}

main().catch((e) => { console.error('neon-e2e FAILED:', e.message); process.exit(1); });
