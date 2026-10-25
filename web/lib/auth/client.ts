'use client';

import { createAuthClient } from '@neondatabase/auth/next';

/**
 * Browser auth client for form submissions and session reads. Lazy so importing this module (e.g.
 * during a server render of a client component) does not construct the client until a handler
 * actually runs in the browser. No arguments: it talks to the app's own `/api/auth/*` proxy, so no
 * auth secret ever reaches the browser.
 */
let client: ReturnType<typeof createAuthClient> | undefined;

export function getAuthClient(): ReturnType<typeof createAuthClient> {
  return (client ??= createAuthClient());
}
