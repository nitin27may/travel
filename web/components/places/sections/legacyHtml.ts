import { esc } from '@/components/suit/html';
import { appleMapsUrl, directionsUrl, formatPoint } from '@/lib/map/links';
import type { AccessPoint, Fact } from '@/lib/public/types';
import { isUrl, observed, phoneParts, pointAt, pointSourceInfo, publicProvenance, publicText } from '../model';

// The older record's blocks (trailhead and parking cards, fact lists) as strings of markup, for the same reason as components/suit/html.ts:
// the largest place pages stay inside their size budget when this markup travels once in the page payload, not as a serialised tree (S13).

const ICON: Record<string, string> = {
  parking: 'M5 3h14v18H5zM9 17V7h4a3 3 0 0 1 0 6H9',
  pin: 'M12 21s-6-5.6-6-10.5a6 6 0 1 1 12 0C18 15.4 12 21 12 21Zm0-8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  warn: 'M12 3 22 21H2zM12 10v5M12 18h.01',
};
const svg = (name: string, size: number): string => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${ICON[name]}"/></svg>`;
const NEW_TAB = '<span class="sr-only"> (opens in a new tab)</span>';

/** Fact text: operator dates read "observed 2026", public business phone numbers are tel: links, a bare URL is a link. */
export function factText(text: string): string {
  if (isUrl(text)) return `<a href="${esc(text)}" target="_blank" rel="noopener noreferrer">${esc(text.replace(/^https?:\/\//, '').replace(/\/$/, ''))}${NEW_TAB}</a>`;
  return phoneParts(observed(publicProvenance(text)))
    .map((p) => (p.tel ? `<a href="tel:${esc(p.tel)}" class="num">${esc(p.text)}</a>` : esc(p.text)))
    .join('');
}

/** "Operator" provenance as text, never a coloured dot. */
export const provenanceText = (s: string): string => publicProvenance(s).replace(/,\s*\((official|operator|community|agent[^)]*)\)\s*$/i, ' · $1').replace(/\s+\(([^)]+)\)$/, ' · $1');

function conflict(f: Fact): string {
  if (!f.conflicts.length) return '';
  const li = (v: string, p: string): string => `<li>${factText(v)}<span class="pl-prov">${esc(provenanceText(p))}</span></li>`;
  return `<div class="pl-conflict"><span class="chip chip-caution" data-kind="caution">${svg('warn', 13)}Sources disagree</span><ul>${li(f.value, f.provenance)}${f.conflicts.map((c) => li(c.value, c.provenance)).join('')}</ul></div>`;
}

/** A list of facts, each with its text, provenance and any conflict. */
export function factsDl(facts: readonly Fact[]): string {
  if (!facts.length) return '';
  return `<dl class="pl-kv pl-kv-wide">${facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${factText(f.value)}<span class="pl-prov">${esc(provenanceText(f.provenance))}</span>${conflict(f)}</dd></div>`).join('')}</dl>`;
}

function mapLinks(at: { lat: number; lng: number }, label: string): string {
  const l = esc(label);
  return `<span class="pl-maplinks"><a class="btn btn-sm" href="https://www.google.com/maps/search/?api=1&amp;query=${esc(formatPoint(at))}" target="_blank" rel="noopener noreferrer">Google Maps<span class="sr-only"> for ${l} (opens in a new tab)</span></a><a class="btn btn-sm" href="${esc(directionsUrl(at))}" target="_blank" rel="noopener noreferrer">Directions<span class="sr-only"> to ${l} (opens in a new tab)</span></a><a class="btn btn-sm" href="${esc(appleMapsUrl(at, label))}" target="_blank" rel="noopener noreferrer">Apple Maps<span class="sr-only"> for ${l} (opens in a new tab)</span></a></span>`;
}

function pointSource(p: Pick<AccessPoint, 'pointSource' | 'pointChecked'>): string {
  const info = pointSourceInfo(p);
  const [head, ...rest] = info.text.split(' · ');
  const first = info.url ? `<a href="${esc(info.url)}" target="_blank" rel="noopener noreferrer">${esc(head)}${NEW_TAB}</a>` : esc(head);
  return `<span class="pl-prov">${first}${rest.length ? esc(` · ${rest.join(' · ')}`) : ''}</span>`;
}

export function accessCard(p: AccessPoint, role: 'Trailhead' | 'Parking', unconfirmed: boolean): string {
  const note = publicText(p.note);
  const kv: string[] = [];
  if (p.elevationM !== null) kv.push(`<div><dt>Elevation</dt><dd class="num">${esc(p.elevationM.toLocaleString('en-CA'))} m</dd></div>`);
  if (p.fee) kv.push(`<div><dt>Fee</dt><dd>${factText(p.fee)}</dd></div>`);
  if (p.capacity) kv.push(`<div><dt>Capacity</dt><dd>${factText(p.capacity)}</dd></div>`);
  kv.push(`<div><dt>Point</dt><dd><span class="num pl-point">${esc(formatPoint(pointAt(p)))}</span> ${pointSource(p)}</dd></div>`);
  const honest = unconfirmed || !p.pointChecked ? `<span class="chip chip-honest" data-kind="honest" title="A person has not checked this pin yet">${svg('warn', 13)}${unconfirmed ? 'Location unconfirmed' : 'Pin not checked yet'}</span>` : '';
  return `<article class="pl-access" data-role="${role.toLowerCase()}"><header>${svg(role === 'Parking' ? 'parking' : 'pin', 16)}<h3>${esc(p.name)}</h3><span class="chip chip-kind" data-kind="kind">${role}</span>${honest}</header>${note ? `<p class="pl-access-note">${esc(observed(note))}</p>` : ''}<dl class="pl-kv pl-kv-stack">${kv.join('')}</dl>${mapLinks(pointAt(p), p.name)}</article>`;
}
