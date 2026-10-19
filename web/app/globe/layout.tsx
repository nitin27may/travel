import type { ReactNode } from 'react';
import { GlobeLoader } from '@/components/globe/GlobeLoader';
import '@/styles/globe.css';

/**
 * One persistent globe for every /globe URL. The pages below only set the metadata; moving between them (a drill-down,
 * Back, a link) keeps this component, and the map inside it, mounted, which is what lets the camera fly instead of reloading.
 * The layout carries no pins: the loader fetches the area tree, and the shell fetches a country's pins when it opens (backlog 2.39).
 */
export default function GlobeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GlobeLoader />
      {children}
    </>
  );
}
