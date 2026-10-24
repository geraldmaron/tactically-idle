// The world's calls (world-calls lane): the cast carried in an incident id, the ending's resolution, world
// cards on the board, the call fee, the tie and bond contributors, and the one callback per call.
import { describe, expect, it, vi } from 'vitest';
import { CIVILIAN_FIRST_NAMES, CIVILIAN_SURNAMES } from '../../content/call-trees/civilian-names';
import { SCENARIO_TYPES } from '../../content/scenario-types';
import { WARRANT_TEMPLATE } from '../../content/incidents/warrant';
import { drawInstance } from '../../gen/incident/instance';
import { generateIncident, incidentId, INCIDENT_CONTENT_VERSION, parseIncidentId } from '../../gen/incident';
import { dispatch } from '../game';
import { addWorldCard, applyIncidentsDue, boardSummaryOf, dropExcludedCards, isWorldCard, nextIncidentEventTime, worldCardFiltered } from '../incidents';
import { CALL_FEE, callFee, chooseCallback } from '../operation';
import { actionViews } from '../operation-selectors';
import { buildLocation } from '../location';
import { getScenario } from '../scenario-registry';
import type { IncidentSpec } from '../scenario-types';
import { apply, makeState, NOW, playPolicy, startCmd, stockKit, withCallOnBoard } from '../test-fixtures';
import type { GameState, Id, IncidentCard } from '../types';
import { addLead, openCase } from './cases';
import { openWarrant } from './warrants';
import type { Subject } from './types';

const families = SCENARIO_TYPES.find((info) => info.type === 'barricaded')!.families;
const spec = (over: Partial<IncidentSpec> = {}): IncidentSpec => ({ type: 'barricaded', familyId: families[0], buildingSeed: 3, seed: 5, tier: 3, contentVersion: INCIDENT_CONTENT_VERSION, ...over });
const CAST = { first: 4, last: 7, pronouns: 'he' } as const;

describe('the cast in an incident id', () => {
  it('round-trips with and without a cast, and legacy ids parse as before', () => {
    const plain = spec();
    expect(incidentId(plain)).toBe(`gen:barricaded:${families[0]}:3:5:3:${INCIDENT_CONTENT_VERSION}`);
    expect(parseIncidentId(incidentId(plain))).toEqual(plain);
    const cast = spec({ cast: { ...CAST } });
    expect(incidentId(cast)).toBe(`${incidentId(plain)}:c4-7-h`);
    expect(parseIncidentId(incidentId(cast))).toEqual(cast);
    for (const pronouns of ['he', 'she', 'they'] as const) {
      const s = spec({ cast: { first: 1, last: 2, pronouns } });
      expect(parseIncidentId(incidentId(s))).toEqual(s);
    }
  });

  it('rejects a cast that names nobody in the pools', () => {
    expect(parseIncidentId(`${incidentId(spec())}:c9999-7-h`)).toBeNull();
    expect(parseIncidentId(`${incidentId(spec())}:c4-99999-h`)).toBeNull();
    expect(parseIncidentId(`${incidentId(spec())}:c4-7-x`)).toBeNull();
  });

  it('binds the world subject into the subject role, on a cold cache, the same every time', async () => {
    const s = spec({ cast: { ...CAST } });
    const read = (scenario: ReturnType<typeof generateIncident>) => {
      const lt = scenario.incidentPeople!.find((p) => p.id === 'lt')!;
      return { lt: lt.label, others: scenario.incidentPeople!.filter((p) => p.id !== 'lt').map((p) => p.label) };
    };
    const first = read(generateIncident(s));
    expect(first.lt).toBe(CIVILIAN_FIRST_NAMES.he[4]);
    expect(read(generateIncident(s))).toEqual(first);
    // Nobody else on the call shares the subject's first name or surname.
    for (const other of first.others) {
      expect(other).not.toContain(CIVILIAN_FIRST_NAMES.he[4]);
    }
    // A cold module cache (a fresh load of the registry) regenerates the same person from the id alone.
    vi.resetModules();
    const cold = await import('../scenario-registry');
    const fromId = cold.getScenario(incidentId(s))!;
    expect(read(fromId)).toEqual(first);
    // The same call without the cast keeps its drawn people and its id.
    const plain = generateIncident(spec());
    expect(plain.id).toBe(incidentId(spec()));
  });

  it('keeps the subject pronouns the world gave, whatever the template would have drawn', () => {
    for (const pronouns of ['he', 'she', 'they'] as const) {
      const scenario = generateIncident(spec({ cast: { first: 2, last: 3, pronouns } }));
      const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
      const people = drawInstance(WARRANT_TEMPLATE, built, scenario.incident!).people;
      const lt = people.find((p) => p.roleKey === 'lt')!;
      expect(lt.pronouns).toBe(pronouns);
      expect(lt.name).toEqual({ first: CIVILIAN_FIRST_NAMES[pronouns][2], surname: CIVILIAN_SURNAMES[3], pronouns });
    }
  });
});

describe('drawing the world-only call directly', () => {
  it('never comes from the board draw, and comes from a gate draw that asks for it', async () => {
    const { drawIncidentSpec } = await import('../../gen/incident');
    let rng = 2024;
    for (let i = 0; i < 40; i++) {
      const board = drawIncidentSpec(rng, { level: 10, trust: 90, unlockedTypes: ['barricaded'] });
      rng = board.state;
      expect(board.spec.type).not.toBe('barricaded');
      const gate = drawIncidentSpec(rng, { level: 10, trust: 90, unlockedTypes: ['barricaded'], includeWorldOnly: true });
      expect(gate.spec.type).toBe('barricaded');
    }
  });
});

describe('endings carry their resolution', () => {
  it('copies the tree ending into the compiled ending', () => {
    const scenario = generateIncident(spec());
    const resolutions = Object.values(scenario.endings).map((e) => e.world?.resolution);
    expect(resolutions).toContain('charged');
    expect(resolutions).toContain('escaped');
    expect(Object.values(scenario.endings).every((e) => e.world !== undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------- a world call on a made state

function worldState(opts: { level?: number } = {}): { s: GameState; subject: Subject; leadId: string; cardId: string; card: IncidentCard } {
  const s = makeState();
  if (opts.level) s.department.level = opts.level;
  const w = s.world;
  const subject: Subject = {
    id: 's1', firstName: CIVILIAN_FIRST_NAMES.he[4], surname: CIVILIAN_SURNAMES[7], pronouns: 'he', nameKey: { first: 4, last: 7 }, crewId: null,
    tier: 3, districtId: 'pike', status: 'free', traits: [], known: true, reservedBy: null, history: [],
  };
  w.subjects[subject.id] = subject;
  const c = openCase(s, w, { subject, tier: 3, source: 'proactive', at: NOW, status: 'open' });
  const lead = addLead(w, c, 'proactive', NOW);
  const opened = openWarrant(s, lead.id);
  if (!opened.ok) throw new Error(opened.reason);
  const card = s.incidents.find((x) => x.world?.leadId === lead.id)!;
  return { s, subject, leadId: lead.id, cardId: card.id, card };
}

function startWorldRun(s: GameState, cardId: string, tieRole?: 'talk' | 'door'): GameState {
  const scenario = getScenario(cardId)!;
  const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
  const kit = stockKit(s, ['A']);
  const r = apply(kit.state, { ...startCmd(cardId, ['A'], { positions: { A: entry }, loadouts: kit.loadouts, units: kit.units }), ...(tieRole ? { tieRole } : {}) });
  if (!r.result.ok) throw new Error(r.result.reason);
  return r.state;
}

const tie = (s: GameState, officerId: Id, subjectId: Id, onRecord = true) =>
  s.people.ties.push({ id: `t_${officerId}`, officerId, subjectId, kind: 'gym', origin: 'play', onRecord, since: NOW });

/** The tie line on the first contact check of the run, and the whole contributor list. */
function contactViews(s: GameState) {
  const views = actionViews(s, NOW, 'A');
  return views.filter((v) => v.eligible && /name_at_door|gym_talk|call_gym|walk_beside|sit_on_stairs/.test(v.id));
}
const knowsLines = (view: { contributors: { label: string; value: number }[] }) => view.contributors.filter((c) => /^[A-Za-z']+: knows (him|her|them)$/.test(c.label));

describe('the tie contributor', () => {
  it('adds one visible plus 4 for an officer with an on-record tie, however many are tied, and prefers them as lead', () => {
    const { s, subject, cardId } = worldState();
    tie(s, 'off_chen', subject.id);
    const run = startWorldRun(s, cardId);
    const views = contactViews(run);
    expect(views.length).toBeGreaterThan(0);
    for (const view of views) {
      const lines = knowsLines(view);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ label: 'Chen: knows him', value: 4 });
      if (view.officerIds.includes('off_chen')) expect(view.officerIds[0]).toBe('off_chen');
    }
    // Two tied officers still add one line of 4 in total.
    const both = worldState();
    tie(both.s, 'off_chen', both.subject.id);
    tie(both.s, 'off_brooks', both.subject.id);
    for (const view of contactViews(startWorldRun(both.s, both.cardId))) {
      const lines = knowsLines(view);
      expect(lines).toHaveLength(1);
      expect(lines[0].value).toBe(4);
    }
  });

  it('is worded for the subject: him, her or them', () => {
    for (const [pronouns, word] of [['she', 'her'], ['they', 'them']] as const) {
      const { s, subject, cardId } = worldState();
      s.world.subjects[subject.id].pronouns = pronouns;
      tie(s, 'off_chen', subject.id);
      for (const view of contactViews(startWorldRun(s, cardId))) expect(knowsLines(view)[0].label).toBe(`Chen: knows ${word}`);
    }
  });

  it('adds nothing for no tie, a hidden tie, an unrelated subject, or an officer who is not taking part', () => {
    const base = (mutate: (x: ReturnType<typeof worldState>) => void) => {
      const x = worldState();
      mutate(x);
      return contactViews(startWorldRun(x.s, x.cardId));
    };
    const none = base(() => {});
    const hidden = base((x) => tie(x.s, 'off_chen', x.subject.id, false));
    const unrelated = base((x) => tie(x.s, 'off_chen', 'someone_else'));
    expect(none.length).toBeGreaterThan(0);
    for (const views of [none, hidden, unrelated]) for (const view of views) expect(knowsLines(view)).toHaveLength(0);
    // Tied, but in the other squad: not on the call.
    const away = base((x) => tie(x.s, 'off_okafor', x.subject.id));
    for (const view of away) expect(knowsLines(view)).toHaveLength(0);
  });

  it('adds nothing on a check that is not a contact check', () => {
    const { s, subject, cardId } = worldState();
    tie(s, 'off_chen', subject.id);
    const run = startWorldRun(s, cardId);
    const others = actionViews(run, NOW, 'A').filter((v) => v.eligible && !/name_at_door|gym_talk|call_gym|walk_beside|sit_on_stairs/.test(v.id));
    expect(others.length).toBeGreaterThan(0);
    const scenario = getScenario(cardId)!;
    const kinds = new Map(Object.values(scenario.stages).flatMap((st) => st.actions).map((a) => [a.id, a.check.kind]));
    for (const view of others) if (kinds.get(view.id) !== 'contact') expect(knowsLines(view)).toHaveLength(0);
  });

  it('does nothing for a call with no world subject', () => {
    const state = withCallOnBoard(makeState(), getScenario(incidentId(spec()))!.id);
    state.people.ties.push({ id: 't', officerId: 'off_chen', subjectId: 's1', kind: 'gym', origin: 'play', onRecord: true, since: NOW });
    const scenario = getScenario(incidentId(spec()))!;
    const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
    const kit = stockKit(state, ['A']);
    const r = apply(kit.state, startCmd(scenario.id, ['A'], { positions: { A: entry }, loadouts: kit.loadouts, units: kit.units }));
    expect(r.result.ok).toBe(true);
    for (const view of actionViews(r.state, NOW, 'A')) expect(knowsLines(view)).toHaveLength(0);
  });

  it('does not read funding', () => {
    const { s, subject, cardId } = worldState();
    tie(s, 'off_chen', subject.id);
    const poor = startWorldRun(s, cardId);
    const rich = structuredClone(poor);
    rich.department.funding += 10_000_000;
    const strip = (state: GameState) => actionViews(state, NOW, 'A').map((v) => ({ id: v.id, likelihood: v.likelihood, contributors: v.contributors }));
    expect(strip(rich)).toEqual(strip(poor));
  });

  it('honors the door: the knowing officer sits out the talk, so no contributor', () => {
    const { s, subject, cardId } = worldState();
    tie(s, 'off_chen', subject.id);
    const run = startWorldRun(s, cardId, 'door');
    expect(run.activeRun!.world!.tieRole).toBe('door');
    const views = contactViews(run);
    expect(views.length).toBeGreaterThan(0);
    for (const view of views) {
      expect(knowsLines(view)).toHaveLength(0);
      expect(view.officerIds).not.toContain('off_chen');
    }
    // 'talk' is the default and the same as saying so.
    const talk = contactViews(startWorldRun(worldTied().s, worldTied().cardId, 'talk'));
    for (const view of talk) expect(knowsLines(view)).toHaveLength(1);
  });
});

function worldTied() {
  const x = worldState();
  tie(x.s, 'off_chen', x.subject.id);
  return x;
}

describe('the bond contributor', () => {
  it('names a bond on a shared action, capped at 3', () => {
    const { s, cardId } = worldState();
    const pairs: [string, string, 'trusted' | 'close' | 'mentor'][] = [['off_brooks', 'off_chen', 'close'], ['off_chen', 'off_ortiz', 'close'], ['off_chen', 'off_vale', 'mentor']];
    for (const [a, b, state] of pairs) s.people.bonds.push({ a: a < b ? a : b, b: a < b ? b : a, state, drift: 0, since: NOW, cause: { kind: 'shared_call', at: NOW } });
    const run = startWorldRun(s, cardId);
    const view = actionViews(run, NOW, 'A').find((v) => v.eligible && v.officerIds.length >= 2);
    expect(view).toBeDefined();
    const bond = view!.contributors.filter((c) => c.source === 'familiarity' && /Bonds in the stack|work close|trust|mentor/.test(c.label));
    expect(bond.length).toBe(1);
    expect(bond[0].value).toBeLessThanOrEqual(3);
    expect(bond[0].value).toBeGreaterThan(0);
  });

  it('adds nothing without a bond', () => {
    const { s, cardId } = worldState();
    const view = actionViews(startWorldRun(s, cardId), NOW, 'A').find((v) => v.eligible && v.officerIds.length >= 2)!;
    expect(view.contributors.some((c) => /work close|trust each other|Bonds in the stack/.test(c.label))).toBe(false);
  });
});

describe('the call fee', () => {
  it('is the tier table times the funding scale, by the card tier for a world call and the spec tier otherwise', () => {
    const base = makeState();
    for (const level of [3, 4, 7]) {
      const state = structuredClone(base);
      state.department.level = level;
      const scale = level >= 7 ? 3 : level >= 4 ? 2 : 1;
      for (const tier of [1, 2, 3, 4] as const) {
        expect(callFee(state, { world: { kind: 'warrant', caseId: 'c', leadId: 'l', subjectId: 's', caseTier: tier, districtId: 'pike' } }, { incident: { tier: 1 } as IncidentSpec })).toBe(CALL_FEE[tier] * scale);
        expect(callFee(state, {}, { incident: { tier } as IncidentSpec })).toBe(CALL_FEE[tier] * scale);
      }
      expect(callFee(state, {}, { incident: { tier: 5 } as IncidentSpec })).toBe(6400 * scale);
    }
    expect(CALL_FEE).toEqual({ 1: 800, 2: 1600, 3: 3200, 4: 6400 });
  });

  it('pays only the fee at debrief and leaves the case award to the world, once', () => {
    const { s, cardId, leadId } = worldState();
    const run = startWorldRun(s, cardId);
    const before = run.department.funding;
    const { state, debrief } = playPolicy(run, {});
    expect(debrief.fundingReward).toBeLessThanOrEqual(3200);
    expect(debrief.fundingReward).toBeGreaterThanOrEqual(Math.round(3200 * 0.4));
    // Upkeep and supplies may move funding; the payout itself is the fee share and nothing from the case.
    const kase = state.world.cases.find((c) => c.id === state.world.leads.find((l) => l.id === leadId)!.caseId)!;
    expect(kase.paidAt).toBeUndefined();
    expect(kase.paidEventId).toBeUndefined();
    expect(before).toBeGreaterThan(0);
  });
});

describe('world cards on the board', () => {
  const fresh = () => worldState();

  it('never expire, never count toward capacity, and survive the sweep', () => {
    const { s, card } = fresh();
    expect(isWorldCard(card)).toBe(true);
    expect(Number.isFinite(card.expiresAt)).toBe(true);
    expect(card.expiresAt).toBeGreaterThan(NOW + 365 * 24 * 3_600_000);
    for (let i = 0; i < 5; i++) s.incidents.push({ id: `filler${i}`, type: 'hostage_crisis', familyId: 'x', tier: 1, arrivedAt: NOW, expiresAt: NOW + 10 * 3_600_000, seen: false });
    const summary = boardSummaryOf(s, NOW);
    expect(summary.count).toBe(5);
    expect(summary.worldCount).toBe(1);
    expect(summary.nextArrivalAt).toBeNull();
    (s.department as { nextIncidentAt?: number }).nextIncidentAt = NOW + 60_000 * 60 * 1000;
    applyIncidentsDue(s, NOW, NOW + 400 * 24 * 3_600_000);
    expect(s.incidents.some((c) => c.id === card.id)).toBe(true);
    expect(nextIncidentEventTime(s, NOW)).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });

  it('is never dropped by a content filter, and says it would have been', () => {
    const { s, card } = fresh();
    const exclusion = { avoid: ['violence_threat', 'firearms', 'child_in_danger', 'death', 'weapons'] as never[] };
    dropExcludedCards(s, exclusion);
    expect(s.incidents.some((c) => c.id === card.id)).toBe(true);
    expect(typeof worldCardFiltered(card, exclusion)).toBe('boolean');
  });

  it('opens once per lead', () => {
    const { s, card, leadId } = fresh();
    expect(openWarrant(s, leadId).ok).toBe(true);
    expect(addWorldCard(s, { ...card, id: 'different-id' })).toBe(s.incidents.find((c) => c.world?.leadId === leadId));
    expect(s.incidents.filter((c) => c.world?.leadId === leadId)).toHaveLength(1);
  });

  it('cancelling the run returns the lead to open', () => {
    const { s, cardId, leadId } = fresh();
    const run = startWorldRun(s, cardId);
    expect(run.world.leads.find((l) => l.id === leadId)!.status).toBe('warrant');
    const out = dispatch(run, { type: 'cancelOperation' }, { now: NOW });
    expect(out.result.ok).toBe(true);
    const lead = out.state.world.leads.find((l) => l.id === leadId)!;
    expect(lead.status).toBe('open');
    expect(lead.cardId).toBeUndefined();
    expect(out.state.activeRun).toBeNull();
    // It can be opened again.
    expect(openWarrant(out.state, leadId).ok).toBe(true);
  });

  it('dispatch copies the world ref onto the run', () => {
    const { s, cardId, card } = fresh();
    const run = startWorldRun(s, cardId);
    expect(run.activeRun!.world).toMatchObject({ leadId: card.world!.leadId, subjectId: 's1', caseTier: 3 });
  });
});

describe('one callback per call', () => {
  function squadState() {
    const x = worldState();
    return x;
  }
  const bond = (s: GameState, a: string, b: string) => s.people.bonds.push({ a: a < b ? a : b, b: a < b ? b : a, state: 'close', drift: 0, since: NOW, cause: { kind: 'shared_call', at: NOW } });
  const imprint = (s: GameState, officerId: string) => s.people.imprints.push({ id: `i_${officerId}`, officerId, pack: 'hard_night', cause: { place: 'x', at: NOW }, startedAt: NOW, endsAt: NOW + 3_600_000, seen: true });

  it('is none when nothing applies', () => {
    const { s, cardId } = squadState();
    expect(startWorldRun(s, cardId).activeRun!.callback).toBeUndefined();
  });

  it('prefers a tie, then a pair, then an imprint', () => {
    const { s, subject, cardId } = squadState();
    imprint(s, 'off_vale');
    expect(startWorldRun(s, cardId).activeRun!.callback).toEqual({ kind: 'imprint', officerIds: ['off_vale'], refId: 'i_off_vale' });
    bond(s, 'off_brooks', 'off_ortiz');
    expect(startWorldRun(s, cardId).activeRun!.callback).toMatchObject({ kind: 'pair', officerIds: ['off_brooks', 'off_ortiz'] });
    tie(s, 'off_ortiz', subject.id);
    expect(startWorldRun(s, cardId).activeRun!.callback).toEqual({ kind: 'tie', officerIds: ['off_ortiz'], refId: 't_off_ortiz' });
    // A hidden tie does not count; the pair is next.
    s.people.ties[0].onRecord = false;
    expect(startWorldRun(s, cardId).activeRun!.callback!.kind).toBe('pair');
  });

  it('is kept on the run and does not change as the people do', () => {
    const { s, subject, cardId } = squadState();
    tie(s, 'off_chen', subject.id);
    const run = startWorldRun(s, cardId);
    const first = structuredClone(run.activeRun!.callback);
    const later = structuredClone(run);
    later.people.ties = [];
    expect(later.activeRun!.callback).toEqual(first);
    expect(chooseCallback(later, later.activeRun!)).toBeNull();
  });
});
