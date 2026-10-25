// Units to SI (S1: metres, kilometres, centimetres, kilograms, Celsius, minutes). A value written as text with an imperial unit
// ("1,200 ft", "3.5 mi", "68 °F") becomes the number in the unit its property is stored in; the source's own number and unit go
// to meta.original (RowMeta: `{value, unit}`, one per row, so a second conversion in a row is reported and left).

export interface Converted {
  /** the number in the target unit */
  value: number;
  /** the number as the source gave it */
  original: number;
  /** the source unit, as written in meta.original.unit */
  unit: string;
}

type Dim = "length" | "mass" | "temp";
interface U { dim: Dim; /** to metres, kilograms, or (temp) handled apart */ factor: number; label: string }

const SOURCE: Readonly<Record<string, U>> = {
  ft: { dim: "length", factor: 0.3048, label: "ft" },
  feet: { dim: "length", factor: 0.3048, label: "ft" },
  foot: { dim: "length", factor: 0.3048, label: "ft" },
  yd: { dim: "length", factor: 0.9144, label: "yd" },
  mi: { dim: "length", factor: 1609.344, label: "mi" },
  mile: { dim: "length", factor: 1609.344, label: "mi" },
  miles: { dim: "length", factor: 1609.344, label: "mi" },
  in: { dim: "length", factor: 0.0254, label: "in" },
  inch: { dim: "length", factor: 0.0254, label: "in" },
  inches: { dim: "length", factor: 0.0254, label: "in" },
  lb: { dim: "mass", factor: 0.45359237, label: "lb" },
  lbs: { dim: "mass", factor: 0.45359237, label: "lb" },
  oz: { dim: "mass", factor: 0.028349523125, label: "oz" },
  "°f": { dim: "temp", factor: 1, label: "°F" },
  f: { dim: "temp", factor: 1, label: "°F" },
};

/** Target units: the number of base units (metres, kilograms) in one, and decimals kept. */
const TARGET: Readonly<Record<string, { dim: Dim; per: number; dp: number }>> = {
  m: { dim: "length", per: 1, dp: 0 },
  km: { dim: "length", per: 1000, dp: 1 },
  cm: { dim: "length", per: 0.01, dp: 0 },
  kg: { dim: "mass", per: 1, dp: 1 },
  c: { dim: "temp", per: 1, dp: 1 },
};

const TEXT = /^\s*(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)\s*(°\s*F|[A-Za-z]+)\.?\s*$/;

/** Converts a text value like "1,200 ft" to `target` (m, km, cm, kg or c); null when the text is not a number with a known imperial unit. */
export function convertText(text: string, target: string): Converted | null {
  const m = TEXT.exec(text);
  if (!m) return null;
  const n = Number(m[1]!.replace(/,/g, ""));
  const u = SOURCE[m[2]!.replace(/\s+/g, "").toLowerCase()];
  const t = TARGET[target];
  if (!u || !t || u.dim !== t.dim || !Number.isFinite(n)) return null;
  const raw = u.dim === "temp" ? ((n - 32) * 5) / 9 : (n * u.factor) / t.per;
  const k = 10 ** t.dp;
  return { value: Math.round(raw * k) / k, original: n, unit: u.label };
}
