import 'server-only';
import { createRealtime } from '@neon/realtime/server';
import { dataEnv } from './neon-env';

/**
 * Server-only Realtime capability issuer. Holds the project secret and seals queries. Created once
 * on first use; the secret never reaches the browser (the browser only ever sees the Realtime URL
 * and the sealed queries). No adapter: this app seals raw SQL queries (`rawSql`).
 */
let realtime: ReturnType<typeof createRealtime> | undefined;

export function getRealtime(): ReturnType<typeof createRealtime> {
  if (!realtime) {
    const { realtimeSecret, database } = dataEnv();
    realtime = createRealtime({
      secret: realtimeSecret,
      db: database,
      debugMode: process.env.NODE_ENV === 'development', // full database errors in dev only
    });
  }
  return realtime;
}
