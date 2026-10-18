// PeopleText renders colored names as data-kind spans inside a provider, and the plain string with
// no lexicon: the switch off (null), the game's preference off, or no provider at all.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { buildLexicon } from './lexicon';
import { GamePeopleProvider, PeopleProvider, PeopleText } from './PeopleText';
import { PEOPLE_COLOR_KEY, peopleColorOn, setPeopleColor } from './prefs';

const lexicon = buildLexicon({
  cast: { taker: { firstName: 'Malik', surname: 'Nwachukwu' }, courier: { firstName: 'Tamar', surname: 'Schreiber' }, owner: { firstName: 'Wiremu', surname: 'Banerjee' } },
  publicKind: { taker: 'subject', courier: 'civilian', owner: 'civilian' }, withheld: new Set(), located: new Set(['taker', 'courier', 'owner']),
  officers: [{ id: 'off_chen', firstName: 'Wen', surname: 'Liu', squad: 'A' }], places: [],
});
const TEXT = 'Liu waves Tamar out the front. Malik watches Tamar go.';
const render = (node: ReactNode) => renderToStaticMarkup(createElement('p', null, node));
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'");

/** A Storage stand-in, installed on globalThis for the preference. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, data };
}
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});
const install = (storage: unknown) => Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });

describe('PeopleText', () => {
  it('wraps each colored name in a data-kind span with its hover label, a glyph on first mention', () => {
    const html = render(createElement(PeopleProvider, { lexicon, children: createElement(PeopleText, { text: TEXT }) }));
    expect(html).toContain('<span class="people-name" data-kind="officer" data-person="off_chen" title="Squad A">');
    expect(html).toContain('data-kind="civilian" data-person="courier" title="Civilian"');
    expect(html).toContain('data-kind="subject" data-person="taker" title="Subject"');
    expect(html.match(/class="people-name"/g)).toHaveLength(4);
    // One glyph per person: Tamar's second mention has none.
    expect(html.match(/class="people-glyph"/g)).toHaveLength(3);
    expect(text(html)).toBe(TEXT);
  });

  it('renders the plain string with the switch off, outside a provider, and when nobody is named', () => {
    const plain = render(TEXT);
    expect(render(createElement(PeopleProvider, { lexicon: null, children: createElement(PeopleText, { text: TEXT }) }))).toBe(plain);
    expect(render(createElement(PeopleText, { text: TEXT }))).toBe(plain);
    expect(render(createElement(PeopleProvider, { lexicon, children: createElement(PeopleText, { text: 'Nobody here.' }) }))).toBe(render('Nobody here.'));
  });

  it('follows the game preference: on by default, off once the player turns it off', () => {
    install(fakeStorage());
    const game = () => render(createElement(GamePeopleProvider, { lexicon, children: createElement(PeopleText, { text: TEXT }) }));
    expect(peopleColorOn()).toBe(true);
    expect(game()).toContain('people-name');
    setPeopleColor(false);
    expect((globalThis.localStorage as unknown as ReturnType<typeof fakeStorage>).data.get(PEOPLE_COLOR_KEY)).toBe('0');
    expect(game()).toBe(render(TEXT));
    setPeopleColor(true);
    expect(game()).toContain('people-name');
  });

  it('reads a saved choice and survives blocked storage', () => {
    install(fakeStorage({ [PEOPLE_COLOR_KEY]: '0' }));
    expect(peopleColorOn()).toBe(false);
    install({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(peopleColorOn()).toBe(true);
    setPeopleColor(false);
    expect(peopleColorOn()).toBe(false);
    setPeopleColor(true);
    expect(peopleColorOn()).toBe(true);
  });
});
