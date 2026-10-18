'use client';

import dynamic from 'next/dynamic';

// The specimen shows every component, so it is loaded after the page, not with it: the JS budget measures scripts at load.
const Specimen = dynamic(() => import('./Specimen').then((m) => m.Specimen), { ssr: false, loading: () => <p className="muted">Loading the specimen</p> });

export function SpecimenClient() {
  return <Specimen />;
}
