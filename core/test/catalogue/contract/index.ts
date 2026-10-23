// Every case table, by store method (EXECUTION-PLAN 4.6). Runners import CONTRACT_TABLES; a new method gets a new table here.
import type { ContractCase } from "./kit.ts";
import { corpusCases } from "./corpus.cases.ts";
import { countPlacesCases } from "./countPlaces.cases.ts";
import { countsParsedCases } from "./countsParsed.cases.ts";
import { exportFormatsCases } from "./exportFormats.cases.ts";
import { searchCardsCases } from "./searchCards.cases.ts";
import { townGuardCases } from "./townGuard.cases.ts";
import { echoCases } from "./echo.cases.ts";
import { tripLegsCases } from "./tripLegs.cases.ts";
import { uncheckedCases } from "./unchecked.cases.ts";
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
  // API-3 (PHASE-E-START section 7): K20 to K27
  exportFormats: exportFormatsCases,
  countsParsed: countsParsedCases,
  unchecked: uncheckedCases,
  searchCards: searchCardsCases,
  townGuard: townGuardCases,
  tripLegs: tripLegsCases,
  // API-3c (review API3-R-1): K29
  echo: echoCases,
  // HYG (review API3-R-7, PHASE-E-START 15.27): K28
  corpus: corpusCases,
};

export * from "./kit.ts";
