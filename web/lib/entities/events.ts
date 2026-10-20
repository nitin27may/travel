// Window events that let list controls talk without sharing state. Plain strings, so importing them pulls no component code into a chunk.

/** The phone summary's "More filters" asks the filter bar to open its sheet. */
export const OPEN_FILTERS = 'travel:open-filters';
/** The count line's "N not checked yet" link asks the Not checked yet group to open and scroll into view. */
export const OPEN_UNCHECKED = 'travel:open-unchecked';
