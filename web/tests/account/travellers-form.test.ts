import { describe, expect, it } from 'vitest';
import { blankPerson, formFromTravellers, issuesOf, toTravellers, type TravellersForm } from '@/lib/account/travellers-form';

const TODAY = '2026-10-27';
const form = (f: Partial<TravellersForm>): TravellersForm => ({ adults: 2, adultAges: null, children: [], ...f });

describe('travellers form', () => {
  it('2 adults and 2 children with ages 7 and 9 become exactly the spec document', () => {
    const doc = toTravellers(form({ children: [{ ...blankPerson(), age: 7 }, { ...blankPerson(), age: 9 }] }), TODAY);
    expect(doc).toEqual({ schema: 'travellers/1', adults: 2, children: [{ age: 7, age_as_of: TODAY }, { age: 9, age_as_of: TODAY }] });
  });
  it('a date of birth gives the age and is kept', () => {
    const doc = toTravellers(form({ children: [{ age: null, dob: '2019-03-15', dobOpen: true }] }), TODAY);
    expect(doc?.children).toEqual([{ age: 7, age_as_of: TODAY, dob: '2019-03-15' }]);
  });
  it('names each issue: no age, future, 18 or older, adult under 18', () => {
    const i = issuesOf(
      form({
        children: [blankPerson(), { age: null, dob: '2027-01-01', dobOpen: true }, { age: null, dob: '2000-01-01', dobOpen: true }],
        adultAges: [{ ...blankPerson(), age: 12 }, blankPerson(), { ...blankPerson(), age: 150 }],
      }),
      TODAY,
    );
    expect(i.children).toEqual(['age', 'future', 'child_old']);
    expect(i.adults).toEqual(['adult_young', null, 'adult_old']);
    expect(toTravellers(form({ children: [blankPerson()] }), TODAY)).toBeNull();
  });
  it('blank adult ages are dropped; given ones are kept in order', () => {
    const doc = toTravellers(form({ adultAges: [blankPerson(), { ...blankPerson(), age: 40 }] }), TODAY);
    expect(doc?.adult_ages).toEqual([{ age: 40, age_as_of: TODAY }]);
    expect(toTravellers(form({ adultAges: [blankPerson(), blankPerson()] }), TODAY)?.adult_ages).toBeUndefined();
  });
  it('an existing document opens with its ages as they read today', () => {
    const f = formFromTravellers({ schema: 'travellers/1', adults: 2, children: [{ age: 6, age_as_of: '2025-09-01' }, { age: 8, age_as_of: '2025-09-01', dob: '2018-01-01' }] }, TODAY);
    expect(f.children.map((c) => c.age)).toEqual([7, 8]);
    expect(f.children[1]).toMatchObject({ dob: '2018-01-01', dobOpen: true });
  });
});
