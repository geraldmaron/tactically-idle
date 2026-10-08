import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../sim/department';
import { COURSES } from '../content/courses';
import { ITEMS } from '../content/items';
import { createPlayerNavigation, DEFAULT_NAV, NavContext, PLAYER_NAV_HISTORY_KEY, type NavApi, type PlayerRoute } from './components/nav';
import { BottomNav } from './components/BottomNav';
import { GearScreen } from './screens/Gear';
import { ManagerSheet } from './components/CommandStaff';
import { SquadScreen } from './screens/Squad';
import { OfficerSheet } from './screens/OfficerSheet';
import { EquipmentStore } from './storefront/EquipmentStore';
import { Storefront } from './storefront/Storefront';
import { trainingDraftForRequest } from './storefront/TrainingStore';
import { DEFAULT_EQUIPMENT_QUERY } from './storefront/store-query';

const NOW = Date.UTC(2026, 9, 3, 12);
let state = createInitialState(NOW, 1);
vi.mock('./store', () => ({ useGame: () => state, getState: () => state, send: vi.fn() }));
vi.mock('./components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('./components/Sheet', () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children, footer) : null }));
beforeEach(() => { state = createInitialState(NOW, 1); });

function historyFixture() {
  const entries: Record<string, unknown>[] = [{ unrelated: 'keep' }];
  let position = 0;
  let backCalls = 0;
  let current: PlayerRoute = { ...DEFAULT_NAV };
  const history = {
    get state() { return entries[position]; },
    pushState(data: Record<string, unknown>) { entries.splice(position + 1); entries.push(data); position++; },
    replaceState(data: Record<string, unknown>) { entries[position] = data; },
    back() { backCalls++; },
  };
  const nav = createPlayerNavigation(history, 'campaign-1', (route) => { current = route; });
  nav.initialize();
  return { nav, entries, route: () => current, backCalls: () => backCalls,
    back() { position--; nav.onPop(); }, forward() { position++; nav.onPop(); },
    state: () => history.state,
  };
}
function markup(child: ReactNode, nav: Partial<NavApi> = {}) {
  return renderToStaticMarkup(createElement(NavContext.Provider, { value: { ...DEFAULT_NAV, ...nav } }, child));
}

describe('canonical player navigation', () => {
  it('keeps exactly HQ, Squad, Ops, Develop and Gear as top-level destinations', () => {
    const html = markup(createElement(BottomNav));
    expect([...html.matchAll(/class="navlabel">([^<]+)/g)].map((match) => match[1])).toEqual(['HQ', 'Squad', 'Ops', 'Develop', 'Gear']);
  });

  it('routes officer, certification and course requests into Squad Training', () => {
    const f = historyFixture();
    f.nav.openTraining({ officerId: 'officer-a', certId: 'drone_operator', courseId: 'drone_course' });
    expect(f.route()).toMatchObject({ tab: 'squad', squadSection: 'training', trainingFocus: { officerId: 'officer-a', certId: 'drone_operator', courseId: 'drone_course' }, trainingRequest: 1 });
    f.nav.openTraining({ certId: 'advanced_first_aid' });
    expect(f.route()).toMatchObject({ trainingFocus: { certId: 'advanced_first_aid' }, trainingRequest: 2 });
  });

  it('keeps the original item through Training → Develop and returns directly to its detail', () => {
    const f = historyFixture();
    f.nav.openEquipment({ itemId: 'camera_drone' });
    f.nav.openTraining({ certId: 'drone_operator' });
    expect(f.route()).toMatchObject({ returnToItem: 'camera_drone', equipmentItemId: null });
    f.nav.openDevelopment('intel_drone');
    expect(f.route()).toMatchObject({ tab: 'develop', developmentNode: 'intel_drone', returnToItem: 'camera_drone' });
    f.nav.returnToEquipment();
    expect(f.route()).toMatchObject({ tab: 'gear', gearSection: 'equipment', equipmentItemId: 'camera_drone', returnToItem: null });
  });

  it('browser Back and Forward recover the item and prerequisite destination', () => {
    const f = historyFixture();
    f.nav.openEquipment();
    f.nav.openEquipment({ itemId: 'camera_drone' });
    f.nav.openDevelopment('intel_drone');
    f.back();
    expect(f.route()).toMatchObject({ tab: 'gear', equipmentItemId: 'camera_drone' });
    f.forward();
    expect(f.route()).toMatchObject({ tab: 'develop', developmentNode: 'intel_drone', returnToItem: 'camera_drone' });
  });

  it('repeated detail taps and Close cannot stack history or close twice', () => {
    const f = historyFixture();
    f.nav.openEquipment();
    f.nav.openEquipment({ itemId: 'camera_drone' });
    f.nav.openEquipment({ itemId: 'camera_drone' });
    expect(f.entries).toHaveLength(3);
    f.nav.closeEquipment(); f.nav.closeEquipment();
    expect(f.backCalls()).toBe(1);
    f.back();
    expect(f.route().equipmentItemId).toBeNull();
    f.forward();
    expect(f.route().equipmentItemId).toBe('camera_drone');
  });

  it('honors a newer destination clicked while asynchronous Close is completing', () => {
    const f = historyFixture();
    f.nav.openEquipment();
    f.nav.openEquipment({ itemId: 'camera_drone' });
    f.nav.closeEquipment();
    f.nav.go('ops');
    f.back();
    expect(f.route()).toMatchObject({ tab: 'ops', equipmentItemId: null, returnToItem: null });
  });

  it('closes a direct Inventory restock into the Equipment list without jumping to Inventory', () => {
    const f = historyFixture();
    f.nav.setGearSection('inventory');
    f.nav.openEquipment({ itemId: 'trauma_kit' });
    f.nav.closeEquipment();
    expect(f.backCalls()).toBe(0);
    expect(f.route()).toMatchObject({ tab: 'gear', gearSection: 'equipment', equipmentItemId: null });
  });

  it('explicit main navigation clears a stale return intent and preserves unrelated history', () => {
    const f = historyFixture();
    f.nav.openEquipment({ itemId: 'camera_drone' });
    f.nav.openTraining();
    f.nav.go('hq');
    expect(f.route().returnToItem).toBeNull();
    expect(f.state().unrelated).toBe('keep');
    f.nav.dispose();
    expect(f.state()).toEqual({ unrelated: 'keep' });
    expect(f.state()[PLAYER_NAV_HISTORY_KEY]).toBeUndefined();
  });
});

describe('rendered player destinations and persistent drafts', () => {
  it('puts owned inventory before collapsed maintenance, with one Equipment destination', () => {
    const html = markup(createElement(GearScreen));
    expect(html).toContain('aria-label="Gear sections"');
    expect(html).toMatch(/>Inventory <span class="choice-rail-count">/);
    expect(html).toMatch(/>Equipment <span class="choice-rail-count">/);
    expect(html.indexOf('class="inv-grid"')).toBeLessThan(html.indexOf('class="gear-maintenance"'));
    expect(html).toContain('<details class="gear-maintenance">');
    expect(html).toContain('class="qm-card qm-card-not_hired"');
    expect(html).toContain('Hire in Develop');
    // Inventory is an item grid; restocking lives in each item's sheet.
    expect(html).toMatch(/class="inv-tile"[^>]* aria-label="[^"]+: \d+ owned, \d+ ready/);
    expect(html).toContain('At each clock hour');
    expect(html).not.toContain('after each operation');
    expect(html).not.toContain('Buy 1 ·');
    expect(html).not.toContain('Hire manager');
    expect(html).not.toContain('Store sections');
    expect(html).not.toContain('Search courses');
  });

  it('renders tier-specific maintenance benefits while preserving budget controls', () => {
    state.department.unlockedNodes.push('logistics_equipment_manager');
    state.department.developmentTiers.logistics_equipment_manager = 3;
    const html = markup(createElement(GearScreen));
    expect(html).toContain('class="qm-card qm-card-off"');
    expect(html).toContain('Tier 3</span>');
    expect(html).toContain('45% cheaper service</span>');
    expect(html).toContain('40% less wear</span>');
    expect(html).not.toContain('Hire in Develop');
    // The budget control lives once, in the Quartermaster's Command Staff sheet.
    const sheet = markup(createElement(ManagerSheet, { id: 'quartermaster', g: state, now: NOW, onClose: () => {}, inGear: true }));
    expect(sheet).toContain('Tier 3: 45% cheaper servicing and 40% less wear');
    expect(sheet).toContain('fewer than 4 repairs');
    expect(sheet).toContain('Hourly service spending ceiling');
    expect(sheet).toContain('role="switch"');
    expect(sheet).not.toContain('Open Gear maintenance');
  });

  it('uses the same blueprint art frame and distinguishes purchase locks from readiness', () => {
    const inventory = markup(createElement(GearScreen));
    const equipment = markup(createElement(EquipmentStore, { active: true }));
    expect(inventory).toContain('class="gear-art-frame"');
    expect(equipment).toContain('class="gear-art-frame"');
    expect(equipment).toContain('Purchase locked');
    expect(equipment).toContain('Purchase unlocked');
    expect(equipment).toMatch(/class="inv-tile store-tile[^"]*"[^>]* aria-label="[^"]+ \d+ owned, \d+ ready/);
    expect(equipment).not.toContain('>Locked</span>');
  });

  it('leaves only Equipment in the legacy wrapper', () => {
    const html = markup(createElement(Storefront, { active: true }));
    expect(html).toContain('Search equipment');
    for (const old of ['Store sections', 'Search courses', 'Get Points', 'Test DP', 'Development branches']) expect(html).not.toContain(old);
  });

  it('renders Training under Squad and removes the duplicated officer course catalog', () => {
    const id = Object.keys(state.officers)[0];
    const officer = state.officers[id];
    const squad = markup(createElement(SquadScreen), { tab: 'squad', squadSection: 'training', trainingDraft: { officerId: id, search: '' } });
    expect(squad).toContain('aria-label="Squad sections"');
    expect(squad).toContain(`data-training-officer-id="${id}"`);
    expect(squad).toContain('Search courses');
    expect(squad).toContain('Choose officer');
    const sheet = markup(createElement(OfficerSheet, { officerId: id, onClose: () => {} }));
    expect(sheet).toContain(`Train ${officer.surname}`);
    expect(sheet).not.toContain('class="courses"');
    expect(sheet).not.toContain('Enrol officer');
  });

  it('renders the same filtered item and quantity draft after a prerequisite round trip', () => {
    const f = historyFixture();
    const drafts = {
      equipmentQuery: { ...DEFAULT_EQUIPMENT_QUERY, search: 'drone', category: ITEMS.camera_drone.category, availability: 'locked' as const, sort: 'cost_desc' as const },
      equipmentQuantities: { camera_drone: '7' },
    };
    f.nav.openEquipment({ itemId: 'camera_drone' });
    const before = markup(createElement(EquipmentStore, { active: true }), { ...f.route(), ...drafts });
    f.nav.openTraining({ certId: 'drone_operator' });
    f.nav.openDevelopment('intel_drone');
    f.nav.returnToEquipment();
    const after = markup(createElement(EquipmentStore, { active: true }), { ...f.route(), ...drafts });
    expect(after).toBe(before);
    expect(after).toContain('value="drone"');
    expect(after).toContain('value="7"');
    expect(after).toContain('Quantity of Camera drone');
  });


  it('applies officer and certification preselection on the first render', () => {
    const id = Object.keys(state.officers)[0];
    const html = markup(createElement(SquadScreen), { tab: 'squad', squadSection: 'training', trainingRequest: 2, trainingFocus: { officerId: id, certId: 'drone_operator' } });
    expect(html).toContain(`data-training-officer-id="${id}"`);
    expect(html).toContain('data-course-id="drone_course"');
    expect(html).not.toContain('data-course-id="composure_workshop"');
  });

  it('keeps edited Training selection and search when returning from Develop, until a new request arrives', () => {
    const original = trainingDraftForRequest({ officerId: '', search: '' }, { officerId: 'officer-a', courseId: 'drone_course' }, 1);
    expect(original).toMatchObject({ officerId: 'officer-a', search: COURSES.drone_course.name });
    const edited = { ...original, officerId: 'officer-b', search: 'aid' };
    expect(trainingDraftForRequest(edited, { officerId: 'officer-a', courseId: 'drone_course' }, 1)).toBe(edited);
    expect(trainingDraftForRequest(edited, { officerId: 'officer-c' }, 2)).toEqual({ officerId: 'officer-c', search: '', request: 2 });
  });

  it('supports the officer’s current-course focus without recreating a second catalog', () => {
    const id = Object.keys(state.officers)[0];
    state.officers[id].assignment = { kind: 'training', courseId: 'drone_course', startedAt: NOW, endsAt: NOW + 1000 };
    const html = markup(createElement(OfficerSheet, { officerId: id, onClose: () => {} }));
    expect(html).toContain(`View ${COURSES.drone_course.name}`);
    expect(html).not.toContain('class="courses"');
  });
});
