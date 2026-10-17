// The shapes shared by the runner and the operations (plan 5.2): an operation is a pure function over a Workspace
// (the files it asked for, parsed), so the same code runs over a FileStore, a MemoryStore or a browser draft.
import { serializeJson, serializeTrip } from "../store/tripWriter.ts";

export type Row = Record<string, any>;
export interface Actor {
  id: string;
  via: string;
}

/** a failure an operation reports on purpose: it aborts the run and writes nothing */
export class OpError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** The place store is written by Python (tools/locations.py); operations go through this interface (pitfall 3). */
export interface PlaceBackend {
  get(id: string): Promise<{ id: string; name: string; status: string; trip: string | null } | null>;
  edit(id: string, change: { status?: string; trip?: string | null }): Promise<void>;
}

export interface PlaceEdit {
  id: string;
  status?: string;
  trip?: string | null;
  /** state before, for the inverse */
  prev: { status: string; trip: string | null };
}

export interface OpContext {
  actor: Actor;
  /** ISO datetime with offset: the clock is injected, operations never read it */
  now: string;
  /** ISO date */
  today: string;
  /** the trip this run belongs to (the changelog row goes into its trip.json) */
  slug: string;
  /** places prefetched through the PlaceBackend for operations that declare `places` */
  places: Map<string, { id: string; name: string; status: string; trip: string | null }>;
  placeEdits: PlaceEdit[];
  /** composite operations (proposal.apply) run others inside the same workspace; a failure aborts everything */
  runInner(name: string, input: Record<string, unknown>): { changed: string[]; changelog_seq: number };
}

export interface OpEffect {
  changed: string[];
  summary: string;
  /** ids touched, for the changelog `refs` column */
  refs: string[];
}

export interface WriteOp<I = any> {
  /** the trip the run belongs to (default: input.slug) */
  slug?(input: I): string;
  /** extra files to load besides the trip's trip.json */
  paths?(input: I, store: { read(path: string): Promise<Uint8Array | null>; list(prefix: string): Promise<string[]> }): Promise<string[]>;
  /** place ids to prefetch through the PlaceBackend */
  places?(input: I): string[];
  /** skip the changelog row (trip.restore rewinds the log instead of extending it) */
  noChangelog?: boolean;
  apply(ws: Workspace, input: I, ctx: OpContext): OpEffect;
}

export const tripPath = (slug: string): string => `data/trips/${slug}/trip.json`;

const isTrip = (path: string): boolean => /^data\/trips\/[^/]+\/trip\.json$/.test(path);

export function serializeFor(path: string, doc: unknown): string {
  return isTrip(path) ? serializeTrip(doc as Row) : serializeJson(doc);
}

/** The files an operation works on. Reads parse lazily and hand out working copies; `dirty()` compares bytes. */
export class Workspace {
  private before = new Map<string, string | null>();
  private cur = new Map<string, any>();

  constructor(loaded: Map<string, string | null>) {
    for (const [p, t] of loaded) this.before.set(p, t);
  }

  has(path: string): boolean {
    return this.cur.has(path) ? this.cur.get(path) !== null : (this.before.get(path) ?? null) !== null;
  }

  /** a working copy of the parsed file, or null when it does not exist */
  get(path: string): any | null {
    if (this.cur.has(path)) return this.cur.get(path);
    const text = this.before.get(path);
    if (text === undefined) throw new OpError("E_INTERNAL", `${path} was not loaded for this operation`);
    const doc = text === null ? null : JSON.parse(text);
    this.cur.set(path, doc);
    return doc;
  }

  set(path: string, doc: unknown): void {
    this.cur.set(path, doc);
    if (!this.before.has(path)) this.before.set(path, null);
  }

  remove(path: string): void {
    this.cur.set(path, null);
    if (!this.before.has(path)) this.before.set(path, null);
  }

  /** replace a file by exact text (trip.restore) */
  setText(path: string, text: string | null): void {
    this.cur.set(path, text === null ? null : { __text: text });
    if (!this.before.has(path)) this.before.set(path, null);
  }

  /** the trip document at slug, a working copy */
  trip(slug: string): Row {
    const doc = this.get(tripPath(slug));
    if (!doc) throw new OpError("E_NOT_FOUND", `no trip "${slug}". Trips are the folders under data/trips/.`);
    return doc;
  }

  textBefore(path: string): string | null {
    return this.before.get(path) ?? null;
  }

  textAfter(path: string): string | null {
    if (!this.cur.has(path)) return this.before.get(path) ?? null;
    const doc = this.cur.get(path);
    if (doc === null) return null;
    if (doc && typeof doc === "object" && "__text" in doc && Object.keys(doc).length === 1) return doc.__text as string;
    return serializeFor(path, doc);
  }

  /** files whose bytes differ from what was loaded */
  dirty(): { path: string; before: string | null; after: string | null }[] {
    const out: { path: string; before: string | null; after: string | null }[] = [];
    for (const path of this.cur.keys()) {
      const before = this.textBefore(path);
      const doc = this.cur.get(path);
      // an untouched file that was only read stays as it was, even when its formatting is not canonical
      if (before !== null && doc !== null && !("__text" in (doc ?? {})) && JSON.stringify(doc) === JSON.stringify(JSON.parse(before))) continue;
      const after = this.textAfter(path);
      if (before !== after) out.push({ path, before, after });
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }
}
