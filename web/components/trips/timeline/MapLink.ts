import { createContext, useContext } from 'react';

/** What the day list knows about the map: which entries have a pin and a number, which have none, and what a click on a number does. */
export interface MapLinkValue {
  /** `<day>|<entry id>` -> the number on the pin. */
  numbers: ReadonlyMap<string, number>;
  /** `<day>|<entry id>` -> the pin's id. */
  pins: ReadonlyMap<string, string>;
  /** Entries of a day with a map that have no position. */
  missing: ReadonlySet<string>;
  /** The day the map shows, or null for All days. */
  mapDay: number | null;
  /** The number on a row was pressed: ring its pin, or pick its day when the map shows another. */
  show: (day: number, pinId: string) => void;
}

export const MapLinkContext = createContext<MapLinkValue | null>(null);
export const useMapLink = (): MapLinkValue | null => useContext(MapLinkContext);
