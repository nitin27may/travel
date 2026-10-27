import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import type { CatalogueStore } from '@travel/core/catalogue/store.ts';
import { publicStore } from '@travel/core/catalogue/public-store.ts';
import { folderAliases } from '@/lib/public/aliases';
import { createJsonSource } from './source';

// The one store (public form: public-ref-aliases 5.1 B1, every answer through publicStore) of this process, built from the dataset the pages read. `globalThis` holds it so every route bundle Next makes shares it
// (a module-level variable would be one per bundle). Server components and the prerendered JSON routes call this too, so a page, a fallback
// file and the API cannot disagree.
const KEY = Symbol.for('travel.catalogue.store');
type Holder = { [KEY]?: CatalogueStore };

export function getStore(): CatalogueStore {
  const g = globalThis as Holder;
  return (g[KEY] ??= publicStore(new JsonStore(createJsonSource()), folderAliases()));
}

/** Tests: a store over a source of their own. */
export function setStore(store: CatalogueStore | null): void {
  const g = globalThis as Holder;
  if (store) g[KEY] = store;
  else delete g[KEY];
}
