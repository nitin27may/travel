// Every case table, by store method (EXECUTION-PLAN 4.6). Runners import CONTRACT_TABLES; a new method gets a new table here.
import type { ContractCase } from "./kit.ts";
import { countPlacesCases } from "./countPlaces.cases.ts";
import { getExportCases } from "./getExport.cases.ts";
import { getPlaceCases } from "./getPlace.cases.ts";
import { globeCases } from "./globe.cases.ts";
import { handlerCases } from "./handler.cases.ts";
import { imageCases } from "./images.cases.ts";
import { householdCases } from "./household.cases.ts";
import { listPlacesCases } from "./listPlaces.cases.ts";
import { nearCases } from "./near.cases.ts";
import { nearbyForPlaceCases } from "./nearbyForPlace.cases.ts";
import { reportCases } from "./report.cases.ts";
import { revisionCases } from "./revision.cases.ts";
import { parseCases, searchCases } from "./search.cases.ts";
import { townsCases } from "./towns.cases.ts";
import { getTripCases, listTripsCases } from "./trips.cases.ts";

export const CONTRACT_TABLES: Record<string, ContractCase[]> = {
  revision: revisionCases,
  listPlaces: listPlacesCases,
  countPlaces: countPlacesCases,
  getPlace: getPlaceCases,
  nearbyForPlace: nearbyForPlaceCases,
  near: nearCases,
  towns: townsCases,
  parse: parseCases,
  search: searchCases,
  listTrips: listTripsCases,
  getTrip: getTripCases,
  getExport: getExportCases,
  globe: globeCases,
  report: reportCases,
  household: householdCases,
  images: imageCases,
  handler: handlerCases,
};

export * from "./kit.ts";
