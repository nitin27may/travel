'use client';

import { useEffect, useRef } from 'react';

/**
 * A one-line index of the sections after the glance (S12): plain in-page links, scrolling sideways when they do not fit. Phone pages run
 * 6,000 to 8,700 px, so a visitor can jump; on a wide screen every section is in view and the line is hidden (suitability.css).
 *
 * It is built from the page's own section headings after hydration, so the 100 or so bytes per link are not in the HTML a second time as
 * RSC payload (P8, the place-size budget). The empty nav reserves its height, so nothing shifts when the links arrive. The links are
 * native anchors: the browser scrolls to each section's `scroll-margin-top` (the sticky header), and smooth scrolling is switched off
 * under reduced motion.
 */
export function SectionIndex() {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const sections = [...document.querySelectorAll<HTMLElement>('.pl-main > section.ps[id]')];
    if (sections.length < 4) return;
    const ul = document.createElement('ul');
    for (const s of sections) {
      const title = s.querySelector('h2')?.textContent?.trim();
      if (!title) continue;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${s.id}`;
      a.textContent = title;
      li.append(a);
      ul.append(li);
    }
    el.replaceChildren(ul);
    el.dataset.ready = 'true';
  }, []);
  return <nav ref={nav} className="ps-index" aria-label="On this page" />;
}
