// The two device key names, with no imports, so the trip page's start chunk can ask "does this device hold anything?" without
// loading the party code or the UI-state code (UXB-2 review S6). keys.ts documents the contract.
export const PARTY_KEY = 'travel.party';
export const TRIPUI_KEY = 'travel.tripui';
