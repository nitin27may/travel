import { describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';
import { publicSentences, undatedTitle } from '@/lib/public/dateless';

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
