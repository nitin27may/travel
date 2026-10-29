'use client';

// "In your copy of Canadian Rockies · Day 5" on a place page (gap-analysis 2.4; STEP2-P1). Computed on the device from Mine's stored
// copies: a copy that holds the place on a day, or a copy of a public trip that uses it. It never fetches a document (P8, P9), and a day
// from the public plan carries "≈ your copy may differ". Loaded after hydration as its own chunk; draws nothing when there is no match.
import Link from 'next/link';
import { COPIES_KEY, readCopies } from '@travel/core/schema/copies.ts';
import { useState } from 'react';
import { mineStorage } from '@/lib/mine/storage';
import { openTripHref } from '@/lib/trip-edit/keys';
import { inYourTrips, type InLine } from './rows';
import './trip-picker.css';

const SHOWN = 2;

function read(slug: string, publicTrips: readonly string[], planDays: Readonly<Record<string, number>>): InLine[] {
  try {
    const s = mineStorage().storage;
    const r = readCopies(s.getItem(COPIES_KEY));
    return r.ok ? inYourTrips(r.envelope.items, slug, publicTrips, s, planDays) : [];
  } catch {
    return [];
  }
}

export function InYourTrips({ slug, publicTrips, planDays = {} }: { slug: string; publicTrips: readonly string[]; planDays?: Readonly<Record<string, number>> }) {
  const [lines] = useState(() => read(slug, publicTrips, planDays));
  if (!lines.length) return null;
  const shown = lines.slice(0, SHOWN);
  return (
    <p className="tpk-in">
      {shown.map((l, i) => (
        <span key={l.id} className="tpk-in-line">
          {i ? ' · ' : ''}
          In your copy of <Link href={openTripHref(l.id)} prefetch={false}>{l.title}</Link>
          {l.day !== null ? ` · Day ${l.day}` : l.planDay !== null ? <span className="tpk-in-note"> · ≈ Day {l.planDay} in our plan</span> : <span className="tpk-in-note"> · ≈ your copy may differ</span>}
        </span>
      ))}
      {lines.length > SHOWN ? <span className="tpk-in-more"> and {lines.length - SHOWN} more</span> : null}
    </p>
  );
}
