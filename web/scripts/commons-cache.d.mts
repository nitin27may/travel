export const CACHE: string;
export const networkLooksDown: () => boolean;
export const sourceUrlOf: (name: string) => string;
export const keyOf: (url: string) => string;
export const legacyKey: (url: string) => string;
export const cachePath: (url: string) => string;
export function thumb(url: string, opts?: { fetch?: boolean }): Promise<string | null>;
