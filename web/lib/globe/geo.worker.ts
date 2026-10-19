/// <reference lib="webworker" />
import { buildAdmin, buildCountriesShapes, buildLakes, type AdminJob, type CountriesJob } from './geoWork';
import type { Topology } from './geometry';

type Msg = { id: number; kind: 'admin'; job: AdminJob } | { id: number; kind: 'countries'; job: CountriesJob } | { id: number; kind: 'lakes'; job: Topology };

const scope = self as unknown as { onmessage: ((e: MessageEvent<Msg>) => void) | null; postMessage(m: unknown): void };

scope.onmessage = (e) => {
  const m = e.data;
  try {
    const r = m.kind === 'admin' ? buildAdmin(m.job) : m.kind === 'lakes' ? buildLakes(m.job) : buildCountriesShapes(m.job);
    // The drawn GeoJSON becomes an object URL here, so the main thread never copies a multi-megabyte string into a Blob (51 ms at Italy).
    const toUrl = (text: string): string => URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    scope.postMessage({ id: m.id, ok: true, result: typeof r === 'string' ? toUrl(r) : { ...r, render: toUrl(r.render) } });
  } catch (err) {
    scope.postMessage({ id: m.id, ok: false, error: String(err) });
  }
};
