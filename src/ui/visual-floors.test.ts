// The visual-story ratchet (backlog `visual-story`). The Desk and Street redesign once removed
// pictures as it removed clutter; this list keeps them. Each obligation names a production screen
// and the fixture state it renders, and fails when that screen loses a picture it is owed: a
// screen identity, a face, gear art or a kit icon before the text of a row, the tab and resource-bar
// icons, an icon on a headed step, a Spot in an empty state.
//
// Rules for this file:
// - Each obligation is counted once and is listed here by name. Add one when a screen gains a
//   picture it must keep; OBLIGATION_FLOOR only rises. Dropping a picture on purpose means changing
//   the screen, this list and docs/visual-kit.md in one commit, so the loss is a decision.
// - Each obligation asserts that the rows or elements it checks exist, so an empty screen cannot
//   pass.
// - Only production screens are rendered. The kit gallery and the harness are never listed.
// - Tab roots use compact headings with their screen art. The former repeated banners are off in
//   `TAB_PLATES`; the standalone TabPlate component retains its own fallback tests.
// - The world redesign (2026-10-24) moved screens: the old HQ home is the City, equipment lives in HQ
//   Gear, Team lists officers as `.trow` rows, Operations draws the call board inside its Now section.
//   Obligations kept their ids where the same picture is owed by the screen that now holds it; the
//   equipment ones took gear ids, and a Store identity was added.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../sim/department';
import { actionViews, briefing, pendingDebrief } from '../sim/operation-selectors';
import { getScenario } from '../sim/scenario-registry';
import type { GameState } from '../sim/types';
import { apply, makeState, NOW, startRun, testCallId, withCallOnBoard } from '../sim/test-fixtures';
import { BeatContext } from './components/Beat';
import { DEFAULT_NAV, NavContext, type NavApi } from './components/nav';
import { BottomNav } from './components/BottomNav';
import { DepartmentStatusBar } from './components/TopBar';
import type { FlowHeadProps } from './components/chrome';
import { Icon, type IconName } from './icons';
import { NAV_ICON, RESOURCE_ICON } from './icons/kit';
import { callFlow } from './screens/call-flow';
import { Casebook } from './screens/Casebook';
import { casebookRows } from './screens/casebook-model';
import { DebriefContents } from './screens/DebriefContents';
import { HQ } from './screens/HQ';
import { OpsBoard } from './screens/OpsBoard';
import { OpsHome } from './screens/operations/OpsHome';
import { GearScreen } from './screens/Gear';
import { HeadquartersTab } from './shell/HeadquartersTab';
import { OpsDebrief } from './screens/OpsDebrief';
import { OpsPrepare } from './screens/OpsPrepare';
import { BuildScreen } from './screens/Build';
import { SquadScreen } from './screens/Squad';
import { TeamScreen } from './screens/Team';
import { StoreScreen } from './screens/Store';
import { TAB_PLATES } from './art/tab-plates';
import { DEFAULT_EQUIPMENT_QUERY } from './storefront/store-query';

let state: GameState = makeState();
vi.mock('./store', () => ({
  useGame: () => state,
  getState: () => state,
  getCampaignSnapshot: () => ({ session: 0, activeSlotId: null, campaignId: null }),
  beforeCampaignSave: () => () => {},
  send: vi.fn(),
  useCampaigns: () => ({ session: 0, activeSlotId: null, slots: [], issue: null, dirty: false }),
  isResponsivePreview: false,
}));
vi.mock('./components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('./components/Beat', async (importOriginal) => ({ ...(await importOriginal<typeof import('./components/Beat')>()), useBeat: () => ({ play: vi.fn(), act: vi.fn() }) }));
vi.mock('./components/Sheet', () => ({ Sheet: () => null }));
vi.mock('./blueprint/Blueprint', () => ({ Blueprint: () => createElement('div', null, 'Map preview') }));
// The shell draws the flow's head and foot around a screen; here the real head renders inline.
vi.mock('./components/chrome', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./components/chrome')>();
  const { createElement: h, Fragment } = await import('react');
  return {
    ...actual,
    useChromeMode: () => {},
    ChromeFoot: ({ children }: { children: unknown }) => children,
    FlowScreen: ({ footer, children, ...head }: Record<string, never>) => h(Fragment, null, h(actual.FlowHead, head as unknown as FlowHeadProps), children, footer),
  };
});

// ---------------------------------------------------------------- markup, as a small tree

interface El { tag: string; attrs: Record<string, string>; kids: (El | string)[] }
const VOID = new Set(['img', 'input', 'br', 'hr', 'link', 'meta', 'source']);

/** React's static markup is well formed, so a tag scanner is enough: no DOM library is installed. */
function parse(html: string): El {
  const root: El = { tag: '#root', attrs: {}, kids: [] };
  const stack = [root];
  const token = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (const [, close, open, rawAttrs, selfClose, text] of html.matchAll(token)) {
    const top = stack[stack.length - 1];
    if (text !== undefined) top.kids.push(text);
    else if (close) stack.pop();
    else if (open) {
      const attrs: Record<string, string> = {};
      for (const [, name, value] of (rawAttrs ?? '').matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) attrs[name] = value ?? '';
      const el: El = { tag: open, attrs, kids: [] };
      top.kids.push(el);
      if (!selfClose && !VOID.has(open)) stack.push(el);
    }
  }
  return root;
}
const classes = (el: El) => (el.attrs.class ?? '').split(/\s+/).filter(Boolean);
const find = (el: El, test: (node: El) => boolean): El[] =>
  el.kids.flatMap((kid) => typeof kid === 'string' ? [] : [...(test(kid) ? [kid] : []), ...find(kid, test)]);
const byClass = (el: El, name: string) => find(el, (node) => classes(node).includes(name));
const isVisual = (el: El) => el.tag === 'svg' || el.tag === 'img' || 'data-portrait' in el.attrs;
/** The words an element shows: not its svg titles, and not screen-reader-only text. */
const words = (el: El): string => el.kids.map((kid) => typeof kid === 'string' ? kid : el.tag === 'svg' || classes(kid).includes('sr-only') ? '' : words(kid)).join('').replace(/\s+/g, ' ').trim();

/** What comes first in reading order inside an element: a picture or words. Screen-reader-only text
 * is skipped, and so is whitespace. */
function leadOf(el: El): 'visual' | 'text' | 'nothing' {
  for (const kid of el.kids) {
    if (typeof kid === 'string') { if (kid.trim()) return 'text'; continue; }
    if (classes(kid).includes('sr-only')) continue;
    if (isVisual(kid)) return 'visual';
    const inner = leadOf(kid);
    if (inner !== 'nothing') return inner;
  }
  return 'nothing';
}

// ---------------------------------------------------------------- fixtures

const nav = (over: Partial<NavApi> = {}): Partial<NavApi> => over;
const mount = (node: ReactNode, over: Partial<NavApi> = {}) =>
  parse(renderToStaticMarkup(createElement(NavContext.Provider, { value: { ...DEFAULT_NAV, ...nav(over) } }, node)));

/** The four kinds of call on the board, so each scene and each type badge has its row. */
function boardState(): GameState {
  let s = makeState();
  for (const name of ['hostage', 'barricade', 'armed', 'rescue'] as const) s = withCallOnBoard(s, testCallId(name));
  return s;
}

/** A call played to its debrief, before and after Done, with the id it was played on. */
function playedCall() {
  const id = testCallId('hostage');
  const board = withCallOnBoard(makeState(), id);
  let s = startRun(board, id, ['A'], { positions: { A: briefing(id, board, ['A']).entries[0].id } });
  for (let guard = 0; guard < 20 && s.activeRun?.status === 'active'; guard++) {
    const pick = actionViews(s, NOW, 'A').find((view) => view.eligible);
    if (!pick) throw new Error(`no eligible action at ${s.activeRun!.stage}`);
    const next = apply(s, { type: 'decide', actionId: pick.id, actingSquadIds: pick.actingSquadIds, supportSquadIds: pick.supportSquadIds });
    if (!next.result.ok) throw new Error(`decide refused: ${next.result.reason}`);
    s = next.state;
  }
  const debrief = pendingDebrief(s);
  if (!debrief) throw new Error('the call did not reach its debrief');
  const closed = apply(s, { type: 'closeDebrief' });
  if (!closed.result.ok) throw new Error(`closeDebrief refused: ${closed.result.reason}`);
  return { id, pending: s, debrief, after: closed.state };
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  state = boardState();
  // A new campaign opens on the cold open; the City draws its map once the first session is over.
  state.world.onboarding.stage = 'done';
});
afterEach(() => { vi.restoreAllMocks(); callFlow.close(); });

// ---------------------------------------------------------------- obligations

interface Obligation {
  id: string;
  /** The production component rendered. */
  screen: string;
  /** The state it renders in. */
  fixture: string;
  /** Returns what is missing; empty means the obligation holds. */
  check: () => string[];
}

/** Every row of a type must lead with a picture, and there must be `min` or more of them. */
function rowsLeadWithVisual(page: El, rowClass: string, min: number): string[] {
  const rows = byClass(page, rowClass);
  if (rows.length < min) return [`expected at least ${min} .${rowClass} rows, found ${rows.length}`];
  return rows.flatMap((row, index) => leadOf(row) === 'visual' ? [] : [`.${rowClass} #${index + 1} (${words(row).slice(0, 40)}) starts with ${leadOf(row)}, not a picture`]);
}

/** Team lists each officer as one row: a face first, then the name, the specialty and the condition
 * (the band word with its bar, on every row). A mark is added only when the officer is not ready. */
function officerRows(page: El, min: number): string[] {
  const rows = byClass(page, 'trow');
  if (rows.length < min) return [`expected at least ${min} officer rows, found ${rows.length}`];
  return rows.flatMap((row, index) => {
    const missing: string[] = [];
    if (leadOf(row) !== 'visual') missing.push(`officer row #${index + 1} does not lead with a portrait`);
    if (byClass(row, 'trow-name').length !== 1) missing.push(`officer row #${index + 1} has no identity`);
    if (byClass(row, 'trow-role').length !== 1) missing.push(`officer row #${index + 1} has no specialty`);
    if (byClass(row, 'trow-band-word').length !== 1 || byClass(row, 'trow-bar').length !== 1) missing.push(`officer row #${index + 1} has no visible condition`);
    return missing;
  });
}

/** A compact empty state is one row that leads with a kit icon, not a Spot picture. */
const iconEmptyIn = (page: El, title: string): string[] => {
  const empty = find(page, (node) => classes(node).includes('empty-compact') && words(node).includes(title));
  if (empty.length !== 1) return [`expected one compact empty state "${title}", found ${empty.length}`];
  return leadOf(empty[0]) === 'visual' ? [] : [`"${title}" does not lead with its icon`];
};

const spotIn = (page: El, title: string): string[] => {
  const empty = find(page, (node) => classes(node).includes('empty') && words(node).includes(title));
  if (empty.length !== 1) return [`expected one empty state "${title}", found ${empty.length}`];
  return find(empty[0], (node) => node.tag === 'svg' && classes(node).includes('kit-spot')).length === 1 ? [] : [`"${title}" has no Spot`];
};

/** A step names itself and starts with a picture: a section's head leads with its mark (a kit icon, or a
 * squad's letter badge, which stands for the squad's face), and a heading outside a section head carries
 * its own icon. */
const headedWithIcon = (page: El, headingText: string): string[] => {
  const sectionHeads = find(page, (node) => classes(node).includes('section-head'));
  const inSection = new Set(sectionHeads.flatMap((head) => find(head, (node) => /^h[1-6]$/.test(node.tag))));
  const heads = [
    ...sectionHeads.filter((head) => byClass(head, 'section-title').some((title) => words(title).startsWith(headingText))),
    ...find(page, (node) => /^h[1-6]$/.test(node.tag) && !inSection.has(node) && words(node).startsWith(headingText)),
  ];
  if (heads.length < 1) return [`no heading "${headingText}"`];
  const marked = (head: El) => {
    const first = head.kids.find((kid): kid is El => typeof kid !== 'string');
    return leadOf(head) === 'visual' || (!!first && classes(first).includes('section-mark') && words(first) !== '');
  };
  return heads.every(marked) ? [] : [`heading "${headingText}" has no icon before its words`];
};

const svgOf = (name: IconName, size: number, className?: string) => renderToStaticMarkup(createElement(Icon, { name, size, className }));

const beatWrap = (child: ReactNode) => createElement(BeatContext.Provider, { value: { play: () => {}, act: () => ({ ok: true as const }) } }, child);
/** The HQ tab (Build, Gear or Training) as the shell draws it. */
const hqTab = (hqSection: NavApi['hqSection']) => mount(beatWrap(createElement(HeadquartersTab)), { tab: 'headquarters', hqSection });
/** The Armory as HQ draws it: the catalogue leads and the standing tools sit under a disclosure. */
const armory = (over: Partial<NavApi> = {}) => mount(createElement(GearScreen, { compactTools: true }), { tab: 'headquarters', hqSection: 'gear', ...over });

const OBLIGATIONS: Obligation[] = [
  // ---- each tab root has one visual identity
  { id: 'identity-hq', screen: 'HeadquartersTab', fixture: 'department with a board', check: () => {
    const page = hqTab('build');
    const plates = byClass(page, 'hq-plate');
    const titles = byClass(page, 'hq-title');
    const rail = find(page, (node) => classes(node).includes('choice-rail') && node.attrs['aria-label'] === 'HQ sections');
    const items = rail.flatMap((node) => byClass(node, 'choice-rail-item'));
    return [
      ...(plates.length === 1 && find(plates[0], (node) => node.tag === 'img' && classes(node).includes('plate-art')).length === 1 ? [] : ['the HQ head lost its painted plate']),
      ...(titles.length === 1 && titles[0].tag === 'h1' && leadOf(titles[0]) === 'visual' ? [] : ['the HQ head does not name its section with an icon']),
      ...(items.length === 3 && items.every((item) => leadOf(item) === 'visual') ? [] : ['the HQ section rail lost the icon on a choice']),
      ...(find(page, (node) => node.attrs['data-tab-plate'] === 'hq').length === 0 ? [] : ['HQ duplicates its plate with a tab plate']),
    ];
  } },
  { id: 'identity-city', screen: 'CityScreen', fixture: 'department with a board, first session over', check: () => {
    const page = mount(createElement(HQ));
    const map = byClass(page, 'city-map');
    const districts = map.flatMap((node) => byClass(node, 'city-district'));
    const next = byClass(page, 'city-now');
    return [
      ...(map.length === 1 && find(map[0], (node) => node.tag === 'svg').length >= 1 ? [] : ['the City lost its map']),
      ...(districts.length === 5 ? [] : [`the map draws ${districts.length} districts, not five`]),
      ...(next.length === 1 && find(next[0], (node) => node.tag === 'img').length === 1 ? [] : ['the next call lost its painting']),
      ...(find(page, (node) => node.attrs['data-tab-plate'] === 'hq').length === 0 ? [] : ['the City duplicates its map with a tab plate']),
    ];
  } },
  { id: 'identity-calls', screen: 'OpsHome (Now)', fixture: 'four calls on the board', check: () => {
    const page = mount(createElement(OpsHome, { onOpen: () => {} }));
    // The call closing first is a full card; the rest are rows whose thumbnail is the same painting.
    const scenes = [...byClass(page, 'cl-card-scene'), ...byClass(page, 'cl-row-thumb')];
    const strip = byClass(page, 'cl-board-strip');
    const names = find(page, (node) => node.tag === 'h1' && classes(node).includes('sr-only'));
    return [
      ...(names.length === 1 && words(names[0]) === 'Operations' ? [] : ['the Operations tab does not name itself']),
      ...(strip.length === 1 && leadOf(strip[0]) === 'visual' && byClass(strip[0], 'section-title').some((title) => words(title) === 'Calls') ? [] : ['the call board lost its icon and name']),
      ...(scenes.length >= 4 && scenes.every((scene) => find(scene, (node) => node.tag === 'img' && classes(node).includes('plate-art')).length === 1) ? [] : ['call cards lost their scene art']),
    ];
  } },
  { id: 'identity-team-swat', screen: 'TeamScreen (SWAT)', fixture: 'two squads', check: () => {
    // The team scene names Team and carries its painting and the section rails; SWAT is the section below.
    const page = mount(createElement(TeamScreen), { tab: 'squad', teamSection: 'swat' });
    const scene = byClass(page, 'team-scene');
    const swat = byClass(page, 'officers-title');
    return [
      ...(scene.length === 1 && find(scene[0], (node) => node.tag === 'img' && classes(node).includes('plate-art')).length === 1 ? [] : ['expected the Team scene with its painting']),
      ...(byClass(page, 'team-title').length === 1 ? [] : ['the Team scene does not name itself']),
      ...(swat.length === 1 && swat[0].tag === 'h2' && words(swat[0]) === 'SWAT' ? [] : ['the Team screen does not name its SWAT section']),
      ...officerRows(page, 8),
    ];
  } },
  { id: 'identity-build-facilities', screen: 'BuildScreen (Station)', fixture: 'department with a board', check: () => {
    const page = mount(beatWrap(createElement(BuildScreen)), { tab: 'headquarters', hqSection: 'build' });
    const cards = byClass(page, 'room-card');
    const lights = byClass(page, 'station-light');
    return [
      ...(cards.length === 6 && cards.every((card) => find(card, (node) => node.tag === 'img' && (node.attrs.src ?? '').includes('room_')).length === 1) ? [] : ['the six room cards lost their paintings']),
      ...(find(page, (node) => node.tag === 'img' && (node.attrs.src ?? '').includes('scene_facilities_plan_dark.webp')).length === 1 && lights.length === 6 ? [] : ['the station lost its dark plate or a room\'s light']),
      ...(byClass(page, 'scene-spot').length === 6 ? [] : ['the station does not have a tap target per room']),
    ];
  } },
  { id: 'identity-store', screen: 'StoreScreen', fixture: 'department with a board', check: () => {
    const page = mount(createElement(StoreScreen), { tab: 'store' });
    const title = byClass(page, 'store-title');
    const hero = byClass(page, 'store-hero');
    const cards = byClass(page, 'store-card');
    return [
      ...(title.length === 1 && title[0].tag === 'h1' && words(title[0]) === 'Store' ? [] : ['the Store does not name itself']),
      ...(hero.length === 1 && find(hero[0], (node) => node.tag === 'img' && classes(node).includes('plate-art')).length === 1 ? [] : ['the Founder’s Bundle lost its plate']),
      ...(cards.length === 2 && cards.every((card) => byClass(card, 'store-card-art').some((art) => find(art, (node) => node.tag === 'img').length === 1)) ? [] : ['the two lifetime products lost their paintings']),
      ...(byClass(page, 'store-swatch').length === 3 ? [] : ['the three precinct looks lost their swatches']),
    ];
  } },
  { id: 'identity-gear', screen: 'GearScreen (Armory)', fixture: 'department with a board', check: () => {
    const page = armory();
    const objects = byClass(page, 'inv-tile');
    return objects.length >= 8 && objects.every((object) => leadOf(object) === 'visual') ? [] : ['equipment tiles lost their object art'];
  } },

  // ---- the tabs and the resource bar draw their kit icons
  {
    id: 'tabs-icons', screen: 'BottomNav', fixture: 'four calls on the board',
    check: () => {
      const html = renderToStaticMarkup(createElement(NavContext.Provider, { value: DEFAULT_NAV }, createElement(BottomNav)));
      const buttons = byClass(parse(html), 'navbtn');
      return [
        ...(buttons.length === 5 ? [] : [`expected five tabs, found ${buttons.length}`]),
        ...([
          ['City', NAV_ICON.city], ['Operations', NAV_ICON.ops], ['Team', NAV_ICON.squad], ['HQ', NAV_ICON.headquarters], ['Store', NAV_ICON.store],
        ] as const).flatMap(([label, icon]) => {
          const matching = buttons.filter((button) => byClass(button, 'navlabel').some((name) => words(name) === label));
          const expected = find(parse(svgOf(icon, 24)), (node) => node.tag === 'svg')[0];
          return matching.length === 1 && leadOf(matching[0]) === 'visual' && find(matching[0], (node) => node.tag === 'svg' && JSON.stringify(node) === JSON.stringify(expected)).length === 1
            ? [] : [`the ${label} tab does not lead with its ${icon} icon`];
        }),
      ];
    },
  },
  {
    id: 'bar-icons', screen: 'DepartmentStatusBar', fixture: 'department with a board',
    check: () => {
      const html = renderToStaticMarkup(createElement(DepartmentStatusBar, { g: state, topic: null, onOpen: () => {}, onClose: () => {}, onOpenMenu: () => {} }));
      const page = parse(html);
      const stats = byClass(page, 'stat');
      const cash = stats.filter((stat) => classes(stat).includes('stat-cash'));
      const kickers = stats.filter((stat) => byClass(stat, 'kicker').length === 1);
      return [
        ...(stats.length === 3 ? [] : [`expected three stats (funds with the rate, trust, level), found ${stats.length}`]),
        // Funds is the one pill: a kit icon, the amount and the rate as a suffix. Level and trust are
        // labelled standing lines under the department name (the night-city bar).
        ...(cash.length === 1 && find(cash[0], (node) => node.tag === 'svg' && classes(node).includes('res-icon') && JSON.stringify(node) === JSON.stringify(find(parse(svgOf(RESOURCE_ICON.funds, Number(node.attrs.width), 'res-icon')), (n) => n.tag === 'svg')[0])).length === 1 ? [] : ['the bar has no funds icon']),
        ...(html.match(/data-ui-pill/g)?.length === 1 ? [] : ['the bar does not mark its funds pill']),
        ...(cash.length === 1 && leadOf(cash[0]) === 'visual' ? [] : ['the funds pill does not lead with its icon']),
        ...(kickers.length === 2 && kickers.every((stat) => /^(Level|Trust) \d+$/.test(words(stat))) ? [] : ['the bar lost its labelled level and trust']),
        ...(html.includes(svgOf(RESOURCE_ICON.menu, 20)) ? [] : ['the bar has no menu icon']),
      ];
    },
  },

  // ---- every listed row type leads with a face, gear art or a kit icon
  { id: 'cards-officers-squads', screen: 'SquadScreen (Squads)', fixture: 'two squads of four', check: () => officerRows(mount(createElement(SquadScreen), { squadSection: 'squads' }), 8) },
  { id: 'cards-officers-roster', screen: 'SquadScreen (Roster)', fixture: 'eight officers', check: () => rowsLeadWithVisual(mount(createElement(SquadScreen), { squadSection: 'roster' }), 'trow', 8) },
  { id: 'rows-officers-status', screen: 'SquadScreen (Roster)', fixture: 'eight officers', check: () => {
    const rows = byClass(mount(createElement(SquadScreen), { squadSection: 'roster' }), 'trow');
    return rows.length < 8 ? [`expected 8 officer rows, found ${rows.length}`] : rows.flatMap((row) => {
      // Every row says its condition aloud and in the band word with its bar.
      const aloud = /ready|strained|overloaded|recovery|injured|training|detail|deployed/.test(row.attrs['aria-label'] ?? '');
      return byClass(row, 'trow-band-word').length === 1 && byClass(row, 'trow-bar').length === 1 && aloud ? [] : [`${words(row).slice(0, 30)} does not state its condition`];
    });
  } },
  { id: 'rows-hire', screen: 'SquadScreen (Hire)', fixture: 'a department with candidates', check: () => { state = createInitialState(NOW, 1); return rowsLeadWithVisual(mount(createElement(SquadScreen), { squadSection: 'hire' }), 'cand-dossier', 1); } },
  { id: 'rows-training', screen: 'SquadScreen (Training)', fixture: 'eight officers', check: () => rowsLeadWithVisual(mount(createElement(SquadScreen), { squadSection: 'training' }), 'course-tile', 6) },
  { id: 'rows-upgrades', screen: 'BuildScreen (Rooms and index)', fixture: 'department with a board', check: () => {
    const page = mount(beatWrap(createElement(BuildScreen)), { tab: 'headquarters', hqSection: 'build' });
    return [...rowsLeadWithVisual(page, 'room-card', 6), ...rowsLeadWithVisual(page, 'upgrade-row', 20)];
  } },
  { id: 'rows-gear-equipment', screen: 'GearScreen (Armory)', fixture: 'department with owned gear', check: () => rowsLeadWithVisual(armory(), 'inv-tile', 8) },
  { id: 'rows-gear-equipment-groups', screen: 'GearScreen (Armory)', fixture: 'department with owned gear', check: () => {
    const groups = byClass(armory(), 'store-group');
    return groups.length < 3 ? [`expected at least 3 category groups, found ${groups.length}`] : groups.flatMap((group) => {
      const head = byClass(group, 'section-head');
      return head.length === 1 && leadOf(head[0]) === 'visual' ? [] : [`category "${words(head[0] ?? group).slice(0, 30)}" has no icon`];
    });
  } },
  { id: 'rows-calls-cards', screen: 'OpsHome (Now)', fixture: 'four calls on the board', check: () => {
    const page = mount(createElement(OpsHome, { onOpen: () => {} }));
    const rows = [...byClass(page, 'cl-card'), ...byClass(page, 'cl-row')];
    if (rows.length < 4) return [`expected at least 4 calls as cards or rows, found ${rows.length}`];
    return rows.flatMap((row, index) => leadOf(row) === 'visual' ? [] : [`call #${index + 1} (${words(row).slice(0, 40)}) starts with ${leadOf(row)}, not a picture`]);
  } },
  { id: 'art-calls-scenes', screen: 'OpsHome (Now)', fixture: 'one call of each type on the board', check: () => {
    const board = mount(createElement(OpsHome, { onOpen: () => {} }));
    const cards = [...byClass(board, 'cl-card'), ...byClass(board, 'cl-row')];
    // Each call is painted at its place (the building the call is at), and wears its kind of call.
    const unpainted = cards.filter((card) => find(card, (n) => n.tag === 'img' && /\/art\/plates\/(place|scene)_[a-z_0-9]+\.webp$/.test(n.attrs.src ?? '')).length < 1);
    const kinds = ['hostage', 'barricade', 'armed', 'rescue'];
    const missing = kinds.filter((kind) => !cards.some((card) => find(card, (n) => classes(n).includes(`ct-badge--${kind}`)).length >= 1));
    return cards.length < 4 ? [`expected 4 call cards, found ${cards.length}`] : [...unpainted.map((card) => `${words(card).slice(0, 30)} has no painting of its place`), ...missing.map((kind) => `no ${kind} badge on its call card`)];
  } },
  { id: 'art-hq-plates', screen: 'HeadquartersTab', fixture: 'department with a board', check: () => {
    const expected = { build: 'banner_develop.webp', gear: 'banner_gear.webp', training: 'room_training_lit.webp' } as const;
    return (Object.keys(expected) as (keyof typeof expected)[]).flatMap((section) => {
      const plate = byClass(hqTab(section), 'hq-plate');
      return plate.length === 1 && find(plate[0], (n) => n.tag === 'img' && (n.attrs.src ?? '').includes(expected[section])).length === 1 ? [] : [`the HQ ${section} plate (${expected[section]}) is missing`];
    });
  } },
  { id: 'art-debrief-scene', screen: 'DebriefContents', fixture: 'a call played to its debrief', check: () => {
    const { id, debrief, pending } = playedCall();
    state = pending;
    const hero = byClass(mount(createElement(DebriefContents, { result: debrief, officers: pending.officers, scenario: getScenario(id) ?? undefined })), 'debrief-hero');
    return hero.length === 1 && find(hero[0], (n) => n.tag === 'img' && (n.attrs.src ?? '').includes('scene_hostage_crisis.webp')).length === 1 ? [] : ['the debrief hero has no scene painting'];
  } },
  { id: 'rows-calls-casebook', screen: 'Casebook (Archive)', fixture: 'four calls on the board', check: () => rowsLeadWithVisual(mount(createElement(Casebook, { state })), 'casebook-row', Math.max(1, casebookRows(state).length)) },
  { id: 'rows-debrief-tiles', screen: 'CityScreen (Recent results)', fixture: 'a call played to its debrief and closed', check: () => {
    state = playedCall().after;
    state.world.onboarding.stage = 'done';
    const page = mount(createElement(HQ));
    const tiles = byClass(page, 'debrief-tile');
    return [...rowsLeadWithVisual(page, 'debrief-tile', 1), ...tiles.flatMap((tile) => byClass(tile, 'kit-mark').length && byClass(tile, 'ct-badge').length ? [] : ['a result tile lacks its outcome mark or call-type badge'])];
  } },
  { id: 'rows-debrief-officers', screen: 'DebriefContents', fixture: 'a call played to its debrief', check: () => {
    const { id, debrief, pending } = playedCall();
    state = pending;
    return rowsLeadWithVisual(mount(createElement(DebriefContents, { result: debrief, officers: pending.officers, scenario: getScenario(id) ?? undefined })), 'result-officer', 1);
  } },

  // ---- the headed steps keep their icons
  { id: 'head-brief-title', screen: 'OpsPrepare (brief)', fixture: 'the hostage call on the board', check: () => {
    const page = mount(createElement(OpsPrepare, { scenarioId: testCallId('hostage'), step: 'brief' }));
    const titles = byClass(page, 'flow-title');
    return titles.length === 1 && byClass(titles[0], 'flow-title-icon').length === 1 && byClass(titles[0], 'ct-badge').length === 1 ? [] : ['the brief head does not lead with the call type badge'];
  } },
  { id: 'head-brief-orders', screen: 'OpsPrepare (brief)', fixture: 'the hostage call on the board', check: () => headedWithIcon(mount(createElement(OpsPrepare, { scenarioId: testCallId('hostage'), step: 'brief' })), 'Your orders') },
  { id: 'head-deploy-title', screen: 'OpsPrepare (deploy)', fixture: 'the hostage call, Alpha chosen', check: () => {
    const page = deployPage();
    const titles = byClass(page, 'flow-title');
    // Brief and deploy are one screen (2026-10-23): the head names the call and leads with its type badge.
    return titles.length === 1 && byClass(titles[0], 'flow-title-icon').length === 1 && words(titles[0]) !== '' ? [] : ['the deploy head has no icon'];
  } },
  { id: 'head-deploy-who', screen: 'OpsPrepare (deploy)', fixture: 'the hostage call, Alpha chosen', check: () => headedWithIcon(deployPage(), 'Who goes') },
  { id: 'head-deploy-carries', screen: 'OpsPrepare (deploy)', fixture: 'the hostage call, Alpha chosen', check: () => headedWithIcon(deployPage(), 'Alpha carries') },
  { id: 'head-deploy-going-in', screen: 'OpsPrepare (deploy)', fixture: 'the hostage call, Alpha chosen', check: () => headedWithIcon(deployPage(), 'Going in') },
  { id: 'head-deploy-kit', screen: 'OpsPrepare (deploy)', fixture: 'the hostage call, Alpha chosen', check: () => {
    const chips = byClass(deployPage(), 'cl-kit-chip');
    return chips.length < 1 ? ['expected kit chips for Alpha, found none'] : chips.flatMap((chip) => leadOf(chip) === 'visual' ? [] : [`kit chip "${words(chip)}" has no gear art`]);
  } },
  { id: 'head-debrief-title', screen: 'OpsDebrief', fixture: 'a call played to its debrief', check: () => {
    state = playedCall().pending;
    const page = mount(createElement(OpsDebrief));
    const titles = byClass(page, 'flow-title');
    return titles.length === 1 && byClass(titles[0], 'flow-title-icon').length === 1 && words(titles[0]) === 'Debrief' ? [] : ['the debrief head has no icon'];
  } },
  { id: 'head-debrief-hero', screen: 'DebriefContents', fixture: 'a call played to its debrief', check: () => {
    const { id, debrief, pending } = playedCall();
    state = pending;
    const page = mount(createElement(DebriefContents, { result: debrief, officers: pending.officers, scenario: getScenario(id) ?? undefined }));
    const hero = byClass(page, 'debrief-hero');
    return hero.length === 1 && byClass(hero[0], 'debrief-type').length === 1 && byClass(hero[0], 'ct-badge').length === 1 ? [] : ['the debrief hero does not carry the call type badge'];
  } },
  { id: 'head-debrief-review', screen: 'DebriefContents', fixture: 'a call played to its debrief', check: () => {
    const { id, debrief, pending } = playedCall();
    state = pending;
    return headedWithIcon(mount(createElement(DebriefContents, { result: debrief, officers: pending.officers, scenario: getScenario(id) ?? undefined })), 'Review the operation');
  } },

  // ---- each empty state has its icon or Spot
  { id: 'empty-hq-results', screen: 'CityScreen (Recent results)', fixture: 'no debriefs', check: () => iconEmptyIn(mount(createElement(HQ)), 'No results yet') },
  { id: 'empty-calls', screen: 'OpsHome (Now)', fixture: 'nothing on the board', check: () => { state = { ...state, incidents: [] }; return spotIn(mount(createElement(OpsHome, { onOpen: () => {} })), 'No calls right now'); } },
  { id: 'empty-squads', screen: 'SquadScreen (Squads)', fixture: 'no squads', check: () => { state = { ...state, squads: [] }; return spotIn(mount(createElement(SquadScreen), { squadSection: 'squads' }), 'No squads yet'); } },
  { id: 'empty-hire', screen: 'SquadScreen (Hire)', fixture: 'no candidates', check: () => { state = { ...state, candidates: [] }; return spotIn(mount(createElement(SquadScreen), { squadSection: 'hire' }), 'No candidates right now'); } },
  { id: 'empty-training-officers', screen: 'SquadScreen (Training)', fixture: 'no officers', check: () => { state = { ...state, officers: {}, squads: [] }; return spotIn(mount(createElement(SquadScreen), { squadSection: 'training' }), 'No officers to train'); } },
  { id: 'empty-training-courses', screen: 'SquadScreen (Training)', fixture: 'a search no course matches', check: () => spotIn(mount(createElement(SquadScreen), { squadSection: 'training', trainingDraft: { officerId: '', search: 'no such course' } }), 'No courses match') },
  { id: 'empty-gear-equipment', screen: 'GearScreen (Armory)', fixture: 'a search no item matches', check: () => spotIn(armory({ equipmentQuery: { ...DEFAULT_EQUIPMENT_QUERY, search: 'no such item' } }), 'No equipment matches these filters') },
];

/** The deploy step with Alpha chosen, read through the real call flow. */
function deployPage(): El {
  const id = testCallId('hostage');
  const draft = callFlow.draft(id);
  callFlow.field(id, draft, 'chosen')[1](['A']);
  callFlow.field(id, draft, 'loadouts')[1]({ A: { loud_hailer: 1, trauma_kit: 1 } });
  return mount(createElement(OpsPrepare, { scenarioId: id, step: 'deploy' }));
}

/** Counted after the world redesign (2026-10-24; 40 before it, with the equipment and HQ ones moved and the City and Store added). It only rises. */
const OBLIGATION_FLOOR = 41;

describe('visual floors: every screen keeps the pictures it is owed', () => {
  it('lists each obligation once, with its screen and fixture', () => {
    const ids = OBLIGATIONS.map((obligation) => obligation.id);
    expect(new Set(ids).size, 'obligation ids are unique').toBe(ids.length);
    expect(OBLIGATIONS.every((obligation) => obligation.screen && obligation.fixture)).toBe(true);
    expect(OBLIGATIONS.length, 'the list only grows: add an obligation when a screen gains a picture it must keep').toBeGreaterThanOrEqual(OBLIGATION_FLOOR);
    expect(OBLIGATIONS.length, `raise OBLIGATION_FLOOR to ${OBLIGATIONS.length}`).toBe(OBLIGATION_FLOOR);
  });

  it('keeps the optional legacy tab banners disabled', () => {
    expect(Object.values(TAB_PLATES).every((plate) => !plate), 'tab roots carry their identity in headings and scene art').toBe(true);
  });

  it.each(OBLIGATIONS.map((obligation) => [obligation.id, obligation] as const))('%s', (_id, obligation) => {
    expect(obligation.check(), `${obligation.screen} with ${obligation.fixture}`).toEqual([]);
  });

  it('renders no gallery or harness markup', () => {
    const html = [
      renderToStaticMarkup(createElement(NavContext.Provider, { value: DEFAULT_NAV }, createElement(HQ))),
      renderToStaticMarkup(createElement(NavContext.Provider, { value: DEFAULT_NAV }, createElement(OpsBoard, { onOpen: () => {} }))),
    ].join('');
    expect(html).not.toMatch(/kit-gallery|harness/);
  });
});
