'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';

/**
 * A component whose code loads after hydration (JS budget, backlog 2.7). The server and the first client render show the
 * placeholder, which has the same size and look as the real thing but does nothing; the real component replaces it as soon
 * as its chunk arrives, and later mounts get it at once. Unlike `next/dynamic`, the placeholder receives the props.
 */
export function lazyComponent<P extends object>(load: () => Promise<ComponentType<P>>, Placeholder: ComponentType<P>): ComponentType<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;
  return function Lazy(props: P) {
    const [Real, setReal] = useState<ComponentType<P> | null>(null);
    useEffect(() => {
      let live = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      // a chunk that fails to load (a dropped connection) is asked for again, a few times, instead of leaving the placeholder for good
      const attempt = (n: number) => {
        pending ??= load().then(
          (c) => {
            loaded = c;
          },
          (e: unknown) => {
            pending = null;
            throw e;
          },
        );
        pending.then(
          () => live && setReal(() => loaded),
          () => {
            if (live && n < 4) timer = setTimeout(() => attempt(n + 1), 400 * (n + 1));
          },
        );
      };
      attempt(0);
      return () => {
        live = false;
        if (timer) clearTimeout(timer);
      };
    }, []);
    const View = Real ?? Placeholder;
    return <View {...props} />;
  };
}
