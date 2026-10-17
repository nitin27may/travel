'use client';

import { Popover } from '@base-ui/react/popover';
import { useCallback, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { decodeState, encodeState } from '@/lib/entities/url';
import type { ListState } from '@/lib/entities/types';
import { loadViews, presetViews, removeView, storeViews, upsertView } from '@/lib/entities/savedViews';
import type { SavedView } from '@/lib/entities/savedViews';

/** Named URL states: a few presets (data) plus the viewer's own, kept in localStorage on this device. */
export function SavedViewsMenu({ state, onState }: { state: ListState; onState: (s: ListState, mode?: 'push' | 'replace') => void }) {
  const [saved, setSaved] = useState<SavedView[]>(() => (typeof window === 'undefined' ? [] : loadViews()));
  const [name, setName] = useState('');
  const path = typeof window === 'undefined' ? '/places/' : window.location.pathname;

  const persist = useCallback((next: SavedView[]) => {
    setSaved(next);
    try {
      storeViews(next);
    } catch {
      /* storage unavailable: the list lasts until reload */
    }
  }, []);

  const apply = (v: SavedView) => onState({ ...decodeState(v.query), sv: v.name }, 'push');
  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    persist(upsertView(saved, { name: trimmed, path, query: encodeState({ ...state, focus: null, sv: null }), saved: new Date().toISOString().slice(0, 10) }));
    onState({ ...state, sv: trimmed }, 'replace');
    setName('');
  };
  const mine = saved.filter((v) => v.path === path);
  const presets = presetViews(path);

  return (
    <Popover.Root>
      <Popover.Trigger className="tool-btn" data-active={state.sv ? true : undefined}>
        <Icon name="layers" size={15} /> {state.sv ? `View: ${state.sv}` : 'Saved views'}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="popover-pos">
          <Popover.Popup className="popover popover-wide" aria-label="Saved views">
            <p className="popover-title">Saved views</p>
            <ul className="view-list">
              {[...presets, ...mine].map((v) => (
                <li key={`${v.preset ? 'p' : 'u'}:${v.name}`}>
                  <button type="button" className="view-apply" onClick={() => apply(v)}>
                    {v.name}
                    {v.preset ? <span className="muted"> (preset)</span> : null}
                  </button>
                  {!v.preset ? (
                    <button type="button" className="icon-btn" aria-label={`Delete saved view ${v.name}`} onClick={() => persist(removeView(saved, v.name, v.path))}>
                      <Icon name="close" size={14} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <form
              className="save-view"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label>
                <span className="sr-only">Name for this view</span>
                <input type="text" placeholder="Name this view" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              </label>
              <button type="submit" className="btn" disabled={!name.trim()}>
                Save
              </button>
            </form>
            <p className="muted small">Saved on this device only.</p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
