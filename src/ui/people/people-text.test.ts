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
  officers: [{ id: 'off_chen', firstName: 'Wen', surname: 'Liu', squad: 'A', squadName: 'Night Owls' }], places: [],
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
  it('wraps each colored name in a data-kind span with its hover label, and no symbol in prose', () => {
    const html = render(createElement(PeopleProvider, { lexicon, children: createElement(PeopleText, { text: TEXT }) }));
    expect(html).toContain('<span class="people-name" data-kind="officer" data-person="off_chen" title="Night Owls">');
    expect(html).toContain('data-kind="civilian" data-person="courier" title="Civilian"');
    expect(html).toContain('data-kind="subject" data-person="taker" title="Subject"');
    expect(html.match(/class="people-name"/g)).toHaveLength(4);
    // Owner, 2026-10-20: "The symbols should not appear in prose."
    expect(html).not.toContain('people-glyph');
    expect(html).not.toContain('<svg');
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

// Every surface that sets call text goes through PeopleText (or the lab's script view, which copies
// its markup), so a symbol in prose can only come back through one of these files or through a new
// caller of PeopleGlyph. The glyph stays only where a name stands alone as a label.
const SOURCES = import.meta.glob(['/src/**/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
// Person tiles in the game, and the lab's people list: a name standing alone as a label.
const LABEL_USERS = ['/src/dev/lab/surfaces/play/XrayRail.tsx', '/src/ui/components/IncidentPeople.tsx', '/src/ui/screens/PrepBriefing.tsx'];

describe('no symbol inside prose', () => {
  it('uses PeopleGlyph only on person labels, never inside a people-name span', () => {
    const users = Object.entries(SOURCES).filter(([, src]) => /<PeopleGlyph\b/.test(src)).map(([file]) => file).sort();
    expect(users).toEqual(LABEL_USERS);
    for (const [file, src] of Object.entries(SOURCES)) {
      expect(src, file).not.toMatch(/className="people-name"[^>]*>[^<]*\{[^}]*<PeopleGlyph/);
    }
  });
});
