import { aliasDeep, type FolderAliases } from '@travel/core/catalogue/alias.ts';
import { folderAliasesOf } from '@travel/core/catalogue/slugs.ts';
import { travelRoot } from '../data/root';
import { readSlugRegistry } from './places';

// The pinned dated-folder table (data/catalogue/slugs.json `trips.folderAliases`, public-ref-aliases 4.3), read once on the server. Server
// only: it reads the registry with node:fs (a client import cannot bundle), and the table and the inverse (`privateRef`) never reach a client
// chunk (5.3): the built-output scan (tests/data/dated-refs-output.test.ts) fails if any served file holds a dated folder name. It does not
// import the `server-only` package because plain-Node and vitest tooling (the slug snapshot dump, the legs and scope dumps) load this module too.
let table: FolderAliases | null = null;
export const folderAliases = (): FolderAliases => (table ??= folderAliasesOf(readSlugRegistry(travelRoot())));

const memo = new WeakMap<object, unknown>();

/** The public form of an adapter answer (B2): every string value and key through `publicRef`. Memoised per answer object, so a page build pays once. */
export function publicModel<T>(value: T): T {
  if (value === null || typeof value !== 'object') return aliasDeep(value, folderAliases());
  const hit = memo.get(value as object);
  if (hit !== undefined) return hit as T;
  const out = aliasDeep(value, folderAliases());
  memo.set(value as object, out);
  return out;
}
