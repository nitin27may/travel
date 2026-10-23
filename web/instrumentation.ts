// Runs once when a server instance starts (`next start`, `next dev`): builds the catalogue store and its revision before the first request,
// so the first visitor does not wait for the dataset (about two seconds) on top of their own query. A failure here is logged, not fatal:
// the store is built again by the first API request, which then answers 500 with the reason in the server log, and the pages still serve.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { getStore, setStore } = await import('@/lib/server/store');
    try {
      await getStore().revision();
    } catch (e) {
      setStore(null); // the next request builds a fresh store instead of finding this one
      throw e;
    }
  } catch (e) {
    console.error('catalogue store could not be warmed at start:', e);
  }
}
