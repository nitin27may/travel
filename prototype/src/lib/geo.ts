// Leg estimates. The app reads routed legs from a cache; the prototype uses straight-line distance with a
// mountain winding factor so every drop recalculates instantly. Values are marked "≈" in the UI.
import type { Place } from "../data/places";

const R = 6371;
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export interface Leg { mode: "drive" | "walk"; min: number; km: number }
export function leg(a: Place, b: Place): Leg {
  const d = km(a, b);
  if (d < 1.2) { const k = d * 1.3; return { mode: "walk", km: round1(k), min: Math.max(2, Math.round((k / 4.5) * 60)) }; }
  const road = d * 1.42 + (d > 60 ? 0 : 1.5);          // winding mountain roads; motorways are straighter
  const speed = d > 60 ? 72 : 46;                       // km/h
  return { mode: "drive", km: Math.round(road), min: Math.round((road / speed) * 60 + 3) };
}
const round1 = (x: number) => Math.round(x * 10) / 10;

export const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`);
