// The local API (core/bin/serve.ts). The page is static; it talks to the owner's machine, never to a hosted service.
import type { Proposal } from './model';

export const EDITING = process.env.NEXT_PUBLIC_EDITING === 'local';
const DEFAULT_API = 'http://127.0.0.1:4319';
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;

/** ?api=http://127.0.0.1:PORT picks another port; anything but localhost is ignored */
export function apiBase(search: string): string {
  const v = new URLSearchParams(search).get('api');
  return v && LOCAL.test(v) ? v : DEFAULT_API;
}

export interface ApiError {
  code: string;
  message: string;
}

export class ApiFailure extends Error {
  code: string;
  constructor(e: ApiError) {
    super(e.message);
    this.code = e.code;
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiFailure({ code: 'E_OFFLINE', message: `Cannot reach the local server at ${new URL(url).origin}. Start it with: node core/bin/serve.ts. Open this page at http://localhost, not 127.0.0.1, so the server accepts it.` });
  }
  const body = await res.json();
  if (!body.ok) throw new ApiFailure({ code: body.code ?? 'E_UNKNOWN', message: body.message ?? 'The server refused the request.' });
  return body as T;
}

export const ACTOR = { id: 'u_owner', via: 'ui' };

export async function loadProposals(base: string): Promise<Proposal[]> {
  return (await call<{ proposals: Proposal[] }>(`${base}/api/v1/catalog/proposals`)).proposals;
}

export interface Summary {
  today: string;
  pending: Record<string, { open: number; auto: number; review: number; duplicates: number; conflicts: number }>;
  coverage: CoverageArea[];
  backlog: BacklogItem[];
  backlog_total: number;
}

export interface TypeScore {
  count: number;
  weighted: number;
  target: number;
  weight: number;
  score: number;
}

export interface CoverageArea {
  area_id: string;
  level: 'country' | 'region' | 'area';
  name: string;
  total: number;
  band: 'thin' | 'usable' | 'good';
  types: Record<string, TypeScore>;
  by_style: Record<string, { total: number; band: string }>;
  stale_prices: number;
  areas: number;
}

export interface BacklogItem {
  id: string;
  subject_entity: string | null;
  subject_id: string | null;
  area_id: string | null;
  reason: string;
  field: string | null;
  lane: string | null;
  priority: number;
  status: string;
}

export async function loadSummary(base: string): Promise<Summary> {
  return call<Summary & { ok: true }>(`${base}/api/v1/catalog/summary`);
}

export async function runOp(base: string, name: string, input: Record<string, unknown>): Promise<{ result?: unknown }> {
  return call(`${base}/api/v1/ops/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: ACTOR, ...input }) });
}
