'use client';

import { useState } from 'react';
import { CopyDayLink } from '@/components/actions/ShareButton';
import { DaySign } from '@/components/ui/DaySign';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { KindGlyph } from '@/components/ui/KindGlyph';
import { Segmented } from '@/components/ui/Segmented';
import { imageSrcSet, sizedImage } from '@/lib/format/image';
import type { DayRowModel, StopModel } from './model';
import { StopStats } from './StopStats';

interface Props {
  trip: { slug: string; title: string };
  day: DayRowModel;
  open: boolean;
  picked: boolean;
  onToggle: (n: number) => void;
}

const placeHref = (slug: string) => `/places/${slug}/`;

function StopList({ stops }: { stops: StopModel[] }) {
  if (!stops.length) return <p className="day-empty">No stops are planned for this day yet.</p>;
  return (
    <ol className="day-stops-full">
      {stops.map((s) => (
        <li key={s.id} className="stop">
          <span className="stop-time num">{s.time ?? ''}</span>
          <KindGlyph kind={s.kind} size="sm" />
          <div className="stop-main">
            <p className="stop-name">
              {s.placeSlug ? <a href={placeHref(s.placeSlug)}>{s.name}</a> : s.name}
              {s.variant ? <span className="stop-variant num"> Option {s.variant}</span> : null}
            </p>
            {s.access ? <p className="stop-access">{s.access}</p> : null}
            {s.stats ? <StopStats stats={s.stats} /> : null}
            {s.note ? <p className="stop-note">{s.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** One uniform day row (patterns 3.4): quiet DAY sign, thumbnail, title, base and drive, the stop list; opens to the stops. */
export function DayRow({ trip, day, open, picked, onToggle }: Props) {
  const [track, setTrack] = useState<'A' | 'B' | 'C' | null>(day.defaultTrack);
  const tracks = day.tracks;
  const shown = tracks ? (tracks.find((t) => t.id === track) ?? tracks[0]) : null;
  const names = (shown ? shown.stops : day.stops).map((s) => s.name);
  const meta = [day.base, day.drive ? `${day.drive} drive` : null].filter(Boolean).join(' · ');
  const panel = `day-${day.n}-panel`;
  return (
    <li id={`day-${day.n}`} className="day-row" data-open={open || undefined} data-picked={picked || undefined}>
      <h3 className="day-h">
        <button type="button" className="day-head" aria-expanded={open} aria-controls={panel} onClick={() => onToggle(day.n)}>
          <span className="day-thumb" aria-hidden="true">
            {day.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export, remote Commons URLs
              <img src={sizedImage(day.thumb.url, 192)} srcSet={imageSrcSet(day.thumb.url)} sizes="96px" alt="" width={192} height={136} loading="lazy" decoding="async" />
            ) : (
              <Icon name="mountain" size={22} />
            )}
          </span>
          <span className="day-main">
            <span className="day-top">
              <DaySign n={day.n} state={picked ? 'focused' : 'quiet'} size="s" />
              {meta ? (
                <span className="day-meta num" title={day.driveIsEstimate ? 'The drive time is an estimate: a straight line scaled to a road time' : undefined}>
                  {meta}
                </span>
              ) : null}
            </span>
            <span className="day-title">{day.title}</span>
            <span className="day-stops">{names.length ? names.join(' · ') : 'No stops planned yet'}</span>
            {tracks && !open ? <span className="day-options num">{tracks.length} options</span> : null}
          </span>
          <Icon name="chevronDown" size={18} className="day-chevron" />
        </button>
      </h3>
      <div id={panel} className="day-panel" hidden={!open}>
        {open ? (
          <>
            {day.summary ? <p className="day-summary">{day.summary}</p> : null}
            {day.drive ? (
              <p className="day-leg num">
                {day.base ? `From ${day.base}: ` : ''}drive {day.drive} in the day
                {day.driveIsEstimate ? <Chip kind="honest" className="day-leg-chip">Drive time estimated</Chip> : null}
              </p>
            ) : null}
            {tracks && shown ? (
              <>
                <Segmented
                  label={`Day ${day.n} options`}
                  size="s"
                  value={shown.id}
                  onChange={setTrack}
                  segments={tracks.map((t) => ({ value: t.id, label: `${t.id} · ${t.label}` }))}
                  className="day-tracks"
                />
                {shown.notes ? <p className="day-summary">{shown.notes}</p> : null}
                <StopList stops={shown.stops} />
              </>
            ) : (
              <StopList stops={day.stops} />
            )}
            <p className="day-share" data-print="hide" data-day-link={day.n}>
              <CopyDayLink trip={trip} day={day.n} />
            </p>
          </>
        ) : null}
      </div>
    </li>
  );
}
