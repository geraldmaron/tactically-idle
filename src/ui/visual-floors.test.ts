// The visual-story ratchet (backlog `visual-story`). The Desk and Street redesign once removed
// pictures as it removed clutter; this list keeps them. Each obligation names a production screen
// and the fixture state it renders, and fails when that screen loses a picture it is owed: a plate
// on a tab root, a face, gear art or a kit icon before the text of a row, the tab and resource-bar
// icons, an icon on a headed step, a Spot in an empty state.
//
// Rules for this file:
// - Each obligation is counted once and is listed here by name. Add one when a screen gains a
//   picture it must keep; OBLIGATION_FLOOR only rises. Dropping a picture on purpose means changing
//   the screen, this list and docs/visual-kit.md in one commit, so the loss is a decision.
// - Each obligation asserts that the rows or elements it checks exist, so an empty screen cannot
//   pass.
// - Only production screens are rendered. The kit gallery and the harness are never listed.
// - The owner picks the plate height (`--plate-h` in theme.css) and which tabs carry one
//   (`TAB_PLATES` in art/tab-plates.ts), in `owner-visual-picks`. A tab that drops its plate drops
//   its plate obligation in the same commit.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../sim/department';
import { actionViews, briefing, pendingDebrief } from '../sim/operation-selectors';
import { getScenario } from '../sim/scenario-registry';
import type { GameState } from '../sim/types';
import { apply, makeState, NOW, startRun, testCallId, withCallOnBoard } from '../sim/test-fixtures';
import { DEFAULT_NAV, NavContext, type NavApi } from './components/nav';
import { BottomNav } from './components/BottomNav';
import { DepartmentStatusBar } from './components/TopBar';
import type { FlowHeadProps } from './components/chrome';
import { Icon, type IconName } from './icons';
import { RESOURCE_ICON, TAB_ICON } from './icons/kit';
import { casebookRows } from './screens/casebook-model';
import { callFlow } from './screens/call-flow';
import { DebriefContents } from './screens/DebriefContents';
import { HQ } from './screens/HQ';
import { OpsBoard } from './screens/OpsBoard';
import { OpsDebrief } from './screens/OpsDebrief';
import { OpsPrepare } from './screens/OpsPrepare';
import { BuildScreen } from './screens/Build';
import { SquadScreen } from './screens/Squad';
import { plateUrl } from './art/Plates';
import { TAB_BANNER, TAB_PLATES } from './art/tab-plates';
import { DEFAULT_EQUIPMENT_QUERY } from './storefront/store-query';

let state: GameState = makeState();
vi.mock('./store', () => ({
  useGame: () => state,
  getState: () => state,
  send: vi.fn(),
  useCampaigns: () => ({ session: 0, activeSlotId: null, slots: [], issue: null, dirty: false }),
  isResponsivePreview: false,
}));
vi.mock('./components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
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

/** The tab root opens on its plate, painted from its banner, with the tab's icon and name. */
function plateOn(page: El, tab: keyof typeof TAB_PLATES, banner: string, name: string): string[] {
  const plates = find(page, (node) => node.attrs['data-tab-plate'] === tab);
  if (plates.length !== 1) return [`expected one ${tab} plate, found ${plates.length}`];
  const [plate] = plates;
  const missing: string[] = [];
  if (!TAB_PLATES[tab]) missing.push(`TAB_PLATES.${tab} is off: drop this obligation with it`);
  const art = find(plate, (node) => node.tag === 'img' && classes(node).includes('plate-art'));
  if (!plateUrl(`banner_${banner}`)) missing.push(`banner_${banner} is not a ready plate`);
  else if (!art.some((img) => (img.attrs.src ?? '').includes(`banner_${banner}.webp`))) missing.push(`no banner_${banner} painting on the plate`);
  if (!find(plate, (node) => node.tag === 'svg').length) missing.push('no tab icon on the plate');
  if (!words(plate).includes(name)) missing.push(`the plate does not name the tab ("${name}")`);
  if (find(plate, (node) => node.tag === 'p').length) missing.push('the plate carries a paragraph');
  if (classes(plate).includes('screen-banner')) missing.push('the plate is the old banner');
  return missing;
}

const spotIn = (page: El, title: string): string[] => {
  const empty = find(page, (node) => classes(node).includes('empty') && words(node).includes(title));
  if (empty.length !== 1) return [`expected one empty state "${title}", found ${empty.length}`];
  return find(empty[0], (node) => node.tag === 'svg' && classes(node).includes('kit-spot')).length === 1 ? [] : [`"${title}" has no Spot`];
};

/** A heading names its step and starts with a kit icon. */
const headedWithIcon = (page: El, headingText: string): string[] => {
  const heads = find(page, (node) => /^h[1-6]$/.test(node.tag) && words(node).startsWith(headingText));
  if (heads.length < 1) return [`no heading "${headingText}"`];
  return heads.every((head) => leadOf(head) === 'visual') ? [] : [`heading "${headingText}" has no icon before its words`];
};

const svgOf = (name: IconName, size: number, className?: string) => renderToStaticMarkup(createElement(Icon, { name, size, className }));

const OBLIGATIONS: Obligation[] = [
  // ---- each tab root opens on a plate
  { id: 'plate-hq', screen: 'HQ', fixture: 'department with a board', check: () => plateOn(mount(createElement(HQ)), 'hq', TAB_BANNER.hq, 'Westhaven Department') },
  { id: 'plate-calls', screen: 'OpsBoard', fixture: 'four calls on the board', check: () => plateOn(mount(createElement(OpsBoard, { onOpen: () => {} })), 'calls', TAB_BANNER.calls, 'Calls') },
  { id: 'plate-officers', screen: 'SquadScreen (Squads)', fixture: 'two squads', check: () => plateOn(mount(createElement(SquadScreen)), 'officers', TAB_BANNER.officers, 'Officers') },
  { id: 'plate-build-upgrades', screen: 'BuildScreen (Upgrades)', fixture: 'department with a board', check: () => plateOn(mount(createElement(BuildScreen), { tab: 'develop' }), 'build', TAB_BANNER.upgrades, 'Build') },
  { id: 'plate-build-armory', screen: 'BuildScreen (Armory)', fixture: 'department with a board', check: () => plateOn(mount(createElement(BuildScreen), { tab: 'gear' }), 'build', TAB_BANNER.armory, 'Build') },

  // ---- the tabs and the resource bar draw their kit icons
  {
    id: 'tabs-icons', screen: 'BottomNav', fixture: 'four calls on the board',
    check: () => {
      const html = renderToStaticMarkup(createElement(NavContext.Provider, { value: DEFAULT_NAV }, createElement(BottomNav)));
      const buttons = byClass(parse(html), 'navbtn');
      return [
        ...(buttons.length === 4 ? [] : [`expected four tabs, found ${buttons.length}`]),
        ...(['hq', 'calls', 'officers', 'build'] as const).flatMap((key, index) => buttons[index] && html.includes(svgOf(TAB_ICON[key], 24)) && leadOf(buttons[index]) === 'visual' ? [] : [`the ${key} tab does not lead with its ${TAB_ICON[key]} icon`]),
      ];
    },
  },
  {
    id: 'bar-icons', screen: 'DepartmentStatusBar', fixture: 'department with a board',
    check: () => {
      const html = renderToStaticMarkup(createElement(DepartmentStatusBar, { g: state, topic: null, onOpen: () => {}, onClose: () => {}, onOpenMenu: () => {} }));
      const stats = byClass(parse(html), 'stat');
      return [
        ...(stats.length === 4 ? [] : [`expected four stats, found ${stats.length}`]),
        ...(['funds', 'rate', 'trust', 'level'] as const).flatMap((key) => html.includes(svgOf(RESOURCE_ICON[key], 16, 'res-icon')) ? [] : [`the bar has no ${key} icon`]),
        ...(html.includes(svgOf(RESOURCE_ICON.menu, 20)) ? [] : ['the bar has no menu icon']),
        ...stats.flatMap((stat) => leadOf(stat) === 'visual' ? [] : [`stat "${words(stat)}" does not lead with its icon`]),
      ];
    },
  },

  // ---- every listed row type leads with a face, gear art or a kit icon
  { id: 'rows-officers-squads', screen: 'SquadScreen (Squads)', fixture: 'two squads of four', check: () => rowsLeadWithVisual(mount(createElement(SquadScreen), { squadSection: 'squads' }), 'officer-row', 8) },
  { id: 'rows-officers-roster', screen: 'SquadScreen (Roster)', fixture: 'eight officers', check: () => rowsLeadWithVisual(mount(createElement(SquadScreen), { squadSection: 'roster' }), 'officer-row', 8) },
  { id: 'rows-officers-status', screen: 'SquadScreen (Roster)', fixture: 'eight officers', check: () => {
    const rows = byClass(mount(createElement(SquadScreen), { squadSection: 'roster' }), 'officer-row');
    return rows.length < 8 ? [`expected 8 officer rows, found ${rows.length}`] : rows.flatMap((row) => byClass(row, 'kit-mark').length ? [] : [`${words(row).slice(0, 30)} has no status mark`]);
  } },
  { id: 'rows-hire', screen: 'SquadScreen (Hire)', fixture: 'a department with candidates', check: () => { state = createInitialState(NOW, 1); return rowsLeadWithVisual(mount(createElement(SquadScreen), { squadSection: 'hire' }), 'cand-top', 1); } },
  { id: 'rows-training', screen: 'SquadScreen (Training)', fixture: 'eight officers', check: () => rowsLeadWithVisual(mount(createElement(SquadScreen), { squadSection: 'training' }), 'course-tile', 6) },
  { id: 'rows-upgrades', screen: 'BuildScreen (Upgrades)', fixture: 'department with a board', check: () => rowsLeadWithVisual(mount(createElement(BuildScreen), { tab: 'develop' }), 'dev-node', 3) },
  { id: 'rows-armory-gear', screen: 'BuildScreen (Armory)', fixture: 'department with owned gear', check: () => rowsLeadWithVisual(mount(createElement(BuildScreen), { tab: 'gear' }), 'inv-tile', 8) },
  { id: 'rows-armory-groups', screen: 'BuildScreen (Armory)', fixture: 'department with owned gear', check: () => {
    const heads = byClass(mount(createElement(BuildScreen), { tab: 'gear' }), 'store-group-head');
    return heads.length < 3 ? [`expected at least 3 category heads, found ${heads.length}`] : heads.flatMap((head) => leadOf(head) === 'visual' ? [] : [`category "${words(head)}" has no icon`]);
  } },
  { id: 'rows-calls-cards', screen: 'OpsBoard', fixture: 'four calls on the board', check: () => rowsLeadWithVisual(mount(createElement(OpsBoard, { onOpen: () => {} })), 'cl-card', 4) },
  { id: 'rows-calls-casebook', screen: 'OpsBoard (Casebook)', fixture: 'four calls on the board', check: () => rowsLeadWithVisual(mount(createElement(OpsBoard, { onOpen: () => {} })), 'casebook-row', Math.max(1, casebookRows(state).length)) },
  { id: 'rows-debrief-tiles', screen: 'HQ (Recent results)', fixture: 'a call played to its debrief and closed', check: () => {
    state = playedCall().after;
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
    return titles.length === 1 && byClass(titles[0], 'flow-title-icon').length === 1 && words(titles[0]) === 'Deploy' ? [] : ['the deploy head has no icon'];
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

  // ---- each empty state has its Spot
  { id: 'empty-hq-squads', screen: 'HQ (On duty)', fixture: 'no squads', check: () => { state = { ...state, squads: [] }; return spotIn(mount(createElement(HQ)), 'No squads yet'); } },
  { id: 'empty-hq-results', screen: 'HQ (Recent results)', fixture: 'no debriefs', check: () => spotIn(mount(createElement(HQ)), 'No results yet') },
  { id: 'empty-calls', screen: 'OpsBoard', fixture: 'nothing on the board', check: () => { state = { ...state, incidents: [] }; return spotIn(mount(createElement(OpsBoard, { onOpen: () => {} })), 'No calls right now'); } },
  { id: 'empty-squads', screen: 'SquadScreen (Squads)', fixture: 'no squads', check: () => { state = { ...state, squads: [] }; return spotIn(mount(createElement(SquadScreen), { squadSection: 'squads' }), 'No squads yet'); } },
  { id: 'empty-hire', screen: 'SquadScreen (Hire)', fixture: 'no candidates', check: () => { state = { ...state, candidates: [] }; return spotIn(mount(createElement(SquadScreen), { squadSection: 'hire' }), 'No candidates right now'); } },
  { id: 'empty-training-officers', screen: 'SquadScreen (Training)', fixture: 'no officers', check: () => { state = { ...state, officers: {}, squads: [] }; return spotIn(mount(createElement(SquadScreen), { squadSection: 'training' }), 'No officers to train'); } },
  { id: 'empty-training-courses', screen: 'SquadScreen (Training)', fixture: 'a search no course matches', check: () => spotIn(mount(createElement(SquadScreen), { squadSection: 'training', trainingDraft: { officerId: '', search: 'no such course' } }), 'No courses match') },
  { id: 'empty-armory', screen: 'BuildScreen (Armory)', fixture: 'a search no item matches', check: () => spotIn(mount(createElement(BuildScreen), { tab: 'gear', equipmentQuery: { ...DEFAULT_EQUIPMENT_QUERY, search: 'no such item' } }), 'No equipment matches these filters') },
];

/** The deploy step with Alpha chosen, read through the real call flow. */
function deployPage(): El {
  const id = testCallId('hostage');
  const draft = callFlow.draft(id);
  callFlow.field(id, draft, 'chosen')[1](['A']);
  callFlow.field(id, draft, 'loadouts')[1]({ A: { loud_hailer: 1, trauma_kit: 1 } });
  return mount(createElement(OpsPrepare, { scenarioId: id, step: 'deploy' }));
}

/** Counted when this ratchet was written (2026-10-22). It only rises. */
const OBLIGATION_FLOOR = 37;

describe('visual floors: every screen keeps the pictures it is owed', () => {
  it('lists each obligation once, with its screen and fixture', () => {
    const ids = OBLIGATIONS.map((obligation) => obligation.id);
    expect(new Set(ids).size, 'obligation ids are unique').toBe(ids.length);
    expect(OBLIGATIONS.every((obligation) => obligation.screen && obligation.fixture)).toBe(true);
    expect(OBLIGATIONS.length, 'the list only grows: add an obligation when a screen gains a picture it must keep').toBeGreaterThanOrEqual(OBLIGATION_FLOOR);
    expect(OBLIGATIONS.length, `raise OBLIGATION_FLOOR to ${OBLIGATIONS.length}`).toBe(OBLIGATION_FLOOR);
  });

  it('keeps the plate height in one token and a plate on every tab root', () => {
    // The plate's height is the one token --plate-h (theme.css), read by one rule in skin.css.
    expect(Object.keys(TAB_PLATES).sort()).toEqual(['build', 'calls', 'hq', 'officers']);
    expect(Object.values(TAB_PLATES).every(Boolean), 'a tab dropped its plate: drop its obligation in the same commit').toBe(true);
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
