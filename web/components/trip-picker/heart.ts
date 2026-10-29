// "Save without a trip" (patterns 3.9): the one row of the trip picker that sets the place's heart, with the heart's own words and Undo.
// The store loads here, in the picker's chunk, not at page start. Trip rows never touch it: a heart never adds to a trip and a trip row never hearts.
import type { ToastOptions } from '@/components/ui/Toast';
import { capabilities } from '@/lib/capabilities';
import * as say from '@/lib/favourites/toast';

type Toast = (t: ToastOptions) => void;

export async function saveWithoutTrip(place: { slug: string; name: string }, toast: Toast): Promise<void> {
  const s = await import('@/lib/favourites/store');
  const out = s.addHeart({ space: 'place', slug: place.slug, name: place.name, kind: null, cc: null });
  if (out.kind === 'cap') return toast({ message: say.capReached });
  if (out.kind === 'failed') return toast({ message: out.reason === 'quota' ? say.outOfSpace : out.reason === 'changed' ? say.changedElsewhere : say.cannotChange });
  if (out.kind === 'exists') return toast({ message: `${place.name} is already in your favourites` });
  const undo = () => void s.removeHeart('place', place.slug);
  if (out.session) return toast({ message: say.sessionOnly, actionLabel: 'Undo', onAction: undo, duration: say.FIRST_TOAST });
  if (out.first) return toast({ message: say.firstNote(capabilities.signIn), actionLabel: 'Undo', onAction: undo, duration: say.FIRST_TOAST });
  toast({ message: say.added(place.name), actionLabel: 'Undo', onAction: undo, duration: say.UNDO_TOAST });
}
