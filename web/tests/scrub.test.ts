import { describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';
import { publicSentences, undatedTitle } from '@/lib/public/dateless';
import { describesParty, publicParty, suitabilityFromTitle } from '@/lib/public/party';
import { publicOrigin } from '@/lib/public/origin';

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
