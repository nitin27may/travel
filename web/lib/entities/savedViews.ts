import { readLocal, writeLocal } from '@/lib/storage/safe';
import presets from './presets.json';

export interface SavedView {
  name: string;
  path: string;
  query: string;
  saved: string;
  preset?: boolean;
}

export const VIEWS_KEY = 'travel:v1:views';

export function presetViews(path: string): SavedView[] {
  return (presets as Omit<SavedView, 'saved'>[]).filter((p) => p.path === path).map((p) => ({ ...p, saved: '', preset: true }));
}

export function parseViews(raw: string | null): SavedView[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as SavedView[];
    return Array.isArray(list) ? list.filter((v) => v && typeof v.name === 'string' && typeof v.path === 'string' && typeof v.query === 'string') : [];
  } catch {
    return [];
  }
}

export function loadViews(storage: Pick<Storage, 'getItem'> = { getItem: readLocal }): SavedView[] {
  return parseViews(storage.getItem(VIEWS_KEY));
}

/** Saving under an existing name replaces that view. */
export function upsertView(list: SavedView[], view: SavedView): SavedView[] {
  return [...list.filter((v) => !(v.name === view.name && v.path === view.path)), view];
}

export function removeView(list: SavedView[], name: string, path: string): SavedView[] {
  return list.filter((v) => !(v.name === name && v.path === path));
}

export function storeViews(list: SavedView[], storage: Pick<Storage, 'setItem'> = { setItem: writeLocal }): void {
  storage.setItem(VIEWS_KEY, JSON.stringify(list));
}
