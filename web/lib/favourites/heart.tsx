'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { capabilities } from '@/lib/capabilities';
import { FAVOURITES_ON } from './flag';
import { HeartGlyph } from './glyph';
import { isHearted, watchHearts } from './light';
import * as say from './toast';
import './heart.css';

type Store = typeof import('./store');
let loading: Promise<Store> | null = null;
/** The writers (core readers and Zod) load on the first tap, or when the pointer or focus arrives, so the tap itself has nothing to wait for. */
const loadStore = (): Promise<Store> => (loading ??= import('./store'));

interface Props {
  space: 'place' | 'trip';
  slug: string;
  /** The page's name. The place page passes none (no new props cross its server boundary, S13): the heart reads its `h1`. */
  name?: string;
  kind?: string | null;
  cc?: string | null;
}

/**
 * The favourites heart (mine-and-bar-spec 6, visitor spec 3): an icon toggle after Share in the cover's action row. One fixed name,
 * "Favourite <name>", with `aria-pressed`, so a screen reader says it once. Outline at rest, filled in `--accent-text` when pressed.
 * Mounted after hydration by the page's existing client component, so the server HTML has no heart (0 B on a place page). Works with no
 * account and no network: the list is the browser's own (`store.ts`).
 */
export function FavouriteHeart(props: Props) {
  return FAVOURITES_ON ? <Heart {...props} /> : null;
}

function Heart({ space, slug, name, kind = null, cc = null }: Props) {
  const { toast } = useToast();
  const [pressed, setPressed] = useState(() => isHearted(space, slug));
  const [pop, setPop] = useState(0);
  const [label] = useState(() => name ?? document.querySelector('h1')?.textContent?.trim() ?? slug.replace(/-/g, ' '));
  const busy = useRef(false);

  // another tab, Mine or an Undo changed the list
  useEffect(() => watchHearts(() => setPressed(isHearted(space, slug))), [space, slug]);

  const fail = (reason: string) =>
    toast({ message: reason === 'quota' ? say.outOfSpace : reason === 'changed' ? say.changedElsewhere : say.cannotChange });

  const add = (s: Store) => {
    const out = s.addHeart({ space, slug, name: label, kind, cc });
    if (out.kind === 'cap') return toast({ message: say.capReached });
    if (out.kind === 'failed') return fail(out.reason);
    setPressed(true);
    if (out.kind === 'exists') return;
    setPop((n) => n + 1);
    const undo = () => {
      s.removeHeart(space, slug);
      setPressed(false);
    };
    if (out.session) return toast({ message: say.sessionOnly, actionLabel: 'Undo', onAction: undo, duration: say.FIRST_MS });
    if (out.first) {
      const signIn = capabilities.signIn;
      const message = signIn ? (
        <>
          {say.FIRST_SIGN_IN_TEXT}{' '}
          <a className="fav-toast-link" href={`/sign-in/?next=${encodeURIComponent(location.pathname)}`}>Sign in</a> to keep them on every device.
        </>
      ) : (
        say.firstNote(false)
      );
      return toast({ message, actionLabel: 'Undo', onAction: undo, duration: say.FIRST_MS });
    }
    toast({ message: say.added(label), actionLabel: 'Undo', onAction: undo, duration: say.UNDO_MS });
  };

  const remove = (s: Store) => {
    const out = s.removeHeart(space, slug);
    if (!out.ok) {
      if (out.reason === 'absent') return setPressed(false);
      return fail(out.reason);
    }
    setPressed(false);
    setPop((n) => n + 1);
    toast({
      message: say.removed(label),
      actionLabel: 'Undo',
      duration: say.UNDO_MS,
      onAction: () => {
        if (s.restoreHeart(out.removed)) setPressed(true);
        else toast({ message: say.cannotRestore(label) });
      },
    });
  };

  const onClick = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const s = await loadStore();
      if (isHearted(space, slug)) remove(s);
      else add(s);
    } finally {
      busy.current = false;
    }
  };

  return (
    <Button
      icon
      className="fav-heart"
      aria-label={`Favourite ${label}`}
      aria-pressed={pressed}
      title="Favourite"
      onPointerEnter={() => void loadStore()}
      onFocus={() => void loadStore()}
      onClick={onClick}
    >
      <span className="fav-glyph" key={pop} data-pop={pop > 0 || undefined}>
        <HeartGlyph />
      </span>
    </Button>
  );
}
