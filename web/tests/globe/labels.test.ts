import { describe, expect, it } from 'vitest';
import { CITY_BANDS, NAME_FIELD, isNameLayer, planLabel, placeClassOf } from '@/lib/globe/labels';

const layer = (id: string, sl = 'place') => ({ id, type: 'symbol', 'source-layer': sl, layout: { 'text-field': ['get', 'name'] } });

describe('the label pass (spec 6.2, check 19)', () => {
  it('picks one script: English, then Latin, then the tile name', () => {
    expect(JSON.stringify(NAME_FIELD)).toBe('["coalesce",["get","name:en"],["get","name:latin"],["get","name"]]');
    for (const id of ['label_country_1', 'place_city', 'label_state', 'label_town']) {
      const p = planLabel(layer(id));
      expect(p.layout['text-field']).toBe(NAME_FIELD);
      expect(p.layout['text-transform']).toBe('none');
    }
    expect(planLabel(layer('water_name', 'water_name')).layout['text-transform']).toBe('none');
  });

  it('owns only the name layers of places, water and waterways', () => {
    expect(isNameLayer(layer('label_city'))).toBe(true);
    expect(isNameLayer(layer('highway-name-minor', 'transportation_name'))).toBe(false);
    expect(isNameLayer({ id: 'x', type: 'line', 'source-layer': 'place' })).toBe(false);
    expect(isNameLayer({ id: 'poi_r1', type: 'symbol', 'source-layer': 'poi', layout: { 'text-field': 'x' } })).toBe(false);
  });

  it('reads the class from the layer id in all three styles', () => {
    expect(['label_country_3', 'place_country_major', 'place_state', 'label_state', 'label_city_capital', 'place_city_large', 'label_town', 'place_village', 'place_suburb', 'place_other'].map(placeClassOf))
      .toEqual(['country', 'country', 'state', 'state', 'city', 'city', 'town', 'village', 'minor', 'minor']);
  });

  it('hides state names below zoom 5 and shows countries of rank 1 and 2 first', () => {
    expect(planLabel(layer('place_state')).minzoom).toBe(5);
    expect(planLabel(layer('label_country_3')).minzoom).toBe(2.5);
    expect(planLabel(layer('label_country_1')).minzoom).toBeUndefined();
    expect(planLabel(layer('place_country_other')).minzoom).toBe(2.5);
  });

  it('splits cities into rank bands that start at zoom 3, 4.5 and 6, and never repeats a rank', () => {
    const bands = planLabel(layer('label_city')).bands!;
    expect(bands.map((b) => b.minzoom)).toEqual([3, 4.5, 6]);
    expect(bands).toBe(CITY_BANDS);
    for (let i = 1; i < bands.length; i++) expect(bands[i].minRank).toBe(bands[i - 1].maxRank + 1);
  });

  it('drops suburbs, hamlets and the like; towns start at 7 and villages at 10', () => {
    expect(planLabel(layer('place_suburb')).hide).toBe(true);
    expect(planLabel(layer('label_other')).hide).toBe(true);
    expect(planLabel(layer('label_town')).minzoom).toBe(7);
    expect(planLabel(layer('label_village')).minzoom).toBe(10);
  });
});
