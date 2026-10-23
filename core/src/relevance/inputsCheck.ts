// Validation of the derive inputs (data/relevance/inputs/): the hub matrix and points.json. `relevance.ts check` runs
// it, because a household origin could hide in either file.
//
// - hubs must be public AND on the allowlist (hubs.ts);
// - no point, town or hub may lie within 2 km of a private origin (relevance.md 5 rule 7). The origin comes from
//   data/relevance/inputs/private-origin.local.json, which is gitignored and never committed. Absent: skipped quietly;
// - every point carries a `coord_src`, and it is never Google (R6).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isAllowedHub } from "./hubs.ts";
import { HOME_RADIUS_KM } from "../config/nearby.ts";
import { haversineKm } from "../geo/distance.ts";

export interface InputIssue { code: string; file: string; path: string; message: string }

export const PRIVATE_ORIGIN_FILE = "private-origin.local.json";

const LINK_ONLY = /(alltrails|komoot|gaia|outdooractive|wikiloc|trailforks|strava|google|tripadvisor|yelp|booking\.com)/i;
const HOUSEHOLD_KEYS = /^(origin|home|household|home_address|private_origin|start_address|address|home_lat|home_lon|party|kids|children|ages)$/i;

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function loadPrivateOrigin(root: string): { lat: number; lon: number } | null {
  const p = join(root, "data", "relevance", "inputs", PRIVATE_ORIGIN_FILE);
  if (!existsSync(p)) return null;
  try {
    const j = readJson(p) as { lat?: unknown; lon?: unknown };
    return isNum(j.lat) && isNum(j.lon) ? { lat: j.lat, lon: j.lon } : null;
  } catch {
    return null;
  }
}

function scanKeys(x: unknown, file: string, path: string, out: InputIssue[]): void {
  if (Array.isArray(x)) x.forEach((y, i) => scanKeys(y, file, `${path}/${i}`, out));
  else if (isObj(x)) {
    for (const [k, v] of Object.entries(x)) {
      if (HOUSEHOLD_KEYS.test(k)) out.push({ code: "E_REL_HOUSEHOLD", file, path: `${path}/${k}`, message: `"${k}" looks like household data. Inputs carry public hubs and catalogue points only. Remove it.` });
      else scanKeys(v, file, `${path}/${k}`, out);
    }
  }
}

export function checkInputs(root: string): InputIssue[] {
  const out: InputIssue[] = [];
  const origin = loadPrivateOrigin(root);
  const near = (file: string, path: string, p: { lat: number; lon: number }, what: string): void => {
    if (origin && haversineKm(origin, p) <= HOME_RADIUS_KM) {
      out.push({ code: "E_REL_HOUSEHOLD", file, path, message: `${what} lies within ${HOME_RADIUS_KM} km of a private origin. Day-trip fit uses public hubs only; remove or move it to the public hub.` });
    }
  };

  const hubFile = "data/relevance/inputs/hub-matrix.json";
  if (existsSync(join(root, hubFile))) {
    try {
      const m = readJson(join(root, hubFile)) as { schema?: string; hubs?: unknown; minutes?: unknown };
      scanKeys(m, hubFile, "", out);
      if (m.schema !== "hub-matrix/1") out.push({ code: "E_REL_SCHEMA", file: hubFile, path: "/schema", message: 'schema must be "hub-matrix/1". Example: {"schema": "hub-matrix/1", "hubs": [...], "minutes": {}}.' });
      if (!Array.isArray(m.hubs) || !isObj(m.minutes)) out.push({ code: "E_REL_SCHEMA", file: hubFile, path: "", message: '"hubs" must be a list and "minutes" an object of ref to hub id to one-way minutes. Example: {"minutes": {"place/x": {"toronto": 55}}}.' });
      else {
        const ids = new Set<string>();
        (m.hubs as unknown[]).forEach((h, i) => {
          if (!isObj(h) || typeof h.id !== "string" || !isNum(h.lat) || !isNum(h.lon)) {
            out.push({ code: "E_REL_SCHEMA", file: hubFile, path: `/hubs/${i}`, message: 'a hub needs id, name, lat, lon and public. Example: {"id": "toronto", "name": "Toronto City Hall", "lat": 43.6534, "lon": -79.3841, "public": true}.' });
            return;
          }
          ids.add(h.id);
          if (h.public !== true || !isAllowedHub(h.id)) out.push({ code: "E_REL_HOUSEHOLD", file: hubFile, path: `/hubs/${i}`, message: `hub "${h.id}" is not a public hub on the allowlist (core/src/relevance/hubs.ts). Day-trip fit uses public hubs only (Toronto City Hall). Remove it.` });
          near(hubFile, `/hubs/${i}`, { lat: h.lat, lon: h.lon }, `hub "${h.id}"`);
        });
        for (const [ref, cells] of Object.entries(m.minutes as Record<string, unknown>)) {
          if (!isObj(cells)) continue;
          for (const [hub, min] of Object.entries(cells)) {
            if (!ids.has(hub)) out.push({ code: "E_REL_SCHEMA", file: hubFile, path: `/minutes/${ref}/${hub}`, message: `minutes names hub "${hub}", which is not in "hubs". Add the hub or remove the cell.` });
            if (!isNum(min) || min < 0) out.push({ code: "E_REL_SCHEMA", file: hubFile, path: `/minutes/${ref}/${hub}`, message: "minutes must be a number of one-way minutes, 0 or more. Example: 55." });
          }
        }
      }
    } catch (e) {
      out.push({ code: "E_REL_SCHEMA", file: hubFile, path: "", message: `not valid JSON: ${(e as Error).message}. Check for a trailing comma.` });
    }
  }

  const ptsFile = "data/relevance/inputs/points.json";
  if (existsSync(join(root, ptsFile))) {
    try {
      const j = readJson(join(root, ptsFile)) as { schema?: string; points?: unknown; towns?: unknown; trips?: unknown };
      scanKeys(j, ptsFile, "", out);
      if (j.schema !== "relevance-points/1") out.push({ code: "E_REL_SCHEMA", file: ptsFile, path: "/schema", message: 'schema must be "relevance-points/1". Example: {"schema": "relevance-points/1", "points": {}, "towns": []}.' });
      if (!isObj(j.points) || !Array.isArray(j.towns)) out.push({ code: "E_REL_SCHEMA", file: ptsFile, path: "", message: '"points" must be an object by ref and "towns" a list. Example: {"points": {"place/x": {"lat": 51.1, "lon": -115.5, "coord_src": "wikidata:P625"}}, "towns": []}.' });
      else {
        for (const [ref, p] of Object.entries(j.points)) {
          const path = `/points/${ref}`;
          if (!isObj(p) || !isNum(p.lat) || !isNum(p.lon)) {
            out.push({ code: "E_REL_SCHEMA", file: ptsFile, path, message: 'a point needs lat and lon numbers and a coord_src. Example: {"lat": 51.1, "lon": -115.5, "coord_src": "wikidata:P625"}.' });
            continue;
          }
          if (typeof p.coord_src !== "string" || p.coord_src.trim() === "") out.push({ code: "E_REL_SCHEMA", file: ptsFile, path: `${path}/coord_src`, message: 'a point needs a coord_src saying where the coordinates come from. Example: "wikidata:P625", "osm:way/123" or "official:https://parks.canada.ca/...".' });
          else if (LINK_ONLY.test(p.coord_src)) out.push({ code: "E_REL_LINK_ONLY_SRC", file: ptsFile, path: `${path}/coord_src`, message: "coordinates are never taken from Google, AllTrails or the other link-only platforms (R6). Use Wikidata P625, OpenStreetMap or the land manager. Example: \"wikidata:P625\"." });
          near(ptsFile, path, { lat: p.lat, lon: p.lon }, `point "${ref}"`);
        }
        (j.towns as unknown[]).forEach((t, i) => {
          if (isObj(t) && isNum(t.lat) && isNum(t.lon)) near(ptsFile, `/towns/${i}`, { lat: t.lat, lon: t.lon }, `town "${String(t.name ?? t.id)}"`);
        });
      }
      if (isObj(j.trips)) {
        for (const [trip, t] of Object.entries(j.trips)) {
          if (isObj(t) && isObj(t.base) && isNum(t.base.lat) && isNum(t.base.lon)) near(ptsFile, `/trips/${trip}/base`, { lat: t.base.lat, lon: t.base.lon }, `the base of ${trip}`);
        }
      }
    } catch (e) {
      out.push({ code: "E_REL_SCHEMA", file: ptsFile, path: "", message: `not valid JSON: ${(e as Error).message}. Check for a trailing comma.` });
    }
  }
  return out;
}
