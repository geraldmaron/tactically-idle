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
import { TeamScreen } from './screens/Team';
import { StoreScreen } from './screens/Store';
import { plateUrl } from './art/Plates';
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
vi.mock('./components/Beat', () => ({ useBeat: () => ({ play: vi.fn(), act: vi.fn() }) }));
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

/** Officer cards lead with a portrait and keep the name, specialty, and visible condition together. */
function officerCards(page: El, min: number): string[] {
  const cards = byClass(page, 'ocard-tile');
  if (cards.length < min) return [`expected at least ${min} officer cards, found ${cards.length}`];
  return cards.flatMap((card, index) => {
    const missing: string[] = [];
    if (leadOf(card) !== 'visual') missing.push(`officer card #${index + 1} does not lead with a portrait`);
    if (byClass(card, 'otile-title').length !== 1) missing.push(`officer card #${index + 1} has no identity`);
    if (byClass(card, 'otile-role').length !== 1) missing.push(`officer card #${index + 1} has no specialty`);
    // The condition is the stress strip on every tile; a status mark is added only when the officer is not ready.
    if (byClass(card, 'otile-stress').length !== 1) missing.push(`officer card #${index + 1} has no visible condition`);
    return missing;
  });
}

/** The tab root names its screen with a compact heading and carries its distinctive screen art. */
function screenIdentity(page: El, headingClass: string, name: string, icon: IconName): string[] {
  const headings = byClass(page, headingClass);
  if (headings.length !== 1) return [`expected one .${headingClass} heading, found ${headings.length}`];
  const heading = headings[0];
  const actualIcon = find(heading, (node) => node.tag === 'svg');
  const expectedIcon = find(parse(renderToStaticMarkup(createElement(Icon, { name: icon, size: 24 }))), (node) => node.tag === 'svg');
  return [
    ...(heading.tag === 'h1' && words(heading) === name ? [] : [`the ${name} screen heading is missing or misnamed`]),
    ...(leadOf(heading) === 'visual' && actualIcon.length === 1 && JSON.stringify(actualIcon[0]) === JSON.stringify(expectedIcon[0]) ? [] : [`the ${name} heading does not lead with its ${icon} icon`]),
  ];
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

/** A heading names its step and starts with a kit icon. */
const headedWithIcon = (page: El, headingText: string): string[] => {
  const heads = find(page, (node) => /^h[1-6]$/.test(node.tag) && words(node).startsWith(headingText));
  if (heads.length < 1) return [`no heading "${headingText}"`];
  return heads.every((head) => leadOf(head) === 'visual') ? [] : [`heading "${headingText}" has no icon before its words`];
};

const svgOf = (name: IconName, size: number, className?: string) => renderToStaticMarkup(createElement(Icon, { name, size, className }));

const OBLIGATIONS: Obligation[] = [
  // ---- each tab root has one visual identity: HQ uses its compact department scene
  { id: 'identity-hq', screen: 'HQ', fixture: 'department with a board', check: () => {
    const page = mount(createElement(HQ));
    const hubs = byClass(page, 'hub');
    const identity = hubs.flatMap((hub) => byClass(hub, 'hub-identity'));
    const plates = find(page, (node) => node.attrs['data-tab-plate'] === 'hq');
    return [
      ...(hubs.length === 1 ? [] : [`expected one compact HQ scene, found ${hubs.length}`]),
      ...(identity.length === 1 && words(identity[0]).includes('Westhaven Department') ? [] : ['the HQ scene does not carry one department identity']),
      ...(plates.length === 0 ? [] : ['HQ duplicates its scene identity with a tab plate']),
    ];
  } },
  { id: 'identity-calls', screen: 'OpsBoard', fixture: 'four calls on the board', check: () => {
    const page = mount(createElement(OpsBoard, { onOpen: () => {} }));
    const scenes = byClass(page, 'cl-card-scene');
    return [
      ...screenIdentity(page, 'cl-board-title', 'Calls', 'calls'),
      ...(scenes.length >= 4 && scenes.every((scene) => find(scene, (node) => node.tag === 'img' && classes(node).includes('plate-art')).length === 1) ? [] : ['call cards lost their scene art']),
    ];
  } },
  { id: 'identity-team-swat', screen: 'TeamScreen (SWAT)', fixture: 'two squads', check: () => {
    // The tab bar names Team; the screen opens on its sections and carries no header of its own.
    const page = mount(createElement(TeamScreen), { tab: 'squad', teamSection: 'swat' });
    const swat = byClass(page, 'officers-title');
    return [
      ...(byClass(page, 'team-scene').length === 1 ? [] : ['expected the Team scene header with its section switch']),
      ...(swat.length === 1 && swat[0].tag === 'h2' && words(swat[0]) === 'SWAT' ? [] : ['the Team screen does not name its SWAT section']),
      ...officerCards(page, 8),
    ];
  } },
  { id: 'identity-build-facilities', screen: 'BuildScreen (Facilities)', fixture: 'department with a board', check: () => {
    const page = mount(createElement(BuildScreen), { tab: 'develop' });
    const medals = byClass(page, 'dev-medal');
    const rooms = byClass(page, 'facility-room');
    return [
      ...(rooms.length === 5 && rooms.every((room) => leadOf(room) === 'visual') ? [] : ['the five facilities lost their furnishing art']),
      ...(find(page, (node) => node.tag === 'img' && (node.attrs.src ?? '').includes('scene_facilities_plan.webp')).length === 1 ? [] : ['the department facility plan lost its scene art']),
      ...(medals.length >= 3 && medals.every((medal) => find(medal, (node) => isVisual(node)).length > 0) ? [] : ['upgrade nodes lost their screen art']),
    ];
  } },
  { id: 'identity-store-equipment', screen: 'StoreScreen (Equipment)', fixture: 'department with a board', check: () => {
    const page = mount(createElement(StoreScreen), { tab: 'store', storeSection: 'equipment' });
    const objects = byClass(page, 'inv-tile');
    return [
      ...screenIdentity(page, 'store-screen-title', 'Store', 'store'),
      ...(objects.length >= 8 && objects.every((object) => leadOf(object) === 'visual') ? [] : ['equipment tiles lost their object art']),
    ];
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
          ['HQ', TAB_ICON.hq], ['Calls', TAB_ICON.calls], ['Team', TAB_ICON.officers], ['Build', TAB_ICON.build], ['Store', 'store'],
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
      const stats = byClass(parse(html), 'stat');
      return [
        ...(stats.length === 3 ? [] : [`expected three stats (funds with the rate, trust, level), found ${stats.length}`]),
        // Component contract 5 (owner, 2026-10-23): every pill leads with its kit icon in a well; cash
        // is a pill like the others (a kit icon, not the photo) with the rate as a suffix.
        ...(['funds', 'trust', 'level'] as const).flatMap((key) => html.includes(svgOf(RESOURCE_ICON[key], 16, 'res-icon')) ? [] : [`the bar has no ${key} icon`]),
        ...(html.match(/data-ui-pill/g)?.length === 3 ? [] : ['the bar does not mark its three pills']),
        ...(html.includes(svgOf(RESOURCE_ICON.menu, 20)) ? [] : ['the bar has no menu icon']),
        ...stats.flatMap((stat) => leadOf(stat) === 'visual' ? [] : [`stat "${words(stat)}" does not lead with its icon`]),
      ];
    },
  },

  // ---- every listed row type leads with a face, gear art or a kit icon
  { id: 'cards-officers-squads', screen: 'SquadScreen (Squads)', fixture: 'two squads of four', check: () => officerCards(mount(createElement(SquadScreen), { squadSection: 'squads' }), 8) },
  { id: 'cards-officers-roster', screen: 'SquadScreen (Roster)', fixture: 'eight officers', check: () => rowsLeadWithVisual(mount(createElement(SquadScreen), { squadSection: 'roster' }), 'officer-row', 8) },
  { id: 'rows-officers-status', screen: 'SquadScreen (Roster)', fixture: 'eight officers', check: () => {
    const rows = byClass(mount(createElement(SquadScreen), { squadSection: 'roster' }), 'officer-row');
    return rows.length < 8 ? [`expected 8 officer rows, found ${rows.length}`] : rows.flatMap((row) => {
      // A mark only when the officer is not ready; every row says its condition aloud either way.
      const trail = byClass(row, 'officer-row-trail');
      const marks = trail.length === 1 ? byClass(trail[0], 'kit-mark').length : -1;
      const aloud = /ready|strained|overloaded|recovery|injured|training|detail|deployed/.test(row.attrs['aria-label'] ?? '');
      return marks >= 0 && marks <= 1 && aloud ? [] : [`${words(row).slice(0, 30)} does not state its condition`];
    });
  } },
  { id: 'rows-hire', screen: 'SquadScreen (Hire)', fixture: 'a department with candidates', check: () => { state = createInitialState(NOW, 1); return rowsLeadWithVisual(mount(createElement(SquadScreen), { squadSection: 'hire' }), 'cand-dossier', 1); } },
  { id: 'rows-training', screen: 'SquadScreen (Training)', fixture: 'eight officers', check: () => rowsLeadWithVisual(mount(createElement(SquadScreen), { squadSection: 'training' }), 'course-tile', 6) },
  { id: 'rows-upgrades', screen: 'BuildScreen (Upgrades)', fixture: 'department with a board', check: () => rowsLeadWithVisual(mount(createElement(BuildScreen), { tab: 'develop' }), 'dev-node', 3) },
  { id: 'rows-store-equipment', screen: 'StoreScreen (Equipment)', fixture: 'department with owned gear', check: () => rowsLeadWithVisual(mount(createElement(StoreScreen), { tab: 'store', storeSection: 'equipment' }), 'inv-tile', 8) },
  { id: 'rows-store-equipment-groups', screen: 'StoreScreen (Equipment)', fixture: 'department with owned gear', check: () => {
    const heads = byClass(mount(createElement(StoreScreen), { tab: 'store', storeSection: 'equipment' }), 'store-group-head');
    return heads.length < 3 ? [`expected at least 3 category heads, found ${heads.length}`] : heads.flatMap((head) => leadOf(head) === 'visual' ? [] : [`category "${words(head)}" has no icon`]);
  } },
  { id: 'rows-calls-cards', screen: 'OpsBoard', fixture: 'four calls on the board', check: () => rowsLeadWithVisual(mount(createElement(OpsBoard, { onOpen: () => {} })), 'cl-card', 4) },
  { id: 'art-calls-scenes', screen: 'OpsBoard', fixture: 'one call of each type on the board', check: () => {
    const cards = byClass(mount(createElement(OpsBoard, { onOpen: () => {} })), 'cl-card');
    const types = ['hostage_crisis', 'barricaded', 'active_armed_incident', 'protected_rescue'];
    const missing = types.filter((type) => !plateUrl(`scene_${type}`) || !cards.some((card) => find(card, (n) => n.tag === 'img' && (n.attrs.src ?? '').includes(`scene_${type}.webp`)).length === 1));
    return cards.length < 4 ? [`expected 4 call cards, found ${cards.length}`] : missing.map((type) => `no scene_${type} painting on its call card`);
  } },
  { id: 'art-hq-cutaway', screen: 'HQ', fixture: 'department with a board', check: () => {
    const hub = byClass(mount(createElement(HQ)), 'hub');
    return hub.length === 1 && find(hub[0], (n) => n.tag === 'img' && (n.attrs.src ?? '').includes('hub_hq.webp')).length === 1 ? [] : ['the HQ cutaway painting (hub_hq) is missing'];
  } },
  { id: 'art-debrief-scene', screen: 'DebriefContents', fixture: 'a call played to its debrief', check: () => {
    const { id, debrief, pending } = playedCall();
    state = pending;
    const hero = byClass(mount(createElement(DebriefContents, { result: debrief, officers: pending.officers, scenario: getScenario(id) ?? undefined })), 'debrief-hero');
    return hero.length === 1 && find(hero[0], (n) => n.tag === 'img' && (n.attrs.src ?? '').includes('scene_hostage_crisis.webp')).length === 1 ? [] : ['the debrief hero has no scene painting'];
  } },
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
  { id: 'empty-hq-squads', screen: 'HQ (On duty)', fixture: 'no squads', check: () => { state = { ...state, squads: [] }; return iconEmptyIn(mount(createElement(HQ)), 'No squads yet'); } },
  { id: 'empty-hq-results', screen: 'HQ (Recent results)', fixture: 'no debriefs', check: () => iconEmptyIn(mount(createElement(HQ)), 'No results yet') },
  { id: 'empty-calls', screen: 'OpsBoard', fixture: 'nothing on the board', check: () => { state = { ...state, incidents: [] }; return spotIn(mount(createElement(OpsBoard, { onOpen: () => {} })), 'No calls right now'); } },
  { id: 'empty-squads', screen: 'SquadScreen (Squads)', fixture: 'no squads', check: () => { state = { ...state, squads: [] }; return spotIn(mount(createElement(SquadScreen), { squadSection: 'squads' }), 'No squads yet'); } },
  { id: 'empty-hire', screen: 'SquadScreen (Hire)', fixture: 'no candidates', check: () => { state = { ...state, candidates: [] }; return spotIn(mount(createElement(SquadScreen), { squadSection: 'hire' }), 'No candidates right now'); } },
  { id: 'empty-training-officers', screen: 'SquadScreen (Training)', fixture: 'no officers', check: () => { state = { ...state, officers: {}, squads: [] }; return spotIn(mount(createElement(SquadScreen), { squadSection: 'training' }), 'No officers to train'); } },
  { id: 'empty-training-courses', screen: 'SquadScreen (Training)', fixture: 'a search no course matches', check: () => spotIn(mount(createElement(SquadScreen), { squadSection: 'training', trainingDraft: { officerId: '', search: 'no such course' } }), 'No courses match') },
  { id: 'empty-store-equipment', screen: 'StoreScreen (Equipment)', fixture: 'a search no item matches', check: () => spotIn(mount(createElement(StoreScreen), { tab: 'store', storeSection: 'equipment', equipmentQuery: { ...DEFAULT_EQUIPMENT_QUERY, search: 'no such item' } }), 'No equipment matches these filters') },
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
const OBLIGATION_FLOOR = 40;

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
