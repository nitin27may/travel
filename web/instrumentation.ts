// Runs once when a server instance starts (`next start`, `next dev`): builds the catalogue store and its revision before the first request,
// so the first visitor does not wait for the dataset (about two seconds) on top of their own query.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { getStore } = await import('@/lib/server/store');
  await getStore().revision();
}
