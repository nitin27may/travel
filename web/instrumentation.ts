// Runs once when a server instance starts (`next start`, `next dev`): builds the catalogue store and its revision before the first request,
// so the first visitor does not wait for the dataset (about two seconds) on top of their own query. A failure here is logged, not fatal:
// the store is built again by the first API request, which then answers 500 with the reason in the server log, and the pages still serve.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { getStore } = await import('@/lib/server/store');
    await getStore().revision();
  } catch (e) {
    console.error('catalogue store could not be warmed at start:', e);
  }
}
