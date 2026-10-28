'use client';

import { useEffect, useMemo, useState } from 'react';
import { tripPageModelForBuilt, type PlanTripFacts } from '@/lib/trip-edit/model';
import type { ResolveRow, TripPlanModel } from '@travel/core/schema/api/index.ts';
import { PHOTOS_TAB_MIN } from '@/components/trips/summary/text';
import { tripTabsFor, type TripTab } from '@travel/core/trips/tabs.ts';
import { OwnCover } from '@/components/trips/TripCover';
import { TripPlan } from '@/components/trips/TripPlan';
import { PhotosPanel } from '@/components/trips/tabs/PhotosPanel';
import type { TripPageModel } from '@/components/trips/model';
import { lengthLabel } from '@/components/trips/format';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/export/dates';
import { mineStorage } from '@/lib/mine/storage';
import { partyText } from '@travel/core/trips/partyWords.ts';
import { placedBuild } from '@/lib/trip-edit/built';
import { changeCount, changesLine, endOf, kickerWords } from '@/lib/trip-edit/marks';
import { findCopy } from '@/lib/trip-edit/open';
import { documentSource, profileOfDraft } from '@/lib/trip-edit/source';
import { useTripDocument } from '@/lib/trip-edit/useTripDocument';
import { IdentityCell, Newer, NotBuilt, NotFound, SyncState, TripSkeleton } from './StateBits';
import { OwnActions } from './OwnActions';
import { PartyLine } from './PartyLine';
import { SummaryOwn } from './SummaryOwn';
import './shell.css';

const NO_PICKS: string[] = [];

/** One call per 48 refs (P8), failures kept as no rows: the page then reads the draft's own names. */
async function resolveAll(refs: readonly string[]): Promise<ResolveRow[]> {
  const { resolveRefs } = await import('@/lib/client/data');
  const rows: ResolveRow[] = [];
  for (let i = 0; i < refs.length; i += 48) rows.push(...((await resolveRefs(refs.slice(i, i + 48)).catch(() => null)) ?? []));
  return rows;
}

const words = (slug: string): string => slug.replace(/-\d{4}$/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * `/t/<id>/` in read mode (STEP2-T1): the person's trip as the published plan's own page. The document is read on the device or from the
 * account (useTripDocument); the plan comes from the one data boundary (`tripPlanModel(slug)`, P9) for a copy, or from the last build for a
 * built trip; the person's choices are applied on top. Everything private is read in the browser, so the first paint is a skeleton.
 */
export function TripShell({ id, signIn }: { id: string; signIn: boolean }) {
  const [facts, setFacts] = useState<((slug: string) => PlanTripFacts | null) | undefined>(undefined);
  const { state, save } = useTripDocument(id, signIn, facts);
  const doc = state.status === 'ok' ? state.doc : null;
  const copyTitle = state.status === 'ok' ? (state.copy?.title ?? null) : null;

  // the trip our copy follows: from the document, or from the device copy while it cannot be read as a document yet
  const hint = useMemo(() => {
    void state.status;
    if (typeof window === 'undefined') return null;
    const f = findCopy(mineStorage().storage, id);
    return f.kind === 'ok' ? f.copy.slug : null;
  }, [id, state.status]);
  const slug = doc ? (doc.template?.trip ?? null) : hint;

  const [plan, setPlan] = useState<{ slug: string; model: TripPlanModel | null; ours: ResolveRow | null } | null>(null);
  useEffect(() => {
    if (!slug) return;
    let live = true;
    void Promise.all([import('@/lib/trip-edit/planModel').then((m) => m.tripPlanModel(slug)).catch(() => null), resolveAll([`trip:${slug}`])]).then(([model, rows]) => {
      if (!live) return;
      setPlan({ slug, model, ours: rows[0] && rows[0].state !== 'unknown' ? rows[0] : null });
      if (model) setFacts(() => (s: string) => (s === slug ? { cc: rows[0]?.cc ?? 'XX', days: model.days.length } : null));
    });
    return () => {
      live = false;
    };
  }, [slug]);

  // a built trip: its last build, placed by core's builtDays, named from the picks' resolve rows
  const placed = useMemo(() => (doc && !doc.template ? placedBuild(doc) : null), [doc]);
  const [builtRows, setBuiltRows] = useState<ResolveRow[] | null>(null);
  const pickRefs = doc && !doc.template ? doc.picks.map((p) => p.ref) : NO_PICKS;
  const pickKey = pickRefs.join(',');
  useEffect(() => {
    if (!pickKey) return;
    let live = true;
    void resolveAll(pickKey.split(',')).then((r) => live && setBuiltRows(r));
    return () => {
      live = false;
    };
  }, [pickKey]);

  const { toast } = useToast();
  const [settings, setSettings] = useState(false);

  const model = useMemo<TripPlanModel | null>(() => {
    if (!doc) return null;
    if (doc.template) return plan && plan.slug === slug ? plan.model : null;
    return placed ? tripPageModelForBuilt(placed, builtRows ?? []) : null;
  }, [doc, plan, slug, placed, builtRows]);

  useEffect(() => {
    if (!doc) return;
    const t = doc.title ?? copyTitle ?? plan?.ours?.name ?? (slug ? words(slug) : 'Your trip');
    document.title = `${t} · Your trip`;
  }, [doc, plan, slug, copyTitle]);

  if (state.status === 'loading') return <TripSkeleton />;
  if (state.status === 'newer') return <><h1 className="sr-only">Your trip</h1><Newer /></>;
  if (state.status === 'missing' || !doc) return <><h1 className="sr-only">Your trip</h1><NotFound /></>;
  if (!doc.template && !placed) return <><h1 className="sr-only">Your trip</h1><NotBuilt id={id} /></>;
  // a copy of a trip the catalogue no longer lists (or a static build): the plan cannot be drawn
  if (doc.template && plan && plan.slug === slug && !plan.model) return <><h1 className="sr-only">Your trip</h1><NotFound /></>;
  if (!model || !model.timeline) return <TripSkeleton />;

  const ourTitle = plan?.ours?.name ?? (slug ? words(slug) : null);
  // a device copy keeps the person's name as the copy's title (the document maps it back as null); an account trip keeps it in the document
  const title = doc.title ?? copyTitle ?? ourTitle ?? 'Your trip';
  const photo = state.copy?.photo ?? model.gallery[0]?.url ?? null;
  const defaults = { ...model.timeline.defaultProfile, adults: 2 };
  const profile = profileOfDraft(doc, defaults);
  const party = doc.travellers ?? { adults: profile.adults, children: profile.youngest === null ? [] : [profile.youngest] };
  const days = model.days.length;
  const end = endOf(doc);
  const changes = changesLine(changeCount(doc));
  const publicUrl = slug ? `${location.origin}/trips/${slug}/` : location.href;

  const stops = model.sections.reduce((n, s) => n + s.rows.length, 0);
  const photos = model.gallery.length >= PHOTOS_TAB_MIN ? model.gallery.length : 0;
  const available: TripTab[] = tripTabsFor({ days, stops, bookings: 0, photos });
  const counts: Partial<Record<TripTab, number>> = { stops, photos };

  const calendar = async () => {
    if (!doc.start || !slug) return;
    try {
      const c = await import('@/lib/export/client');
      const d = await c.loadExport('trip', slug);
      const out = c.downloadIcs(d as Parameters<typeof c.downloadIcs>[0], doc.start);
      toast({ message: `Downloaded ${out.name} · ${out.summary}` });
    } catch (e) {
      toast({ message: (e as Error)?.name === 'NoCalendarError' ? 'This trip has no day plan to put in a calendar.' : 'Could not build that file. Try again.' });
    }
  };

  const source = {
    ...documentSource(doc, defaults, (ops) => save(ops)),
    chrome: {
      party: (ctx: { edit: boolean; setEdit: (v: boolean) => void; api: Parameters<typeof PartyLine>[0]['api'] }) => (
        <PartyLine doc={doc} api={ctx.api} defaults={defaults} title={title} ourTitle={ourTitle} where={state.where} save={save} edit={ctx.edit || settings} setEdit={(v) => { ctx.setEdit(v); setSettings(v); }} />
      ),
      lead: <IdentityCell title={title} photo={photo} identity={doc.identity} />,
    },
  };

  const slots = {
    summaryTop: <SummaryOwn start={doc.start ?? null} end={end} days={days} adults={party.adults} kids={party.children} pace={profile.pace} changes={changes} ours={slug && plan?.ours ? { href: `/trips/${slug}/`, title: ourTitle ?? words(slug) } : null} />,
    summaryBottom: null,
    bookings: null,
    photos: photos ? <PhotosPanel photos={model.gallery} rows={model.sections.flatMap((s) => s.rows).map((r) => ({ name: r.name, placeSlug: r.placeSlug, days: r.days }))} /> : null,
  };

  return (
    <article className="trip-page" data-own="" data-where={state.where}>
      <OwnCover
        kicker={kickerWords(doc, ourTitle)}
        title={title}
        photo={photo}
        standfirst={[doc.start ? `${formatDate(doc.start)}${end && end !== doc.start ? ` to ${formatDate(end)}` : ''}` : 'Dates not set yet', partyText({ adults: party.adults, children: party.children })].join(' · ')}
        chips={[]}
        glance={[
          { k: 'Length', v: lengthLabel(doc.nights, days) },
          { k: 'Starts', v: doc.start ? formatDate(doc.start) : 'Not set yet' },
          { k: 'Who is going', v: partyText({ adults: party.adults, children: party.children }) },
          { k: 'Pace', v: profile.pace.charAt(0).toUpperCase() + profile.pace.slice(1) },
        ]}
        state={
          <>
            <SyncState word={state.word} onRetry={state.retry} />
            {changes ? <span className="own-changes">{changes}</span> : null}
          </>
        }
        actions={<OwnActions slug={slug ?? id} title={title} url={publicUrl} onEdit={() => setSettings(true)} onCalendar={doc.start && slug ? () => void calendar() : null} onAddDates={() => setSettings(true)} />}
      />
      <TripPlan
        slug={slug ?? id}
        model={model as unknown as TripPageModel}
        title={title}
        depth="full"
        tabs={{ available, counts }}
        slots={slots}
        shape={null}
        source={source}
      />
    </article>
  );
}
