'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tripPageModelForBuilt, type PlanOp, type PlanTripFacts } from '@/lib/trip-edit/model';
import type { ResolveRow, TripPlanModel } from '@travel/core/schema/api/index.ts';
import { PHOTOS_TAB_MIN } from '@/components/trips/summary/text';
import { tripTabsFor, type TripTab } from '@travel/core/trips/tabs.ts';
import { OwnCover } from '@/components/trips/TripCover';
import { TripPlan } from '@/components/trips/TripPlan';
import { BookingsPanel } from '@/components/trips/tabs/BookingsPanel';
import { bookingCounts } from '@travel/core/export/bookings.ts';
import type { ExportBooking } from '@travel/core/export/types.ts';
import { PhotosPanel } from '@/components/trips/tabs/PhotosPanel';
import type { TripPageModel } from '@/components/trips/model';
import { lengthLabel } from '@/components/trips/format';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/export/dates';
import { getOwn, publishOwn } from '@/lib/export/ownState';
import { getTimeline } from '@/lib/export/timelineState';
import { mineStorage } from '@/lib/mine/storage';
import { partyText } from '@travel/core/trips/partyWords.ts';
import { placedBuild } from '@/lib/trip-edit/built';
import { changeCount, changesLine, endOf, entryMarks, kickerWords } from '@/lib/trip-edit/marks';
import { findCopy } from '@/lib/trip-edit/open';
import { slugIdentity } from '@travel/core/schema/identity.ts';
import { documentSource, profileOfDraft } from '@/lib/trip-edit/source';
import { useTripDocument } from '@/lib/trip-edit/useTripDocument';
import { ChangesLine, IdentityCell, Newer, NotBuilt, NotFound, SyncState, TripSkeleton } from './StateBits';
import { EditHost, type EditApi } from './EditHost';
import type { AddCandidate, TimelineModel } from '@/components/trips/timeline/model';
import { missingSlugs, readExtras, withExtras } from '../add/extras';
import { StopCount } from '../stops/useOwnStops';
import { InlineTitle } from './InlineTitle';
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
  const { state, save: saveDoc } = useTripDocument(id, signIn, facts);
  // a device copy keeps its name in the copy item, so "back to our name" (an empty name, or Undo of a rename) writes our trip's name; an account trip derives it from null
  const titleBack = useRef<string | null>(null);
  const save = useCallback(
    (ops: readonly PlanOp[]) => saveDoc(titleBack.current ? ops.map((o) => (o.kind === 'setTitle' && o.title === null ? { ...o, title: titleBack.current } : o)) : ops),
    [saveDoc],
  );
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

  // SW-011: the book-by list is the plan's own, read from the per-trip export (one item, P8), the same rows the published Bookings tab shows
  const [bookings, setBookings] = useState<{ slug: string; rows: ExportBooking[] } | null>(null);
  useEffect(() => {
    if (!slug) return;
    let live = true;
    void import('@/lib/export/client')
      .then((c) => c.loadExport('trip', slug))
      .then((d) => live && setBookings({ slug, rows: d.bookings }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [slug]);
  const { toast } = useToast();
  const [settings, setSettings] = useState(false);
  const marks = useMemo(() => (doc ? entryMarks(doc) : () => []), [doc]);
  const openSettings = useCallback(() => setSettings(true), []);
  // places the document names that the plan model does not carry (found by search, taken from a park or Maybe): read once, merged into the timeline model (STEP2-E3)
  const [extras, setExtras] = useState<Record<string, AddCandidate>>({});
  const register = useCallback((c: AddCandidate) => setExtras((e) => (e[c.key] ? e : { ...e, [c.key]: c })), []);

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

  const timelineModel = useMemo(() => (model?.timeline && doc ? withExtras(model.timeline as unknown as TimelineModel, extras, doc) : null), [model, doc, extras]);
  const pageModel = useMemo(() => (model && timelineModel ? { ...model, timeline: timelineModel } : model), [model, timelineModel]);
  const lacking = model?.timeline && doc ? missingSlugs(doc, model.timeline as unknown as TimelineModel, extras).join(',') : '';
  useEffect(() => {
    if (!lacking) return;
    let live = true;
    void readExtras(lacking.split(',')).then((c) => live && Object.keys(c).length && setExtras((e) => ({ ...e, ...c })));
    return () => {
      live = false;
    };
  }, [lacking]);

  const ourTitle = plan?.ours?.name ?? (slug ? words(slug) : null);
  const whereNow = state.status === 'ok' ? state.where : null;
  useEffect(() => {
    titleBack.current = whereNow === 'device' ? ourTitle : null;
  }, [whereNow, ourTitle]);

  // the export, the print and the Stops tab read the person's trip from here (STEP2-E6); the builder is its own chunk, fetched once the page is up
  useEffect(() => () => publishOwn(null), []);
  useEffect(() => {
    if (!doc || !slug || !timelineModel) return;
    let live = true;
    void import('@/lib/export/own').then((o) => {
      if (!live) return;
      const ourTitle = plan?.ours?.name ?? words(slug);
      const profile = profileOfDraft(doc, { ...timelineModel.defaultProfile, adults: 2 });
      publishOwn(
        o.ownTripOf({
          doc,
          slug,
          title: doc.title ?? copyTitle ?? ourTitle,
          ourTitle,
          party: doc.travellers ?? { adults: profile.adults, children: profile.youngest === null ? [] : [profile.youngest] },
          days: timelineModel.days,
          addables: (k) => timelineModel.addables[k],
        }),
      );
    });
    return () => {
      live = false;
    };
  }, [doc, slug, timelineModel, plan, copyTitle]);

  // the Stops tab's count from the person's days; a leaf reads the stores so a timeline publish does not re-render this page
  const [editedStops, setEditedStops] = useState<number | null>(null);

  if (state.status === 'loading') return <TripSkeleton />;
  if (state.status === 'newer') return <><h1 className="sr-only">Your trip</h1><Newer /></>;
  if (state.status === 'missing' || !doc) return <><h1 className="sr-only">Your trip</h1><NotFound /></>;
  if (!doc.template && !placed) return <><h1 className="sr-only">Your trip</h1><NotBuilt id={id} /></>;
  // a copy of a trip the catalogue no longer lists (or a static build): the plan cannot be drawn
  if (doc.template && plan && plan.slug === slug && !plan.model) return <><h1 className="sr-only">Your trip</h1><NotFound /></>;
  if (!model || !model.timeline) return <TripSkeleton />;

  // a device copy keeps the person's name as the copy's title (the document maps it back as null); an account trip keeps it in the document
  const title = doc.title ?? copyTitle ?? ourTitle ?? 'Your trip';
  const photo = state.copy?.photo ?? model.gallery[0]?.url ?? null;
  const defaults = { ...model.timeline.defaultProfile, adults: 2 };
  const profile = profileOfDraft(doc, defaults);
  const party = doc.travellers ?? { adults: profile.adults, children: profile.youngest === null ? [] : [profile.youngest] };
  const days = model.days.length;
  const end = endOf(doc);
  const changes = changesLine(changeCount(doc));
  // the public trip's address, never this page's: `/t/<id>/` is private (review STEP2-ES ES-008)
  const publicUrl = slug ? `${location.origin}/trips/${slug}/` : null;

  const stops = editedStops ?? model.sections.reduce((n, s) => n + s.rows.length, 0);
  const photos = model.gallery.length >= PHOTOS_TAB_MIN ? model.gallery.length : 0;
  const book = bookings && bookings.slug === slug ? bookings.rows : [];
  const toBook = bookingCounts(book).toBook;
  const available: TripTab[] = tripTabsFor({ days, stops, bookings: book.length, photos });
  const counts: Partial<Record<TripTab, number>> = { stops, photos, ...(toBook > 0 ? { bookings: toBook } : {}) };

  const calendar = async () => {
    if (!doc.start || !slug) return;
    try {
      const c = await import('@/lib/export/client');
      const d = await c.loadExport('trip', slug);
      // the person's calendar is made from the timelines on the page (their removals, additions and notes), not from the published plan
      const mine = getOwn(slug);
      const sess = getTimeline(slug);
      const o = mine && sess ? await import('@/lib/export/own') : null;
      const out = o && mine && sess ? o.downloadOwnIcs(d, sess, mine) : c.downloadIcs(d as Parameters<typeof c.downloadIcs>[0], doc.start);
      toast({ message: `Downloaded ${out.name} · ${out.summary}` });
    } catch (e) {
      toast({ message: (e as Error)?.name === 'NoCalendarError' || (e as Error)?.constructor?.name === 'NoCalendarError' ? 'This trip has no day plan to put in a calendar.' : 'Could not build that file. Try again.' });
    }
  };

  const bookingRows = book.map((b) => ({ name: b.name, day: b.kind === 'booking' ? b.day : null }));
  const build = (edit: EditApi) => {
  const source = {
    ...documentSource(doc, defaults, (ops) => save(ops)),
    chrome: {
      party: (ctx: { model: TimelineModel; edit: boolean; setEdit: (v: boolean) => void; api: Parameters<typeof PartyLine>[0]['api'] }) => (
        <>
          <PartyLine doc={doc} api={ctx.api} defaults={defaults} title={title} ourTitle={ourTitle} where={state.where} save={save} edit={ctx.edit || settings} setEdit={(v) => { ctx.setEdit(v); setSettings(v); }} commit={edit.commit ?? undefined} days={ctx.model.days.length} bookings={bookingRows} />
          {changes && doc.template ? <ChangesLine text={changes} onShow={edit.showChanges} /> : null}
        </>
      ),
      // an account trip merged before copies/2 has no colour: its slug's, the ring Mine draws for it (SW-026)
      lead: <IdentityCell title={title} photo={photo} identity={doc.identity ?? (slug ? slugIdentity(slug) : undefined)} />,
    },
  };

  const slots = {
    summaryTop: <><SummaryOwn start={doc.start ?? null} end={end} days={days} adults={party.adults} kids={party.children} pace={profile.pace} changes={changes} onShow={edit.showChanges} ours={slug && plan?.ours ? { href: `/trips/${slug}/`, title: ourTitle ?? words(slug) } : null} />{edit.checks}</>,
    summaryBottom: null,
    bookings: book.length ? <BookingsPanel bookings={book} /> : null,
    photos: photos ? <PhotosPanel photos={model.gallery} rows={model.sections.flatMap((s) => s.rows).map((r) => ({ name: r.name, placeSlug: r.placeSlug, days: r.days }))} /> : null,
  };

  return (
    <article className="trip-page" data-own="" data-where={state.where}>
      <OwnCover
        kicker={kickerWords(doc, ourTitle)}
        title={title}
        titleEditor={edit.editing && edit.commit ? <InlineTitle title={title} ourTitle={ourTitle} where={state.where} commit={edit.commit} /> : undefined}
        photo={photo}
        standfirst={doc.start ? `${formatDate(doc.start)}${end && end !== doc.start ? ` to ${formatDate(end)}` : ''}` : 'Dates not set yet'}
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
        actions={<OwnActions slug={slug} shareTitle={ourTitle ?? 'Trip'} url={publicUrl} onEdit={edit.start} onPrefetch={edit.prefetch} editing={edit.editing} loading={edit.loading} onDone={edit.done} tripMenu={edit.cover} onCalendar={doc.start && slug ? () => void calendar() : null} onAddDates={() => setSettings(true)} />}
      />
      <TripPlan
        slug={slug ?? id}
        model={pageModel as unknown as TripPageModel}
        title={title}
        depth="full"
        tabs={{ available, counts }}
        slots={slots}
        shape={null}
        source={source}
      />
    </article>
  );
  };

  const layer = {
    id, slug: slug ?? id, doc, save, title, ours: slug && plan?.ours ? { href: `/trips/${slug}/`, title: ourTitle ?? words(slug) } : null,
    model: (timelineModel ?? model.timeline) as unknown as TimelineModel, register, bookings: bookingRows, defaults, profile, start: doc.start ?? null, where: state.where, word: state.word, retry: state.retry, onSettings: openSettings,
  };
  return (
    <>
    <StopCount sections={model.sections} slug={slug} onCount={setEditedStops} />
    <EditHost marks={marks as Parameters<typeof EditHost>[0]['marks']} layer={layer}>
      {build}
    </EditHost>
    </>
  );
}