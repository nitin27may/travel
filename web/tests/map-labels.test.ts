import { describe, expect, it } from 'vitest';
import { hideBasemapLabel } from '@/lib/map/maplibre/labels';

const LIGHT = ['label_other', 'label_village', 'label_town', 'label_state', 'label_city', 'label_city_capital', 'label_country_3', 'label_country_2', 'label_country_1'];
const DARK = ['place_other', 'place_suburb', 'place_village', 'place_town', 'place_city', 'place_city_large', 'place_state', 'place_country_other', 'place_country_minor', 'place_country_major'];
const hidden = (ids: string[], flags: Parameters<typeof hideBasemapLabel>[2]) => ids.filter((id) => hideBasemapLabel(id, 'place', flags));

describe('hideBasemapLabel', () => {
  it('hides towns and cities in both id sets', () => {
    expect(hidden(LIGHT, ['towns'])).toEqual(['label_town', 'label_city', 'label_city_capital']);
    expect(hidden(DARK, ['towns'])).toEqual(['place_town', 'place_city', 'place_city_large']);
  });
  it('hides regions and countries in both id sets', () => {
    expect(hidden(LIGHT, ['regions'])).toEqual(['label_state']);
    expect(hidden(DARK, ['regions'])).toEqual(['place_state']);
    expect(hidden(LIGHT, ['countries'])).toEqual(['label_country_3', 'label_country_2', 'label_country_1']);
    expect(hidden(DARK, ['countries'])).toEqual(['place_country_other', 'place_country_minor', 'place_country_major']);
  });
  it('does nothing without flags or outside the place source layer', () => {
    expect(hidden(DARK, undefined)).toEqual([]);
    expect(hideBasemapLabel('place_town', 'poi', ['towns'])).toBe(false);
  });
});
