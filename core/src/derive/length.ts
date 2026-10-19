// Trip length classes (docs/v2/features/short-trips.md 2.1). Pure; shared by the public site and, later, the planner.
// The night count is the number of nights away from home.

export type LengthClass = "day" | "overnight" | "weekend" | "long-weekend" | "multi-day";

export function lengthClass(nights: number): LengthClass {
  if (nights <= 0) return "day";
  if (nights === 1) return "overnight";
  if (nights === 2) return "weekend";
  if (nights === 3) return "long-weekend";
  return "multi-day";
}

export const isShort = (nights: number): boolean => nights <= 3;

/** The Length filter's values: the four short classes, then the bands for 4 nights and more (L3b). */
export type LengthFilter = "day" | "overnight" | "weekend" | "long-weekend" | "4-8" | "9-14" | "15+";

export const LENGTH_FILTERS: readonly LengthFilter[] = ["day", "overnight", "weekend", "long-weekend", "4-8", "9-14", "15+"];

export function lengthFilter(nights: number): LengthFilter {
  const c = lengthClass(nights);
  if (c !== "multi-day") return c;
  if (nights <= 8) return "4-8";
  if (nights <= 14) return "9-14";
  return "15+";
}
