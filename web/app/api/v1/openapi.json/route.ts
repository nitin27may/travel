import { readFileSync } from 'node:fs';
import path from 'node:path';
import { OPENAPI_PATH } from '@travel/core/catalogue/openapi.ts';
import { travelRoot } from '@/lib/data/root';

// The generated OpenAPI 3.1 document (node core/bin/openapi.ts), served as it is.
export function GET(): Response {
  const body = readFileSync(path.join(travelRoot(), OPENAPI_PATH), 'utf8');
  return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
