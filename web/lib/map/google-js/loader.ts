import type { GoogleLoader, GoogleLoadOptions, GoogleMapsApi } from './types';

/**
 * Loads the Maps JavaScript API once, on demand (click-to-load facade). No other Google API is requested:
 * no Places, Routes or Directions library (map-stack research, terms 3.2.3).
 */
let override: GoogleLoader | null = null;
let pending: Promise<GoogleMapsApi> | null = null;

/** Tests inject FakeGoogle here; pass null to restore the real loader. */
export function setGoogleLoader(fn: GoogleLoader | null): void { override = fn; pending = null; }

export const GOOGLE_SCRIPT_ID = 'google-maps-js-api';

const defaultLoader: GoogleLoader = ({ key }: GoogleLoadOptions) => {
  if (pending) return pending;
  pending = new Promise<GoogleMapsApi>((resolve, reject) => {
    const w = window as unknown as { google?: { maps?: GoogleMapsApi & { importLibrary?: (n: string) => Promise<unknown> } }; gm_authFailure?: () => void; __gmapsReady?: () => void };
    const done = async () => {
      try {
        const maps = w.google!.maps!;
        await maps.importLibrary?.('maps');
        await maps.importLibrary?.('marker');
        resolve(maps);
      } catch (e) { pending = null; reject(e); }
    };
    w.gm_authFailure = () => { pending = null; reject(new Error('Google rejected the Maps key (referrer or API restriction).')); };
    w.__gmapsReady = () => { void done(); };
    const s = document.createElement('script');
    s.id = GOOGLE_SCRIPT_ID;
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&callback=__gmapsReady`;
    s.onerror = () => { pending = null; reject(new Error('The Google Maps script could not be loaded.')); };
    document.head.appendChild(s);
  });
  return pending;
};

export function loadGoogleMaps(opts: GoogleLoadOptions): Promise<GoogleMapsApi> {
  return (override ?? defaultLoader)(opts);
}

/** "Try again" after a refused or timed-out script: forget the stuck request and the script tag so the next load asks Google again. */
export function resetGoogleLoader(): void {
  pending = null;
  if (typeof document !== 'undefined') document.getElementById(GOOGLE_SCRIPT_ID)?.remove();
}
