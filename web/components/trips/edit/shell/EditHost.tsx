'use client';

// The read-mode half of edit mode (STEP2-E1): small enough to sit in the page's start code. It holds the timeline's extras (marks always;
// the edit slots only while the mode is on), asks for the lazy edit chunk (the first Edit trip press, a `?edit=1` address, or Show on the
// changes line), and hands the page the cover's edit pieces once the chunk has published them. The chunk itself is EditLayer.tsx.
import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { TimelineExtrasContext, type EditSlots, type TimelineExtras } from '@/components/trips/timeline/editSlots';
import { useEditMode } from '@/lib/trip-edit/editMode';
import type { LayerProps } from '../EditLayer';
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import type { PlanOp } from '@/lib/trip-edit/model';

/** What the loaded chunk hands back to the page. */
export interface Published {
  edit: EditSlots;
  tools: ReactNode;
  /** the cover's `⋯` trip menu */
  cover: ReactNode;
  /** the session's way to change the trip as one undo step with a toast (the Settings sheet uses it while editing) */
  commit: (ops: PlanOp[], label: string) => boolean;
}

export interface EditApi {
  /** edit mode is on and its chunk is ready */
  editing: boolean;
  /** the chunk is on its way after a press: the button shows its spinner */
  loading: boolean;
  /** Edit trip: loads the chunk, then adds `edit=1` (pushState) */
  start: () => void;
  /** hover or focus on Edit trip: fetch ahead */
  prefetch: () => void;
  done: () => void;
  /** Show on the changes line */
  showChanges: () => void;
  cover: ReactNode;
  /** applies a change with an Undo toast; null while the edit chunk is not ready */
  commit: ((ops: PlanOp[], label: string) => boolean) | null;
}

type Rest = Omit<LayerProps, 'on' | 'onDone' | 'publish' | 'command'>;

// one fetch however many presses ask for it
let layerPromise: Promise<ComponentType<LayerProps>> | null = null;
const load = (): Promise<ComponentType<LayerProps>> => (layerPromise ??= import('../EditLayer').then((m) => m.EditLayer));

/** `marks` reads the document; `layer` is what the chunk needs, or null while the trip is not yet readable. */
export function EditHost({ marks, layer, children }: { marks: (e: TimelineEntry) => string[]; layer: Rest | null; children: (api: EditApi) => ReactNode }) {
  const mode = useEditMode();
  const [Layer, setLayer] = useState<ComponentType<LayerProps> | null>(null);
  const [pub, setPub] = useState<Published | null>(null);
  const [pending, setPending] = useState(false);
  const [command, setCommand] = useState<{ n: number } | null>(null);
  const ask = useCallback((): Promise<void> => load().then((c) => setLayer(() => c)), []);
  // an address with edit=1 asks for the chunk by itself
  useEffect(() => {
    if (mode.on && !Layer) void ask();
  }, [mode.on, Layer, ask]);

  const { set } = mode;
  const start = useCallback(() => {
    setPending(true);
    void ask().then(() => {
      setPending(false);
      set(true);
    });
  }, [ask, set]);
  const done = useCallback(() => set(false), [set]);
  const showChanges = useCallback(() => {
    void ask().then(() => setCommand((c) => ({ n: (c?.n ?? 0) + 1 })));
  }, [ask]);

  const editing = mode.on && !!Layer && !!pub;
  const extras = useMemo<TimelineExtras>(() => ({ marks, ...(editing ? { edit: pub!.edit, tools: pub!.tools } : {}) }), [marks, editing, pub]);
  const api: EditApi = {
    editing,
    loading: pending || (mode.on && !editing),
    start,
    prefetch: () => void ask(),
    done,
    showChanges,
    cover: editing ? pub!.cover : null,
    commit: editing ? pub!.commit : null,
  };
  return (
    <TimelineExtrasContext.Provider value={extras}>
      {children(api)}
      {Layer && layer ? <Layer {...layer} on={mode.on} onDone={done} publish={setPub} command={command} /> : null}
    </TimelineExtrasContext.Provider>
  );
}
