/* eslint-disable @next/next/no-img-element -- demo photos are local files */
'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ExportMenu } from '@/components/actions/ExportMenu';
import { ShareButton } from '@/components/actions/ShareButton';
import { CopySheet } from '@/components/actions/CopySheet';
import { Banner } from '@/components/ui/Banner';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Radio } from '@/components/ui/Checkbox';
import { Chip, IdentitySquare } from '@/components/ui/Chip';
import type { IdentityKey } from '@/components/ui/Chip';
import { Credits } from '@/components/ui/Credits';
import { DataTableShell } from '@/components/ui/DataTable';
import { DaySign } from '@/components/ui/DaySign';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterPill } from '@/components/ui/FilterPill';
import { Gallery } from '@/components/ui/Gallery';
import type { GalleryPhoto } from '@/components/ui/Gallery';
import { Icon } from '@/components/ui/Icon';
import { Field, Input, SearchInput } from '@/components/ui/Input';
import { KIND_LABELS, KindGlyph } from '@/components/ui/KindGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { Menu } from '@/components/ui/Menu';
import { Pager } from '@/components/ui/Pager';
import { Popover } from '@/components/ui/Popover';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { SeasonStrip } from '@/components/ui/SeasonStrip';
import { SideSheet } from '@/components/ui/SideSheet';
import { CardSkeleton, MapSkeleton, RowSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import photo1 from './photo-1.png';
import photo2 from './photo-2.png';
import photo3 from './photo-3.png';
import './specimen.css';

const P1 = photo1.src;
const P2 = photo2.src;
const P3 = photo3.src;

const SWATCHES: [string, string][] = [
  ['bg', 'page'], ['well', 'sunk'], ['surface', 'cards'], ['surface-2', 'quiet fill'], ['ink', 'text'], ['muted', 'meta'],
  ['accent', 'selected, now, primary'], ['crit', 'urgent'], ['warn', 'caution, text only'], ['ok', 'done, booked, fits'], ['info', 'notice'], ['header', 'chrome'],
];
const PAIRS: [string, string, string, string][] = [
  ['bg', 'ink', 'Ink on page', '14.85 / 15.28'],
  ['surface', 'muted', 'Muted on surface', '6.94 / 7.45'],
  ['accent', 'accent-ink', 'Accent ink on accent', '6.96 / 6.96'],
  ['bg', 'accent-text', 'Accent as text', '5.85 / 8.83'],
  ['crit-soft', 'crit', 'Urgent on its well', '5.45 / 6.36'],
  ['warn-soft', 'warn', 'Caution on its well', '6.11 / 7.84'],
  ['ok-soft', 'ok', 'Ok on its well', '5.53 / 7.87'],
  ['info-soft', 'info', 'Notice on its well', '5.91 / 7.61'],
];
const IDENTITIES: [IdentityKey, string, string][] = [
  ['blue', 'Dolomites', P1], ['orange', 'Patagonia', P2], ['rose', 'Elora', P3], ['teal', 'Costa Rica', P1], ['sky', 'Iceland', P2], ['yellow', 'Chamonix', P3], ['vermillion', 'Rockies', P1],
];
const KINDS = Object.keys(KIND_LABELS);
const PHOTOS: GalleryPhoto[] = [
  { url: P1, caption: 'Lago di Misurina', title: 'Lago di Misurina', author: 'Sample photo', licence: 'CC0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { url: P2, caption: 'Fitz Roy at sunrise', title: 'Fitz Roy', author: 'Sample photo', licence: 'CC0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { url: P3, caption: 'Elora Gorge', title: 'Elora Gorge', author: 'Sample photo', licence: 'CC0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
];

const KIND_OPTIONS = [
  { value: 'trail', label: 'Trail', count: 18 }, { value: 'lake', label: 'Lake', count: 9 }, { value: 'viewpoint', label: 'Viewpoint', count: 6 },
  { value: 'stay', label: 'Stay', count: 4 }, { value: 'lift', label: 'Lift', count: 3 }, { value: 'eatery', label: 'Eatery', count: 3 },
  { value: 'sight', label: 'Sight', count: 2 }, { value: 'parking', label: 'Parking', count: 0 }, { value: 'waterfall', label: 'Waterfall', count: 5 },
];

function Section({ id, title, why, children }: { id: string; title: string; why?: string; children: ReactNode }) {
  return (
    <section id={id}>
      <h2 className="sec">{title}</h2>
      {why ? <p className="why">{why}</p> : null}
      {children}
    </section>
  );
}
const Tag = ({ children }: { children: ReactNode }) => <span className="tag">{children}</span>;
const arrow = <Icon name="chevronDown" size={14} />;

export function Specimen() {
  const { toast } = useToast();
  const [seg, setSeg] = useState('cards');
  const [days, setDays] = useState('all');
  const [density, setDensity] = useState('comfortable');
  const [by, setBy] = useState('day');
  const [q, setQ] = useState('');
  const [kinds, setKinds] = useState<string[]>(['trail', 'lake', 'stay']);
  const [country, setCountry] = useState<string[]>([]);
  const [sw1, setSw1] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [relief, setRelief] = useState(1.3);
  const [sheet, setSheet] = useState(false);
  const [bottom, setBottom] = useState(false);
  const [copy, setCopy] = useState(false);
  const [page, setPage] = useState(2);

  return (
    <div className="specimen">
      <header className="page-head">
        <h1>Specimen</h1>
        <p className="lede">Every foundation component in every state. Compare with docs/v2/design/foundation/specimen.html.</p>
      </header>

      <Section id="colour" title="COLOUR" why="Roles, not names. Every text pair is in tokens.md with its ratio; the lowest allowed pair is 5.45:1.">
        <div className="sw">
          {SWATCHES.map(([t, r]) => (
            <div key={t}>
              <i style={{ background: `var(--${t})` }} />
              <b>--{t}</b>
              <span>{r}</span>
            </div>
          ))}
        </div>
        <div className="pairs">
          {PAIRS.map(([bg, fg, label, ratio]) => (
            <div key={label} style={{ background: `var(--${bg})`, color: `var(--${fg})`, border: '1px solid var(--line)' }}>
              {label}
              <small>{ratio}</small>
            </div>
          ))}
        </div>
      </Section>

      <Section id="identity" title="TRIP IDENTITY" why="Okabe-Ito. Ring, bar or square, always with a 1 px keyline, within 8 px of the photo or name. Never text, never a fill, never on the map.">
        <div className="row-flex" style={{ gap: 18 }}>
          {IDENTITIES.map(([k, , src]) => (
            <img key={k} className="ring" style={{ ['--tc' as string]: `var(--id-${k})` }} src={src} alt="" />
          ))}
        </div>
        <div className="row-flex" style={{ font: 'var(--t-mono)' }}>
          {IDENTITIES.map(([k, name]) => (
            <span key={k}>
              <IdentitySquare identity={k} /> {name}
            </span>
          ))}
          <span>
            <IdentitySquare identity="none" /> done or idea
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {IDENTITIES.map(([k]) => (
            <div key={k} className="idbar" style={{ ['--tc' as string]: `var(--id-${k})` }} />
          ))}
        </div>
      </Section>

      <Section id="type" title="TYPE" why="Big Shoulders at nine sizes only. Source Serif 4 for reading. IBM Plex Mono for one-line labels, numbers and controls.">
        <div className="type">
          <div><span className="lab">cover 96</span><span className="d-96">DOLOMITES</span></div>
          <div><span className="lab">page 72</span><span className="d-72">PLACES</span></div>
          <div><span className="lab">trip 40</span><span className="d-40">PATAGONIA</span></div>
          <div><span className="lab">section 32</span><span className="d-32">NEEDS YOU THIS WEEK</span></div>
          <div><span className="lab">card 24</span><span className="d-24">Chamonix and Mont Blanc</span></div>
          <div><span className="lab">row 21</span><span className="d-21">Patagonia</span></div>
          <div><span className="lab">sign 19 and 15</span><span className="row-flex"><DaySign n={3} state="focused" /><DaySign n={4} /><DaySign n={5} size="s" /></span></div>
          <div><span className="lab">leave 78</span><span className="d-78">08:10</span></div>
          <div><span className="lab">body 16, body-l 19</span><span>Three valley bases, early starts at the famous lakes, a Sass Pordoi day. <span className="s-body-l">A rental car throughout.</span></span></div>
          <div><span className="lab">title 17, note 15.5</span><span><b className="s-title">Lago di Braies</b> <span className="s-note">Sunrise 05:32; alpenglow on the Seekofel first</span></span></div>
          <div><span className="lab">mono 13, meta 12.5, cap 11.5</span><span className="row-flex"><span className="m-mono">Save to Patagonia</span><span className="m-meta">13 – 26 Jul 2027 · 13 nights · Italy</span><span className="m-cap">In progress · soonest first</span><span className="m-time">11:30</span><span className="m-tab">tab 13.5</span></span></div>
        </div>
      </Section>

      <Section id="buttons" title="BUTTONS" why="Primary once per view. Labels are verbs, three words at most.">
        <div className="col">
          <div className="row-flex">
            <Button variant="primary">Plan a trip</Button><Button>Forward a confirmation</Button><Button variant="ghost">Cancel</Button><Button variant="danger">Delete trip</Button>
            <Button icon aria-label="Notifications"><Icon name="bell" /></Button><Tag>default</Tag>
          </div>
          <div className="row-flex">
            <Button variant="primary" className="is-hover">Plan a trip</Button><Button className="is-hover">Forward a confirmation</Button><Button variant="ghost" className="is-hover">Cancel</Button><Tag>hover</Tag>
          </div>
          <div className="row-flex">
            <Button variant="primary" className="is-focus">Plan a trip</Button><Button className="is-focus">Forward a confirmation</Button><Button variant="danger" className="is-focus">Delete trip</Button><Tag>focus-visible: 2 px ink ring, 2 px gap</Tag>
          </div>
          <div className="row-flex">
            <Button variant="primary" className="is-pressed">Plan a trip</Button><Button className="is-pressed">Forward a confirmation</Button><Tag>pressed</Tag>
          </div>
          <div className="row-flex">
            <Button variant="primary" disabled>Plan a trip</Button><Button disabled>Forward a confirmation</Button>
            <Button variant="primary" loading style={{ width: 122 }}>Plan a trip</Button><Tag>disabled, loading (width locked)</Tag>
          </div>
          <div className="row-flex">
            <Button variant="primary" size="lg"><Icon name="navigate" /> Navigate</Button><Button size="lg">Slot HB-5521</Button><Button size="sm" variant="primary">Add</Button><Button size="sm">Snooze</Button>
            <Button size="sm" icon aria-label="Done"><Icon name="check" /></Button><ButtonLink href="/trips/" size="sm">As a link</ButtonLink><Tag>lg 50, sm 30</Tag>
          </div>
        </div>
      </Section>

      <Section id="inputs" title="INPUTS">
        <div className="two">
          <Field label="Property">{(p) => <Input {...p} placeholder="Search the catalogue or type a name" />}</Field>
          <Field label="Airline and route">{(p) => <Input {...p} defaultValue="Air Canada · YYZ → EZE" autoFocus={false} />}</Field>
          <Field label="Departs, Toronto time" help="Arrives Sat 27 Feb 11:05 Buenos Aires · +1">{(p) => <Input {...p} mono defaultValue="Fri 26 Feb 2027 23:50" />}</Field>
          <Field label="Total" error="Use digits only: 5,400">{(p) => <Input {...p} mono error defaultValue="CAD 5,4OO" />}</Field>
          <Field label="Confirmation code">{(p) => <Input {...p} mono readOnly defaultValue="•••• ••••" suffix="Reveal" />}</Field>
          <Field label="Travellers">{(p) => <Input {...p} disabled defaultValue="Nitin, Partner, Aarav" />}</Field>
          <Field label="Distance">{(p) => <Input {...p} mono defaultValue="12.5" suffix="km" />}</Field>
          <Field label="Checking the code">{(p) => <Input {...p} mono loading defaultValue="HB-5521" />}</Field>
          <Field label="Group by">{(p) => (<Select {...p} defaultValue="when"><option value="when">When</option><option value="country">Country</option></Select>)}</Field>
          <Field label="Select, compact">{(p) => (<Select {...p} compact defaultValue="x"><option value="x">Choose…</option><option value="a">Soonest first</option></Select>)}</Field>
          <div className="col">
            <span className="field-label">Search with /</span>
            <SearchInput value={q} onChange={setQ} label="Search places" placeholder="Search places" shortcut status={q ? `${q.length} matches` : ''} />
            <Tag>type to see the clear button; Esc clears then blurs</Tag>
          </div>
          <div className="col">
            <span className="field-label">Kind (chip radios)</span>
            <div className="row-flex"><Chip kind="active" icon="flight">Flight</Chip><Chip>Stay</Chip><Chip>Car</Chip><Chip>Activity</Chip></div>
          </div>
        </div>
      </Section>

      <Section id="toggles" title="TOGGLES">
        <div className="row-flex" style={{ gap: 28 }}>
          <Checkbox>Costs</Checkbox><Checkbox defaultChecked>Plan</Checkbox><Checkbox indeterminate readOnly>Some</Checkbox><Checkbox disabled>Codes</Checkbox>
          <Radio name="who" defaultChecked>Members</Radio><Radio name="who">Anyone with the link</Radio>
          <Switch checked={sw1} onCheckedChange={setSw1}>3D terrain</Switch><Switch checked={sw2} onCheckedChange={setSw2}>Auto-spin</Switch>
          <Switch checked={false} onCheckedChange={() => undefined} disabled note="Off: reduced motion">Auto-spin</Switch>
        </div>
        <div className="row-flex"><Slider label="Relief strength" value={relief} onValueChange={setRelief} min={0.5} max={2} step={0.1} format={(v) => `${v.toFixed(1)}×`} /><Tag>slider: relief strength</Tag></div>
      </Section>

      <Section id="pills" title="PILLS, CHIPS, SEGMENTS, SEARCH">
        <div className="col">
          <div className="row-flex pill-list">
            <FilterPill label="Country" options={[{ value: 'it', label: 'Italy', count: 10 }, { value: 'ca', label: 'Canada', count: 22 }, { value: 'us', label: 'United States', count: 25 }]} selected={country} onChange={setCountry} mode="single" />
            <FilterPill label="Kind" options={KIND_OPTIONS} selected={kinds} onChange={setKinds} />
            <span className="pill is-hover"><button type="button" className="pill-trigger">Status {arrow}</button></span>
            <span className="pill"><button type="button" className="pill-trigger is-focus">Kids {arrow}</button></span>
            <Tag>filter pills: default, active, hover, focus (open one for the menu with counts and search)</Tag>
          </div>
          <div className="row-flex">
            <Chip>In 131 days</Chip><Chip kind="trip" identity="orange">Booking</Chip><Chip kind="kind" icon="trail">Trail</Chip><Chip>Jun to Oct</Chip><Chip>Kid friendly</Chip><Chip kind="active" onRemove={() => undefined} removeLabel="Remove filter Plan: Dolomites">Plan: Dolomites</Chip>
            <Tag>neutral, phase with identity, kind, active filter</Tag>
          </div>
          <div className="row-flex">
            <Chip kind="toBook">To book</Chip><Chip kind="caution">Window open</Chip><Chip kind="urgent">Opens Mon 19 Oct</Chip><Chip kind="caution" icon="clock">Due Sat 31 Oct</Chip><Chip kind="held">Held</Chip><Chip kind="ok">Booked</Chip><Chip kind="ok">Aarav, 10 fits</Chip><Chip kind="idea">Idea</Chip>
            <Chip kind="honest">Unverified</Chip><Chip kind="honest">No source yet</Chip><Chip kind="honest">Location unconfirmed</Chip><Chip kind="honest">Dates open</Chip><Chip kind="notice" icon="wifiOff">Offline</Chip><Chip kind="notice">Read-only</Chip><Chip kind="trip" identity="blue" photo={P1}>Dolomites</Chip>
          </div>
          <div className="row-flex">
            <Segmented label="View" value={seg} onChange={setSeg} segments={[{ value: 'cards', label: 'Cards', icon: 'cards' }, { value: 'list', label: 'List', icon: 'list' }, { value: 'table', label: 'Table', icon: 'table' }, { value: 'map', label: 'Map', icon: 'map', disabled: true, title: 'Map view arrives in the next release' }]} />
            <Segmented label="Days" size="s" value={days} onChange={setDays} segments={[{ value: 'all', label: 'All 14 days' }, { value: '3', label: 'Day 03' }, { value: 'bases', label: 'Bases' }]} />
            <Segmented label="Density" size="s" value={density} onChange={setDensity} segments={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }]} />
            <Segmented label="Grouping" size="s" value={by} onChange={setBy} segments={[{ value: 'day', label: 'By day' }, { value: 'category', label: 'By category' }]} />
          </div>
          <div className="row-flex">
            <span style={{ font: 'var(--t-section)', color: 'var(--accent-text)' }}>57 <small style={{ font: 'var(--t-mono)', color: 'var(--muted)' }}>places</small></span>
            <Breadcrumbs items={[{ label: 'Places', href: '/places/' }, { label: 'Italy', href: '/places/?country=IT' }, { label: 'Sesto Dolomites' }]} />
          </div>
          <div className="row-flex"><SeasonStrip months={['closed', 'closed', 'possible', 'possible', 'possible', 'open', 'open', 'open', 'open', 'open', 'possible', 'closed']} /><Tag>season strip: solid as written, hatched possible</Tag></div>
        </div>
      </Section>

      <Section id="chrome" title="HEADER, BOTTOM BAR" why="The real header is at the top of this page; these are static copies of the public variant and the phone bottom bar.">
        <div className="chrome">
          <div className="site-header">
            <div className="site-header-inner">
              <span className="brand">Trip Plans</span>
              <nav className="site-nav" aria-label="Specimen tabs"><a href="#chrome" aria-current="page">Trips</a><a href="#chrome">Places</a><a href="#chrome">Globe</a></nav>
              <div className="header-tools">
                <Button variant="ghost" icon aria-label="Search (specimen)"><Icon name="search" size={18} /></Button>
                <Button variant="ghost" icon aria-label="Theme (specimen)"><Icon name="sun" size={18} /></Button>
                <Button variant="ghost">Sign in</Button>
              </div>
            </div>
          </div>
        </div>
        <Tag>public header: no trip chip, no bell</Tag>
        <div className="phone">
          <div className="phone-body" />
          <nav className="bottom-bar" aria-label="Bottom bar (specimen)">
            <a href="#chrome" aria-current="page"><Icon name="cards" size={22} />Trips</a><a href="#chrome"><Icon name="pin" size={22} />Places</a><a href="#chrome"><Icon name="globe" size={22} />Globe</a><a href="#chrome"><Icon name="signin" size={22} />Sign in</a>
          </nav>
        </div>
      </Section>

      <Section id="menus" title="MENUS, POPOVER, TOAST">
        <div className="row-flex" style={{ alignItems: 'flex-start', gap: 24 }}>
          <div className="col">
            <Menu trigger={<>Menu <Icon name="chevronDown" size={14} /></>} triggerClassName="btn" entries={[{ label: 'Move to…', icon: 'swap', shortcut: 'M' }, { label: 'Set time', shortcut: 'T' }, { label: 'Who is going' }, { label: 'Duplicate' }, { label: 'Remove from Day 3', destructive: true, separatorBefore: true }]} />
            <Tag>menu: 40 px items, destructive last</Tag>
          </div>
          <Popover trigger={<>Popover <Icon name="chevronDown" size={14} /></>} triggerClassName="btn" label="Example popover">
            <p className="popover-title">Anchored, arrow-free</p>
            <p className="small">Esc closes it and focus returns to the button.</p>
          </Popover>
          <div className="toast-demo">
            <Button onClick={() => toast({ message: 'Moved Seceda to Day 12', actionLabel: 'Undo', onAction: () => undefined })}>Show toast with Undo</Button>
            <Button onClick={() => toast({ message: 'Dolomites stays on Bookings, Day 9', actionLabel: 'Back', onAction: () => undefined, duration: 8000 })}>Show switch toast</Button>
          </div>
        </div>
        <div className="row-flex">
          <div className="toast" style={{ position: 'static' }}>Moved Seceda to Day 12 · <a href="#menus" style={{ color: 'inherit' }}>Undo</a></div>
          <div className="toast" style={{ position: 'static' }}>Link copied</div>
        </div>
      </Section>

      <Section id="cards" title="CARDS">
        <div className="cards4">
          <Card variant="trip" identity="orange" photo={P2} title="Patagonia" meta="26 Feb – 11 Mar 2027 · 13 nights · Argentina · 4 bases · Ushuaia first"
            chips={<div className="chips"><Chip>In 131 days</Chip><Chip kind="trip" identity="orange">Booking</Chip></div>} summary="Thirteen nights: Ushuaia and the penguins first, then El Chaltén and Fitz Roy, then Perito Moreno."
            footer={<span className="src"><Icon name="clock" size={14} /> Book the flight · Sat 31 Oct</span>} />
          <Card variant="place" idea fallbackIcon="waterfall" fallbackLabel="Waterfall" title="Grand-Sault waterfall" meta="Bas-Saint-Laurent / Gaspésie (to confirm), Quebec, Canada"
            chips={<div className="chips"><Chip kind="kind" icon="waterfall">Waterfall</Chip><Chip kind="idea">Idea</Chip><Chip kind="honest">Location unconfirmed</Chip></div>}
            summary="Gaspésie road trip stop 4. Several waterfalls share this name and the post does not say which."
            footer={<><span className="src">No source yet</span><span className="card-links"><a href="#cards">Place page</a><a href="#cards">Globe</a></span></>} />
          <Card variant="publicTrip" selected photo={P1} title="Dolomites" meta="13 – 26 Jul 2027 · 13 nights · Italy · 4 bases" chips={<div className="chips"><Chip>In 268 days</Chip></div>} summary="Fourteen days built backwards from what governs them." />
          <CardSkeleton />
        </div>
        <Tag>trip card (identity bar) · place card without photo · selected (map sync) · skeleton</Tag>
        <div className="cards4">
          <Card variant="trail" photo={P3} focus={{ x: 50, y: 70 }} title="Tre Cime di Lavaredo loop" meta="Auronzo, Belluno · 10 km · 450 m" chips={<div className="chips"><Chip kind="kind" icon="trail">Trail</Chip><Chip kind="ok">Fits Aarav</Chip></div>} />
          <Card variant="trip" done photo={P3} identity="none" title="Quebec" meta="Sept 2026 · 2 nights" chips={<div className="chips"><Chip kind="notice">Past trip</Chip></div>} />
        </div>
        <Tag>trail card with a photo focus point · done trip, photo desaturated</Tag>
      </Section>

      <Section id="rows" title="ROWS">
        <ul className="rows">
          <ListRow kind="trail" title="Tre Cime di Lavaredo loop" meta="Auronzo, Belluno · 10 km · 450 m" chips={<Chip>Day 3 · 11:30</Chip>} />
          <ListRow kind="stay" title="Hotel, San Candido · nights 1-4" meta="In 13 Jul 15:00 · out 17 Jul 10:00" chips={<Chip kind="ok">Booked</Chip>} className="demo-row-hover" />
          <ListRow kind="viewpoint" title="Seceda ridge" meta="Val Gardena, South Tyrol · 2,519 m" chips={<Chip>Day 12</Chip>} selected />
          <RowSkeleton />
        </ul>
        <Tag>list rows: default · hover · selected · loading</Tag>
        <div className="row-flex">
          {KINDS.map((k) => (
            <span key={k} className="row-flex" style={{ gap: 6, font: 'var(--t-chip)' }}>
              <KindGlyph kind={k} /> {KIND_LABELS[k]}
            </span>
          ))}
        </div>
        <div className="row-flex"><KindGlyph kind="lake" size="md" /><KindGlyph kind="trail" size="lg" /><Tag>kind glyph 26, 44, 56</Tag></div>
      </Section>

      <Section id="table" title="DATA TABLE">
        <DataTableShell
          density="comfortable"
          tools={
            <>
              <Button size="sm"><Icon name="layers" size={15} /> Saved views</Button><Button size="sm"><Icon name="columns" size={15} /> Columns</Button>
              <Segmented label="Density (demo)" size="s" value={density} onChange={setDensity} segments={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }]} />
              <Button size="sm"><Icon name="download" size={15} /> Export CSV</Button>
            </>
          }
        >
          <table className="data-table">
            <thead><tr><th scope="col"><span className="th-plain">Name</span></th><th scope="col"><span className="th-plain">Kind</span></th><th scope="col"><span className="th-plain">Status</span></th><th scope="col" aria-sort="ascending"><span className="th-btn">Area <Icon name="chevronDown" size={12} className="th-caret on flip" /></span></th><th scope="col"><span className="th-plain">Season</span></th><th scope="col" data-align="right"><span className="th-plain">Elevation</span></th></tr></thead>
            <tbody>
              <tr className="grp-row"><th colSpan={6} scope="rowgroup"><span className="grp-toggle"><Icon name="chevronRight" size={14} className="grp-caret" /><span className="gh-title">Italy</span><span className="gh-count num">10 of 10</span></span></th></tr>
              <tr data-row><td><span className="cell-name">Lago di Braies</span></td><td><span className="cell-icon"><Icon name="lake" size={14} />Lake</span></td><td><span className="cell-icon" data-status="planned"><Icon name="stPlanned" size={14} />Planned</span></td><td>Braies, South Tyrol</td><td>Jun to Oct</td><td data-align="right">1,496 m</td></tr>
              <tr data-row><td><span className="cell-name">Lago di Carezza</span> <Chip kind="honest">No source yet</Chip></td><td><span className="cell-icon"><Icon name="lake" size={14} />Lake</span></td><td><span className="cell-icon" data-status="idea"><Icon name="stIdea" size={14} />Idea</span></td><td>Val d&apos;Ega, South Tyrol</td><td>May to Oct</td><td data-align="right">1,520 m</td></tr>
              <tr data-row><td><span className="cell-name">Seceda ridge</span></td><td><span className="cell-icon"><Icon name="eye" size={14} />Viewpoint</span></td><td><span className="cell-icon" data-status="visited"><Icon name="stVisited" size={14} />Done</span></td><td>Val Gardena, South Tyrol</td><td>Jun to Oct</td><td data-align="right">2,519 m</td></tr>
              <tr className="grp-row"><th colSpan={6} scope="rowgroup"><span className="grp-toggle"><Icon name="chevronRight" size={14} className="grp-caret" /><span className="gh-title">Canada</span><span className="gh-count num">22 · collapsed</span></span></th></tr>
            </tbody>
          </table>
        </DataTableShell>
        <Pager page={page} pageSize={48} total={120} onPage={setPage} />
      </Section>

      <Section id="overlays" title="SHEETS, BANNERS, STATES">
        <div className="row-flex">
          <Button onClick={() => setSheet(true)}>Open side sheet</Button>
          <Button onClick={() => setBottom(true)}>Open bottom sheet</Button>
          <Button onClick={() => setCopy(true)}>Open copy sheet (stub)</Button>
          <ExportMenu target={{ type: 'trip', slug: 'dolomites-2027' }} formats={['pdf', 'ics', 'gpx', 'csv']} />
          <ShareButton url="https://example.invalid/trips/dolomites-2027" title="Dolomites" />
        </div>
        <div className="static-sheet" style={{ ['--tc' as string]: 'var(--id-orange)' }}>
          <div className="sheet-photo" style={{ ['--tc' as string]: 'var(--id-orange)' }}>
            <div className="sheet-media"><img src={P2} alt="" /></div>
            <div className="sheet-photo-text"><p className="sheet-kicker">New booking in Patagonia</p><h3 className="sheet-heading">TORONTO → BUENOS AIRES</h3></div>
          </div>
          <div className="sheet-body"><Field label="Airline and route">{(p) => <Input {...p} defaultValue="Air Canada · YYZ → EZE" />}</Field></div>
          <div className="sheet-foot"><Button variant="primary">Save to Patagonia</Button><Button>Cancel</Button><span className="field-label" style={{ marginLeft: 'auto' }}>Ctrl Z undoes</span></div>
        </div>
        <Tag>side sheet, as drawn (460 px, 140 px photo header)</Tag>
        <div className="col" style={{ maxWidth: 720 }}>
          <Banner kind="next" action={<Button size="sm">Bookings</Button>}>Next: Ortisei stay by Mon 15 Mar · Tre Cime slot opens Tue 15 Jun</Banner>
          <Banner kind="urgent"><b>Arrive 10:45.</b> Check-in for the 10:30 slot closes 10:15.</Banner>
          <Banner kind="caution">Day 4 drives 2 h 40, over the trip&apos;s 2 h pace. Swap Croda del Becco with Day 6?</Banner>
          <Banner kind="notice" icon="user">Priya moved Lake Agnes to Day 4 · just now</Banner>
          <Banner kind="offline">Offline. Day 3 saved 07:12 today: map, slot code, parking, huts.</Banner>
          <Banner kind="override" icon={false} action={<Button size="sm">Dolomites</Button>}><IdentitySquare identity="blue" /> Opened <b>Elora</b>, the trip you are on today. You were planning Dolomites.</Banner>
        </div>
        <div className="two">
          <EmptyState glyph="stay" title="No stays yet" why="Where you sleep sets every day's driving." action={<Button variant="primary">Add the first stay</Button>} as="h3" />
          <ErrorState title="We couldn't load the places." detail="Try again or keep reading the 57 saved offline." onRetry={() => undefined} cached={<Chip kind="notice">Showing cached · 2 h ago</Chip>} />
        </div>
        <div className="two">
          <div className="col"><Skeleton height={24} width="60%" /><Skeleton height={12} width="80%" /><Skeleton height={16} /></div>
          <MapSkeleton />
        </div>
      </Section>

      <Section id="gallery" title="GALLERY, CREDITS">
        <Gallery photos={PHOTOS} />
        <Credits photos={PHOTOS} />
      </Section>

      <SideSheet open={sheet} onOpenChange={setSheet} title="TRE CIME DI LAVAREDO" kicker="Trail · Auronzo · Sesto Dolomites" modal media={<img src={P1} alt="" />} identity="blue" footer={<><Button variant="primary" onClick={() => setSheet(false)}>Save to Dolomites</Button><Button onClick={() => setSheet(false)}>Cancel</Button></>}>
        <p>Focus moves to the title on open and returns to the button on close. Esc closes.</p>
        <Field label="Note">{(p) => <Input {...p} placeholder="Add a note" />}</Field>
      </SideSheet>
      <BottomSheet open={bottom} onOpenChange={setBottom} title="Day 03 route" initial="half">
        <p>Drag the sheet to the peek, half and full stops, or use Expand and Collapse.</p>
        <Chip kind="neutral">Tre Cime</Chip>
      </BottomSheet>
      <CopySheet open={copy} onClose={() => setCopy(false)} trip={{ slug: 'dolomites-2027', title: 'Dolomites', nights: 13, days: 14 }} />
    </div>
  );
}
