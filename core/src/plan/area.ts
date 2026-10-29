// Area picks (TB-PIN, BACKLOG 15.354; park-page README 7 R1; FLOW stage 3): a pick that is a protected area, a zone, an area or a range
// pins the trip's area. It is never packed as a stop and never given a visit time; the picks inside it are the stops, and the candidates
// for it are its members. Pure: the numbers are BUILDER_AREA in core/src/config/builder.ts.
import { BUILDER_AREA } from "../config/builder.ts";
import { haversineKm } from "../geo/distance.ts";
import type { EnginePlace } from "./engineTypes.ts";

/**
 * True when a place is an area (a park, a zone, a range, a region): the trip's area when picked, never a stop. A place of an area kind or
 * type that HAS a time on site from data (`visitMin` or `visitRange`: a state park visited as a gorge walk, a day-use area) is a stop:
 * the time says someone measured a visit, so it is scheduled like any place.
 */
export function isAreaPlace(p: Pick<EnginePlace, "kind" | "type" | "visitMin" | "visitRange">): boolean {
  if (p.visitMin !== null || p.visitRange !== null) return false;
  if ((BUILDER_AREA.kinds as readonly string[]).includes(p.kind)) return true;
  const t = p.type;
  if (t === null) return false;
  if ((BUILDER_AREA.types as readonly string[]).includes(t)) return true;
  return BUILDER_AREA.typePrefixes.some((x) => t === x || t.startsWith(`${x}.`));
}

/**
 * True when `p` lies inside `area`: by the place's `within` closure when it carries one, else (until EG-Q) when its point is at most
 * BUILDER_AREA.fallbackMemberKm from the area's point. An area is never its own member; a place with no point and no `within` is not one.
 */
export function inArea(p: Pick<EnginePlace, "ref" | "point" | "within">, area: Pick<EnginePlace, "ref" | "point">): boolean {
  if (p.ref === area.ref) return false;
  if (p.within !== undefined) return p.within.includes(area.ref);
  if (!p.point || !area.point) return false;
  return haversineKm(p.point, area.point) <= BUILDER_AREA.fallbackMemberKm;
}
