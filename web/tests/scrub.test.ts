import { describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';
import { publicSentences, undatedTitle } from '@/lib/public/dateless';
import { describesParty, publicParty, suitabilityFromTitle } from '@/lib/public/party';
import { publicOrigin } from '@/lib/public/origin';
import { DropLog, undatedSentences } from '@/lib/public/dateless';

describe('the shared public-text scrubber', () => {
  it('drops "Planned as" and stay ideas, whole, and never cuts inside a URL', () => {
    const note = 'Tre Cime di Lavaredo is the icon. Planned as dolomites-july-2027 (13-26 Jul 2027). Hotel idea: Chalet Alfoss https://www.hotelchaletalfoss.it/en/';
    expect(publicSentences(note)).toBe('Tre Cime di Lavaredo is the icon.');
  });
  it('strips a bare URL but keeps the rest of the sentence, and drops a sentence that was only a link', () => {
    const note = 'Easy loop (resort site https://www.example.com/a.b/c?x=1.5). Official: https://www.lemassif.com/en/lookout';
    expect(publicSentences(note)).toBe('Easy loop (resort site).');
    expect(publicSentences('See https://a.example/x.y for the rest.')).toBe('See for the rest.');
  });
  it('drops a dated sentence and a street address, keeps a decimal', () => {
    expect(publicSentences('Mont du Dome alone: 5.8 km, 358 m. Video dated 30 Sep 2025.')).toBe('Mont du Dome alone: 5.8 km, 358 m.');
    expect(publicSentences('Four days of colour. Base camp: 1592 Center Rd, Hyde Park, VT.')).toBe('Four days of colour.');
  });
  it('takes calendar dates out of a trip title', () => {
    expect(undatedTitle('Muskoka and Algonquin, 10–12 October 2026')).toBe('Muskoka and Algonquin');
    expect(undatedTitle('Argentine Patagonia: 13 nights, Feb-Mar 2027')).toBe('Argentine Patagonia: 13 nights');
    expect(undatedTitle('Dolomites')).toBe('Dolomites');
    expect(undatedTitle('Canadian Rockies')).toBe('Canadian Rockies');
  });
  it('leaves no summary or note on a public place with a plan link, stay idea, URL or calendar date', () => {
    for (const p of createPublicData().listPlaces()) {
      expect(p.summary, p.slug).not.toMatch(/planned as|hotel idea|https?:\/\/|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i);
    }
  });
  it('gives a saved place no summary and no note at all: the capture note stays at the source (backlog 2.3)', () => {
    const saved = createPublicData().internals.places.filter((p) => p.sources.length === 1 && p.sources[0] === 'locations');
    expect(saved.length).toBeGreaterThan(50);
    for (const p of saved) {
      expect(p.summary, p.slug).toBe('');
      expect(p.notes, p.slug).toBe('');
    }
  });
  it('lists trips with no date and no dated title', () => {
    for (const t of createPublicData().listTrips()) {
      expect(Object.keys(t)).not.toContain('date');
      expect(Object.keys(t)).not.toContain('dates');
      expect(t.title, t.slug).toBe(undatedTitle(t.title));
    }
  });
});

describe('the party scrubber: public text says who a plan suits, never who travelled', () => {
  it('turns the Rockies standfirst into a suitability statement', () => {
    expect(publicParty("Five bases. Every day has an adults' hike, a family hike and a shorter option for a child around 6.")).toBe(
      'Five bases. Every day has a longer hike, a family hike and a shorter option. The family version suits children from about 6.',
    );
  });
  it('makes the Patagonia title neutral and keeps the age as a suitability line', () => {
    expect(undatedTitle('Patagonia with kids 11+')).toBe('Argentine Patagonia');
    expect(undatedTitle('Iceland with kids 8+')).toBe('Iceland');
    expect(suitabilityFromTitle('Patagonia with kids 11+')).toBe('Suits ages 11 and up.');
    expect(suitabilityFromTitle('Dolomites, 13 nights')).toBe('');
  });
  it('rewrites split days as two groups', () => {
    expect(publicParty('Split day at Maligne Lake: one adult on the Bald Hills, the other adult and the child on the cruise.')).toBe(
      'Split day at Maligne Lake: the stronger walkers on the Bald Hills, the others on the cruise.',
    );
    expect(publicParty('one adult walks to Citadel Pass while the other adult and the child ride the gondola')).toBe('the stronger walkers walk to Citadel Pass while the others ride the gondola');
    expect(publicParty('Only if both adults want a fourth split.')).toBe('Only if the group wants a fourth split.');
  });
  it('removes party sizes and ages', () => {
    expect(publicParty('INFERENCE: a family of 3 cannot hike when the rule is mandatory')).not.toMatch(/family of 3/);
    expect(publicParty('Whether a 6-year-old counts toward four is a GAP.')).toBe('Whether a young child counts toward the four is a GAP.');
    expect(publicParty('one adult 19+ per canoe; 2 adults plus 2 children under 30 kg allowed')).toBe('one adult 19+ per canoe; children under 30 kg allowed');
  });
  it('keeps real fare and operator rules', () => {
    expect(publicParty('A 6-15 child pays youth fare (2026 blog: 50).')).toContain('child pays youth fare');
    expect(publicParty('Under 12 or under 106 cm must ride with an adult; the child fare is 16.')).toContain('the child fare is 16');
  });
  it('drops a sentence it has no rule for rather than publish it, and flags it', () => {
    expect(publicParty("Lovely lake. The child's body clock is 2 h ahead, so expect a crash around 19:00.")).toBe('Lovely lake.');
    expect(describesParty("The child's body clock is ahead")).toBe(true);
    expect(describesParty('Easy walk, suits children from about 6')).toBe(false);
  });
  it('keeps a building or a tree that is N years old (2.43)', () => {
    expect(publicParty('A 300-year-old church stands here.')).toBe('A 300-year-old church stands here.');
    expect(publicParty('The 800-year-old larch is the oldest in the valley.')).toBe('The 800-year-old larch is the oldest in the valley.');
    expect(publicParty('A 12-year-old tradition: the autumn fair.')).toBe('A 12-year-old tradition: the autumn fair.');
    expect(describesParty('A 300-year-old church stands here.')).toBe(false);
    // a child-sized age is still a party description when it names a person
    expect(describesParty('Pack snacks for the 7-year-old.')).toBe(true);
  });
  it('keeps "the child" when it is a fare, a carrier or an age condition (2.43)', () => {
    expect(publicParty('Bring the child carrier.')).toBe('Bring the child carrier.');
    expect(publicParty('Not suitable if the child is under 4.')).toBe('Not suitable if the child is under 4.');
    expect(publicParty('Book the child seat early.')).toBe('Book the child seat early.');
    // but "the child" as a traveller is still scrubbed
    expect(publicParty('Lovely lake. Keep the child hydrated.')).toBe('Lovely lake.');
    expect(publicParty('If the child is tired, turn back.')).toBe('If anyone is tired, turn back.');
  });
  it('keeps the source number in the fare rewrite (2.43)', () => {
    expect(publicParty('A 12-year-old pays the child fare.')).toBe('The child fare applies from age 12.');
    expect(publicParty('A 7-year-old pays the child fare on the gondola.')).toBe('The child fare applies from age 7 on the gondola.');
    expect(publicParty('A 12-year-old pays the child fare.')).not.toMatch(/age 6/);
  });
  it('starts a rewritten sentence with a capital (2.43)', () => {
    expect(publicParty('A family of 3 can share a room.')).toBe('A small group can share a room.');
    expect(publicParty('Rooms sleep a family of 4.')).toBe('Rooms sleep a small group.');
    expect(publicParty('Good value. One adult 19+ per canoe; one adult walks ahead.')).toBe('Good value. One adult 19+ per canoe; the stronger walkers walk ahead.');
    // a lowercase fragment stays lowercase
    expect(publicParty('one adult walks to Citadel Pass')).toBe('the stronger walkers walk to Citadel Pass');
  });
  it('logs every sentence it drops, with where it came from (2.43)', () => {
    const log = new DropLog();
    const out = publicParty("Lovely lake. The child's body clock is 2 h ahead. Pack snacks for the 7-year-old.", 'place lake-x summary', log);
    expect(out).toBe('Lovely lake.');
    expect(log.items.map((i) => i.text)).toEqual(["The child's body clock is 2 h ahead.", 'Pack snacks for the 7-year-old.']);
    expect(log.items.every((i) => i.where === 'place lake-x summary' && /household party/.test(i.why))).toBe(true);
    // the shared scrubber and publicOrigin pass the log through
    const log2 = new DropLog();
    expect(undatedSentences("Easy walk. The child's nap is at 13:00.", 'trip x note', log2)).toBe('Easy walk.');
    expect(log2.items).toHaveLength(1);
    expect(log2.items[0]!.where).toBe('trip x note');
    const log3 = new DropLog();
    expect(publicOrigin("Quiet. The child's snack.", 'where', log3)).toBe('Quiet.');
    expect(log3.items).toHaveLength(1);
  });
  it('logs nothing when the text is clean', () => {
    const log = new DropLog();
    publicParty('A 300-year-old church. Bring the child carrier.', 'x', log);
    expect(log.items).toEqual([]);
  });
  it('runs on every string through publicOrigin', () => {
    expect(publicOrigin('Patagonia with kids 11+')).toBe('Argentine Patagonia');
  });
  it('leaves no party wording on any public trip, place or title', () => {
    const data = createPublicData();
    const texts: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') texts.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(data.internals.trips);
    walk(data.internals.places);
    expect(texts.length).toBeGreaterThan(1000);
    expect(texts.filter(describesParty)).toEqual([]);
    expect(data.listTrips().map((t) => t.title).join('|')).not.toMatch(/kids|children|child/i);
  });
});
