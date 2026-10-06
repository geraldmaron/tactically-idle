import { withLegacyRadios } from './test-fixtures';
import { describe, expect, it } from 'vitest';
import type { BuiltLocation, Contributor, GameState, Id, LocationDefinition, SquadId, Vec } from './types';
import type { ActionDefinition, ScenarioDefinition } from './scenario-types';
import { scenarioActions } from './scenario-types';
import { SCENARIOS } from '../content/scenarios';
import { ITEMS } from '../content/items';
import { DOORS } from '../content/materials';
import { MAPLE_STREET } from '../content/locations/maple-street';
import { buildLocation, deriveLocation } from './location';
import { builtFor, evaluateAction, strainFor, type Evaluation } from './resolution';
import { actionViews, previewAction, spaceViews, spaceViewsForScenario } from './operation-selectors';
import {
  defaultStagingFor,
  entryExposure,
  rangeThroughOpening,
  rangeToPoint,
  resolveSubject,
  routeBetween,
  SPATIAL_TUNING,
  signalQuality,
  toneFor,
} from './spatial-factors';
import { apply, makeState, NOW, playPolicy, setCareer, setRun, setUnitCondition, startCmd, startRun } from './test-fixtures';

const occ = SCENARIOS.ms_occupancy;
const urg = SCENARIOS.ms_urgent;
const RESIDENT: Vec = { x: 42.5, y: 9.2 };

/** A fresh Maple Street (seed 0) with a tweak applied before deriving. */
function variant(tweak: (loc: LocationDefinition) => void = () => {}): BuiltLocation {
  const location = structuredClone(MAPLE_STREET.base);
  tweak(location);
  return { location, derived: deriveLocation(location), issues: [] };
}
const opening = (loc: LocationDefinition, id: string) => loc.openings.find((o) => o.id === id)!;
const actionOf = (s: ScenarioDefinition, id: Id): ActionDefinition => scenarioActions(s).find((a) => a.id === id)!;

function evalAction(state: GameState, action: ActionDefinition | Id, acting: SquadId[], support: SquadId[] = [], built?: BuiltLocation, scenario: ScenarioDefinition = occ): Evaluation {
  const run = state.activeRun!;
  const a = typeof action === 'string' ? actionOf(scenario, action) : action;
  return evaluateAction({ state, run, scenario, action: a, built: built ?? builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting, support });
}

const find = (e: Evaluation, re: RegExp, source?: Contributor['source']) => e.contributors.find((c) => re.test(c.label) && (!source || c.source === source));
const voice = (e: Evaluation) => find(e, /^Voice/, 'space')!;
const sight = (e: Evaluation) => find(e, /^Sightline/, 'space')!;
const heat = (e: Evaluation) => find(e, /^Heat/, 'space')!;
const rest = (e: Evaluation, drop: (c: Contributor) => boolean) => e.contributors.filter((c) => !drop(c));

/** Occupancy at assess with the resident's position confirmed, so signals aim at the exact spot. */
const confirmed = (state: GameState) => setRun(state, { knowledge: { f_occ_e: 'confirmed' } });
const base = () => confirmed(startRun(makeState(), 'ms_occupancy', ['A', 'B']));

describe('contact: the voice reaches the resident through what is in the way', () => {
  it('hollow-core to solid-core door lowers the contact contributor and nothing else', () => {
    const s = base();
    const hollow = evalAction(s, 'ms_contact_hall', ['A'], [], variant());
    const solid = evalAction(
      s,
      'ms_contact_hall',
      ['A'],
      [],
      variant((l) => {
        opening(l, 'd_hall_bede').material = 'solid_core';
      }),
    );
    expect(voice(solid).value).toBeLessThan(voice(hollow).value);
    expect(voice(hollow).label).toMatch(/hollow-core door \(closed\)/);
    expect(voice(solid).label).toMatch(/solid-core door \(closed\)/);
    expect(rest(solid, (c) => c.source === 'space' && /^Voice/.test(c.label))).toEqual(rest(hollow, (c) => c.source === 'space' && /^Voice/.test(c.label)));
  });

  it('opening the door raises it, and the overlay tone follows the transmission', () => {
    const s = base();
    const closed = evalAction(s, 'ms_contact_hall', ['A'], [], variant());
    const open = evalAction(
      s,
      'ms_contact_hall',
      ['A'],
      [],
      variant((l) => {
        opening(l, 'd_hall_bede').state = 'open';
      }),
    );
    expect(voice(open).value).toBeGreaterThan(voice(closed).value);
    const line = (e: Evaluation) => e.overlays.find((o) => o.kind === 'line')!;
    expect(line(closed)).toMatchObject({ kind: 'line', tone: 'partial' });
    expect(line(open)).toMatchObject({ kind: 'line', tone: 'clear' });
    expect((line(open) as { label?: string }).label).toMatch(/^Voice 0\.\d\d$/);
  });

  it('moving the occupant further from the door lowers it', () => {
    const s = base();
    const near = structuredClone(occ);
    near.facts[0].person!.at = { x: 30, y: 14 };
    const far = structuredClone(occ);
    far.facts[0].person!.at = { x: 43, y: 6 };
    const a = evalAction(s, actionOf(near, 'ms_contact_hall'), ['A'], [], variant(), near);
    const b = evalAction(s, actionOf(far, 'ms_contact_hall'), ['A'], [], variant(), far);
    expect(voice(b).value).toBeLessThan(voice(a).value);
    expect(rest(b, (c) => /^Voice/.test(c.label))).toEqual(rest(a, (c) => /^Voice/.test(c.label)));
  });

  it('drawing the blinds lowers the visual contributor but leaves the voice alone', () => {
    const s = base();
    const cover = (c: 'none' | 'blinds' | 'curtains') =>
      variant((l) => {
        for (const id of ['w_bede_e', 'w_bede_n']) opening(l, id).covering = c;
      });
    const bright = cover('none');
    const blinds = cover('blinds');
    const sightNone = evalAction(s, 'ms_gather', ['A'], [], bright);
    const sightBlinds = evalAction(s, 'ms_gather', ['A'], [], blinds);
    expect(sight(sightBlinds).value).toBeLessThan(sight(sightNone).value);
    expect(sight(sightBlinds).label).toMatch(/blinds drawn/);
    const callNone = evalAction(s, 'ms_contact', ['A'], [], bright);
    const callBlinds = evalAction(s, 'ms_contact', ['A'], [], blinds);
    expect(voice(callBlinds).value).toBe(voice(callNone).value);
  });

  it('a wall in the way ("through brick") is named and barely audible', () => {
    const s = base();
    // Stand in the front yard away from any opening: the line crosses brick and the kitchen wall.
    const run = structuredClone(s);
    run.activeRun!.squadTasks[0].stagingId = null;
    run.activeRun!.squadTasks[0].at = { x: 25, y: 38 };
    const here = { ...actionOf(occ, 'ms_contact'), approach: 'none' as const };
    const e = evalAction(run, here, ['A']);
    expect(voice(e).label).toMatch(/brick wall/);
    expect(voice(e).label).toMatch(/barely audible|faint/);
    expect(e.overlays.find((o) => o.kind === 'line')).toMatchObject({ tone: 'blocked' });
  });
});

describe('placement: where the squad stands changes the contributors and overlays', () => {
  const none = (id: Id): ActionDefinition => ({ ...actionOf(occ, id), approach: 'none' });
  const at = (state: GameState, staging: string) => setRun(state, { staging: { A: staging } });

  it('contact from the hall door differs from the east window, and the overlay starts at that staging point', () => {
    const s = base();
    const hall = evalAction(at(s, 'sp_d_hall_bede_hall'), none('ms_contact'), ['A']);
    const win = evalAction(at(s, 'sp_w_bede_e_side_yard_e'), none('ms_contact'), ['A']);
    expect(voice(hall).value).not.toBe(voice(win).value);
    expect(voice(hall).label).toMatch(/door/);
    expect(voice(win).label).toMatch(/window/);
    const built = builtFor('maple_street', 0, []);
    const from = (e: Evaluation) => (e.overlays.find((o) => o.kind === 'line') as { from: Vec }).from;
    expect(from(hall)).toEqual(built.derived.stagingPoints.find((p) => p.id === 'sp_d_hall_bede_hall')!.at);
    expect(from(win)).toEqual(built.derived.stagingPoints.find((p) => p.id === 'sp_w_bede_e_side_yard_e')!.at);
  });

  it('thermal reads through an open hall door but barely from outside the window', () => {
    const open = variant((l) => {
      opening(l, 'd_hall_bede').state = 'open';
    });
    let s = startRun(makeState({ inventory: { thermal_imager: 1 } }), 'ms_occupancy', ['A'], { loadouts: { A: { thermal_imager: 1, radio_kit: 1 } } });
    s = setRun(confirmed(s), { stage: 'adapt' });
    const hall = evalAction(at(s, 'sp_d_hall_bede_hall'), none('ms_thermal'), ['A'], [], open);
    const win = evalAction(at(s, 'sp_w_bede_e_side_yard_e'), none('ms_thermal'), ['A'], [], open);
    expect(heat(hall).value).toBeGreaterThan(heat(win).value * 4);
    expect(heat(win).label).toMatch(/barely readable/);
    expect(hall.overlays.some((o) => o.kind === 'range' && o.tone === 'effective' && o.radius === ITEMS.thermal_imager.range!.effective)).toBe(true);
    expect(hall.overlays.some((o) => o.kind === 'range' && o.tone === 'max' && o.radius === ITEMS.thermal_imager.range!.max)).toBe(true);
  });

  it('through a closed hollow-core door heat is faint, which is why opening it matters', () => {
    let s = startRun(makeState({ inventory: { thermal_imager: 1 } }), 'ms_occupancy', ['A'], { loadouts: { A: { thermal_imager: 1 } } });
    s = setRun(confirmed(s), { stage: 'adapt', staging: { A: 'sp_d_hall_bede_hall' } });
    const closed = evalAction(s, none('ms_thermal'), ['A'], [], variant());
    const open = evalAction(s, none('ms_thermal'), ['A'], [], variant((l) => (opening(l, 'd_hall_bede').state = 'open')));
    expect(heat(open).value).toBeGreaterThan(heat(closed).value * 3);
  });
});

describe('equipment range', () => {
  it('scales linearly between effective and max range and refuses beyond max', () => {
    const hailer = ITEMS.loud_hailer; // 60 / 120
    const o: Vec = { x: 0, y: 0 };
    expect(rangeToPoint(hailer, o, { x: 40, y: 0 })).toMatchObject({ ok: true, factor: 1 });
    const mid = rangeToPoint(hailer, o, { x: 90, y: 0 });
    expect(mid.ok).toBe(true);
    expect(mid.factor).toBeLessThan(1);
    expect(mid.factor).toBeGreaterThan(SPATIAL_TUNING.rangeFloor);
    expect(rangeToPoint(hailer, o, { x: 119, y: 0 }).factor).toBeLessThan(mid.factor);
    const far = rangeToPoint(hailer, o, { x: 130, y: 0 });
    expect(far.ok).toBe(false);
    expect(far.reason).toBe('Loud hailer: target 130 ft away, max 120 ft');
  });

  it('the throw phone needs an opening of the target room within max range, with a specific reason', () => {
    const built = variant((l) => (opening(l, 'd_hall_bede').state = 'blocked'));
    const r = rangeThroughOpening(built, ITEMS.throw_phone, { x: 12.5, y: 33.5 }, 'bedroom_e');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/^Throw phone: nearest window \d+ ft away, max 35 ft$/);
    const near = rangeThroughOpening(built, ITEMS.throw_phone, { x: 45.5, y: 10.5 }, 'bedroom_e');
    expect(near).toMatchObject({ ok: true, factor: 1 });
    expect(near.overlays.some((o) => o.kind === 'path')).toBe(true);
  });

  it('a squad that can only throw a phone is ineligible from too far away, and a hailer rescues it', () => {
    const built = variant((l) => (opening(l, 'd_hall_bede').state = 'blocked'));
    const here = { ...actionOf(occ, 'ms_contact'), approach: 'none' as const };
    const phoneOnly = setRun(confirmed(startRun(makeState(), 'ms_occupancy', ['A'], { loadouts: { A: { throw_phone: 1, radio_kit: 1 } } })), { staging: { A: 'sp_w_living_s_front_yard' } });
    const e = evalAction(phoneOnly, here, ['A'], [], built);
    expect(e.eligible).toBe(false);
    expect(e.reason).toMatch(/^Throw phone: nearest window \d+ ft away, max 35 ft$/);
    const both = setRun(confirmed(startRun(makeState(), 'ms_occupancy', ['A'], { loadouts: { A: { throw_phone: 1, loud_hailer: 1 } } })), { staging: { A: 'sp_w_living_s_front_yard' } });
    const ok = evalAction(both, here, ['A'], [], built);
    expect(ok.eligible).toBe(true);
    expect(ok.contributors.some((c) => c.source === 'equipment' && /Loud hailer/.test(c.label))).toBe(true);
    expect(ok.contributors.some((c) => /Throw phone/.test(c.label))).toBe(false);
  });

  it('a window approach picks a standing point where the phone reaches, and the action view carries range rings', () => {
    const s = base();
    const v = previewAction(s, NOW, 'ms_contact', ['A'], [])!;
    expect(v.eligible).toBe(true);
    expect(v.overlays.filter((o) => o.kind === 'range').map((o) => (o as { radius: number }).radius)).toEqual([20, 35]);
  });
});

describe('unit condition: the specific unit used sets effectiveness, and wear is per unit', () => {
  const joint = () => {
    const s = withLegacyRadios(setRun(startRun(makeState(), 'ms_urgent', ['A', 'B']), { stage: 'adapt' }), { A: 1, B: 1 });
    const radioB = s.reservations.find((r) => r.squadId === 'B' && r.itemId === 'radio_kit')!.unitId;
    return { s, radioB };
  };

  it('a worn radio lowers the link contributor and adds a separate malfunction-risk contributor', () => {
    const { s, radioB } = joint();
    const healthy = evalAction(setUnitCondition(s, radioB, 90), 'mu_two_point', ['A'], ['B'], undefined, urg);
    const worn = evalAction(setUnitCondition(s, radioB, 30), 'mu_two_point', ['A'], ['B'], undefined, urg);
    const link = (e: Evaluation) => find(e, /Squad B link/, 'equipment')!;
    expect(link(worn).value).toBeLessThan(link(healthy).value);
    const risk = (e: Evaluation) => e.contributors.find((c) => /malfunction risk/.test(c.label));
    expect(risk(healthy)).toBeUndefined();
    expect(risk(worn)!.value).toBeLessThan(0);
    expect(risk(worn)!.ref).toBe(radioB);
    expect(worn.margin).toBeLessThan(healthy.margin);
    // The coordination share and everything else is untouched.
    const keep = (e: Evaluation) => e.contributors.filter((c) => !/Squad B link|malfunction/.test(c.label));
    expect(keep(worn)).toEqual(keep(healthy));
  });

  it('records the specific units used, and settlement wears only those, scaled by each unit’s wear rate', () => {
    const { s, radioB } = joint();
    const worn = structuredClone(setUnitCondition(s, radioB, 30));
    worn.units[radioB].wearRate = 1.25;
    const r = apply(worn, { type: 'decide', actionId: 'mu_two_point', actingSquadIds: ['A'], supportSquadIds: ['B'] });
    expect(r.result.ok).toBe(true);
    const used = r.state.activeRun!.history[0].unitsUsed;
    expect(used).toContain(radioB);
    expect(used).toContain(r.state.reservations.find((x) => x.squadId === 'A' && x.itemId === 'radio_kit')!.unitId);
    // finish the run and settle
    const done = playPolicy(r.state, { adapt: ['mu_stage_medic'], resolve: ['mu_handover'] }, 'A');
    const wear = done.debrief.unitWear.find((w) => w.unitId === radioB)!;
    expect(wear.before).toBe(30);
    expect(wear.after).toBeCloseTo(30 - ITEMS.radio_kit.wear.perUse * 1.25, 1);
    // Units that were reserved but unused (the shields, the second hailer) are untouched.
    for (const u of Object.values(done.state.units)) if (!done.debrief.unitWear.some((w) => w.unitId === u.id)) expect(u.condition).toBe(worn.units[u.id].condition);
    expect(done.debrief.unitWear.every((w) => used.includes(w.unitId) || done.state.debriefs[0].unitWear.some((x) => x.unitId === w.unitId))).toBe(true);
  });

  it('a worn door ram forces a locked door more slowly than a healthy one', () => {
    const solidLocked = variant((l) => {
      opening(l, 'd_hall_bede').material = 'solid_core';
      opening(l, 'd_hall_bede').state = 'locked';
    });
    const s = setRun(startRun(makeState(), 'ms_occupancy', ['B']), { stage: 'resolve' });
    const ram = s.reservations.find((r) => r.itemId === 'door_ram')!.unitId;
    const healthy = evalAction(s, 'ms_controlled_entry', ['B'], [], solidLocked);
    const worn = evalAction(setUnitCondition(s, ram, 12), 'ms_controlled_entry', ['B'], [], solidLocked);
    const noRam = evalAction(startRun(makeState(), 'ms_occupancy', ['B'], { loadouts: { B: { radio_kit: 1, ballistic_shield: 1 } } }), 'ms_controlled_entry', ['B'], [], solidLocked);
    const stage = (e: Evaluation) => e.travelMinutes;
    expect(stage(healthy)).toBeLessThan(stage(worn));
    expect(stage(worn)).toBeLessThan(stage(noRam));
    expect(find(healthy, /Door ram: opens the solid-core door in/, 'equipment')).toBeDefined();
    expect(find(noRam, /Locked solid-core door: 6 min to force/, 'space')).toBeDefined();
    expect(healthy.uses.some((u) => u.unitId === ram)).toBe(true);
  });
});

describe('entry and movement', () => {
  it('forcing a locked door costs its material’s force time, not a flat penalty', () => {
    const route = (material: 'hollow_core' | 'solid_core' | 'steel') => {
      const b = variant((l) => {
        opening(l, 'd_hall_bede').material = material;
        opening(l, 'd_hall_bede').state = 'locked';
      });
      return routeBetween(b, 'hall', { x: 23, y: 16 }, 'bedroom_e', { x: 35, y: 10 }, null);
    };
    const hollow = route('hollow_core');
    const solid = route('solid_core');
    const steel = route('steel');
    expect(solid.forceMinutes).toBe(DOORS.solid_core.forceMinutes);
    expect(solid.minutes - hollow.minutes).toBeCloseTo(DOORS.solid_core.forceMinutes - DOORS.hollow_core.forceMinutes, 1);
    expect(steel.minutes).toBeGreaterThan(solid.minutes);
    const tooled = routeBetween(
      variant((l) => {
        opening(l, 'd_hall_bede').material = 'solid_core';
        opening(l, 'd_hall_bede').state = 'locked';
      }),
      'hall',
      { x: 23, y: 16 },
      'bedroom_e',
      { x: 35, y: 10 },
      { effectiveness: 1 },
    );
    expect(tooled.forceMinutes).toBe(DOORS.solid_core.forceMinutesWithTool);
    expect(tooled.points.length).toBeGreaterThan(2);
  });

  it('a person further inside the room raises exposure, time and strain for an entry', () => {
    const s = setRun(startRun(makeState(), 'ms_occupancy', ['A']), { stage: 'resolve', knowledge: { f_occ_e: 'confirmed' } });
    const placed = (at: Vec) => {
      const sc = structuredClone(occ);
      sc.facts[0].person!.at = at;
      return sc;
    };
    const closeIn = placed({ x: 29, y: 14.5 });
    const deepIn = placed({ x: 43, y: 6 });
    const a = evalAction(s, actionOf(closeIn, 'ms_controlled_entry'), ['A'], [], undefined, closeIn);
    const b = evalAction(s, actionOf(deepIn, 'ms_controlled_entry'), ['A'], [], undefined, deepIn);
    const exposure = (e: Evaluation) => e.contributors.find((c) => /from the nearest/.test(c.label));
    expect(exposure(a)).toBeDefined();
    expect(exposure(b)!.value).toBeLessThan(exposure(a)!.value);
    expect(b.timeBase).toBeGreaterThan(a.timeBase);
    expect(b.exposureMult).toBeGreaterThan(a.exposureMult);
    const run = s.activeRun!;
    const input = (e: Evaluation, sc: ScenarioDefinition) => ({ state: s, run, scenario: sc, action: e.action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'] as SquadId[], support: [] as SquadId[] });
    const sa = strainFor(input(a, closeIn), a, 'mixed');
    const sb = strainFor(input(b, deepIn), b, 'mixed');
    expect(sb.off_brooks).toBeGreaterThan(sa.off_brooks);
    // someone who is not taking part does not pay the exposure premium
    expect(sb.off_ortiz).toBe(sa.off_ortiz);
    expect(entryExposure(builtFor('maple_street', 0, []), { at: { x: 43, y: 6 }, spaceId: 'bedroom_e', basis: 'exact', label: 'Resident', note: null }).distance).toBeGreaterThan(15);
  });

  it('room capacity still caps participants', () => {
    const s = setRun(startRun(makeState(), 'ms_occupancy', ['A']), { stage: 'resolve' });
    expect(evalAction(s, 'ms_controlled_entry', ['A']).participantIds).toHaveLength(1);
  });

  it('the supporting squad’s radio link falls with distance and walls, and without radios only voice range counts', () => {
    const s = setRun(startRun(makeState(), 'ms_occupancy', ['A', 'B']), { stage: 'resolve' });
    const link = (st: GameState) => find(evalAction(st, 'ms_controlled_entry', ['A'], ['B']), /Squad B link/, 'equipment')!;
    const nearLink = link(s);
    const farLink = link(setRun(s, { positions: { B: 'back_yard' } }));
    expect(nearLink.value).toBeGreaterThan(farLink.value);
    const noRadios = withLegacyRadios(startRun(makeState(), 'ms_occupancy', ['A', 'B'], { loadouts: { A: { throw_phone: 1 }, B: { door_ram: 1 } } }), { A: 0, B: 0 });
    const dull = link(setRun(noRadios, { stage: 'resolve', positions: { B: 'back_yard' } }));
    expect(dull.label).toMatch(/no radios/);
    expect(dull.label).toMatch(/out of voice range/);
    expect(dull.value).toBe(0);
  });
});

describe('officer experience and age', () => {
  const pressured = (state: GameState) => setRun(state, { stage: 'adapt', pressure: 70 });
  const exp = (e: Evaluation) => e.contributors.filter((c) => c.source === 'familiarity');

  it('veteran against rookie changes only the pressure and experience contributors', () => {
    const base = startRun(makeState(), 'ms_occupancy', ['A']);
    const vet = pressured(setCareer(base, 'off_chen', { age: 40, service: 20 }));
    const rook = pressured(setCareer(base, 'off_chen', { age: 24, service: 0 }));
    const a = evalAction(vet, 'ms_preserve_time', ['A']);
    const b = evalAction(rook, 'ms_preserve_time', ['A']);
    expect(exp(a).find((c) => /Chen: veteran under pressure \+4/.test(c.label))!.value).toBe(4);
    expect(exp(b).find((c) => /Chen: rookie under pressure/.test(c.label))!.value).toBe(-2);
    // A veteran squad-mate (Brooks) mentors the rookie.
    expect(exp(b).some((c) => /mentoring Chen \+2/.test(c.label))).toBe(true);
    const keep = (e: Evaluation) => e.contributors.filter((c) => c.source !== 'familiarity');
    expect(keep(a)).toEqual(keep(b));
    expect(a.margin).toBeGreaterThan(b.margin);
  });

  it('seasoned gets +2, and experience does nothing when nothing is under pressure', () => {
    const base = startRun(makeState(), 'ms_occupancy', ['A']);
    const seasoned = pressured(setCareer(base, 'off_chen', { age: 40, service: 10 }));
    expect(exp(evalAction(seasoned, 'ms_preserve_time', ['A'])).find((c) => /Chen: seasoned under pressure \+2/.test(c.label))!.value).toBe(2);
    // calm situation, not a pressure-kind check: no band contributor
    const calm = setRun(setCareer(base, 'off_chen', { age: 40, service: 20 }), { stage: 'assess', pressure: 12 });
    expect(exp(evalAction(calm, 'ms_contact', ['A'])).filter((c) => /under pressure/.test(c.label))).toEqual([]);
  });

  it('a veteran mentors a rookie in the same squad', () => {
    const s = setRun(startRun(makeState(), 'ms_urgent', ['B']), { stage: 'adapt' });
    const e = evalAction(s, 'mu_stage_medic', ['B'], [], undefined, urg);
    expect(exp(e).some((c) => /Okafor: mentoring Park \+2/.test(c.label))).toBe(true);
    const alone = structuredClone(s);
    alone.squads[1].officerIds = ['off_lindqvist', 'off_reyes', 'off_park'];
    expect(exp(evalAction(alone, 'mu_stage_medic', ['B'], [], undefined, urg)).some((c) => /mentoring/.test(c.label))).toBe(false);
  });

  it('officers over 50 accrue 5% strain per 5 years, and a rookie adds 15% under pressure', () => {
    const base = startRun(makeState(), 'ms_occupancy', ['A']);
    const prep = (c: Parameters<typeof setCareer>[2]) => setRun(setCareer(base, 'off_brooks', c), { stage: 'resolve', pressure: 70, flags: ['in_contact'] });
    const run = (s: GameState) => {
      const ev = evalAction(s, 'ms_controlled_entry', ['A']);
      const r = s.activeRun!;
      const input = { state: s, run: r, scenario: occ, action: ev.action, built: builtFor(r.locationFamilyId, r.locationSeed, r.flags), acting: ['A'] as SquadId[], support: [] as SquadId[] };
      return { ev, strain: strainFor(input, ev, 'mixed').off_brooks };
    };
    const young = run(prep({ age: 40, service: 9 })); // developing
    const old = run(prep({ age: 60, service: 9 })); // +10%
    expect(old.strain / young.strain).toBeGreaterThan(1.06);
    expect(old.strain / young.strain).toBeLessThan(1.14);
    expect(old.ev.contributors.some((c) => c.source === 'condition' && /Brooks: age 60, \+10% strain/.test(c.label))).toBe(true);
    expect(young.ev.contributors.some((c) => /age \d+, \+/.test(c.label))).toBe(false);
    const rookie = run(prep({ age: 24, service: 0 }));
    expect(rookie.strain / run(prep({ age: 24, service: 3 })).strain).toBeGreaterThan(1.1);
  });

  it('closing a real debrief advances every deployed officer’s career counters once; practice does not', () => {
    const start = startRun(makeState(), 'ms_occupancy', ['A']);
    const done = playPolicy(start, { assess: ['ms_gather'], adapt: ['ms_preserve_time'], resolve: ['ms_handover'] });
    for (const id of ['off_chen', 'off_brooks', 'off_ortiz', 'off_vale']) {
      const c = done.state.officers[id].career;
      expect(c.operations).toBe(1);
      expect(c.favorable + c.adverse).toBeLessThanOrEqual(1);
    }
    expect(done.state.officers.off_okafor.career.operations).toBe(0);
    const practice = playPolicy(startRun(makeState(), 'ms_occupancy', ['A'], { practice: true }), { assess: ['ms_gather'], adapt: ['ms_preserve_time'], resolve: ['ms_handover'] });
    expect(practice.state.officers.off_chen.career.operations).toBe(0);
  });
});

describe('facts, markers and people on the map', () => {
  const kitchen = (s: GameState) => spaceViews(s).find((v) => v.id === 'kitchen')!;

  it('the kitchen marker states the claim, with the source underneath', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A']);
    const k = kitchen(s);
    expect(k.marker).toEqual({ text: 'MOVEMENT?', tone: 'amber', subtext: 'per neighbour' });
    expect(k.marker!.text).not.toMatch(/neighbour/i);
    expect(spaceViewsForScenario('ms_occupancy').find((v) => v.id === 'kitchen')!.marker).toEqual(k.marker);
  });

  it('the room sheet lists the fact with claim, source, note and verify actions across every stage', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A']);
    const f = kitchen(s).facts[0];
    expect(f).toMatchObject({ id: 'f_second', status: 'reported', source: 'Neighbour (unverified)' });
    expect(f.claim).toMatch(/neighbour thinks someone else was moving about in the kitchen/);
    expect(f.note).toMatch(/glazed back door|front window/);
    expect(f.verifyActions).toEqual([{ actionId: 'ms_perimeter_watch', title: 'Watch the perimeter', stage: 'adapt', availableNow: false }]);
    const adapt = setRun(s, { stage: 'adapt' });
    expect(kitchen(adapt).facts[0].verifyActions[0]).toMatchObject({ actionId: 'ms_perimeter_watch', availableNow: true });
    // and the action is listed against the room it checks
    expect(kitchen(adapt).actionIds).toContain('ms_perimeter_watch');
    // the unknown east bedroom lists its own fact and the actions that could settle it
    const bed = spaceViews(s).find((v) => v.id === 'bedroom_e')!;
    expect(bed.facts[0].verifyActions.map((v) => v.actionId)).toEqual(expect.arrayContaining(['ms_contact', 'ms_contact_hall', 'ms_gather', 'ms_thermal']));
    expect(bed.facts[0].verifyActions.find((v) => v.actionId === 'ms_contact')!.availableNow).toBe(true);
  });

  it('a fact the player has no knowledge of is not listed, and a settled one gives its resolved note', () => {
    const s = startRun(makeState(), 'ms_urgent', ['A']);
    expect(spaceViews(s).find((v) => v.id === 'bedroom_e')!.facts).toEqual([]);
    const solved = setRun(s, { knowledge: { f_kitchen: 'disproved', f_patient_e: 'confirmed' } });
    expect(spaceViews(solved).find((v) => v.id === 'kitchen')!.facts[0].note).toBe('The kitchen is empty.');
    expect(spaceViews(solved).find((v) => v.id === 'bedroom_e')!.facts[0]).toMatchObject({ status: 'confirmed', source: 'Heard on scene' });
  });

  it('people appear only at the knowledge level held and never reveal an unconfirmed position', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A']);
    const bed = (st: GameState) => spaceViews(st).find((v) => v.id === 'bedroom_e')!;
    // unknown: nothing about the resident, and the exact point is nowhere in the view model
    expect(bed(s).people).toEqual([]);
    expect(JSON.stringify(spaceViews(s))).not.toContain('42.5');
    // Reported keeps an explicit certainty state and approximate position.
    const reported = bed(setRun(s, { knowledge: { f_occ_e: 'reported' } }));
    expect(reported.people).toHaveLength(1);
    expect(reported.people[0].label).toBe('Resident');
    expect(reported.people[0].status).toBe('reported');
    expect(reported.people[0].at).not.toEqual(RESIDENT);
    expect(JSON.stringify(reported)).not.toContain('"x":42.5');
    // confirmed: the exact point
    const conf = bed(setRun(s, { knowledge: { f_occ_e: 'confirmed' } }));
    expect(conf.people).toEqual([{ id: 'person_f_occ_e', at: RESIDENT, label: 'Resident', kind: 'civilian', status: 'confirmed' }]);
    // the kitchen claim is drawn where it was reported, then disappears once disproved
    expect(kitchen(s).people).toEqual([{ id: 'person_f_second', at: { x: 33.5, y: 26.7 }, label: 'Movement', kind: 'civilian', status: 'reported' }]);
    expect(kitchen(setRun(s, { knowledge: { f_second: 'disproved' } })).people).toEqual([]);
  });

  it('the urgent scenario hides the real patient position until it is confirmed', () => {
    const s = startRun(makeState(), 'ms_urgent', ['A']);
    expect(JSON.stringify(spaceViews(s))).not.toContain('"y":14');
    const found = setRun(s, { knowledge: { f_patient_e: 'confirmed' } });
    expect(spaceViews(found).find((v) => v.id === 'bedroom_e')!.people[0].at).toEqual({ x: 37, y: 14 });
  });
});

describe('staging at start', () => {
  it('defaults to the nearest door point, and honours a chosen point on reachable open ground', () => {
    const built = buildLocation('maple_street', 0);
    expect(defaultStagingFor(built, 'side_yard_e')!.id).toBe('sp_d_back_side_yard_e');
    expect(defaultStagingFor(built, 'front_yard')!.kind).toBe('window'); // no door opens onto the front yard
    const s = startRun(makeState(), 'ms_occupancy', ['A'], { staging: { A: 'sp_w_bede_e_side_yard_e' } });
    expect(s.activeRun!.squadTasks[0]).toMatchObject({ positionId: 'side_yard_e', stagingId: 'sp_w_bede_e_side_yard_e', at: { x: 45.5, y: 10.5 } });
  });

  it('refuses a staging point inside the building, an unknown one, or one for a squad that is not deployed', () => {
    const s = makeState();
    const inside = apply(s, startCmd('ms_occupancy', ['A'], { staging: { A: 'sp_d_hall_bede_hall' } }));
    expect(inside.result.ok).toBe(false);
    if (!inside.result.ok) expect(inside.result.reason).toMatch(/cannot stage there/);
    const unknown = apply(s, startCmd('ms_occupancy', ['A'], { staging: { A: 'nope' } }));
    expect(unknown.result.ok).toBe(false);
    if (!unknown.result.ok) expect(unknown.result.reason).toMatch(/unknown staging point/);
    const stray = apply(s, startCmd('ms_occupancy', ['A'], { staging: { B: 'sp_d_back_side_yard_e' } }));
    expect(stray.result.ok).toBe(false);
  });

  it('actions that move a squad update its position, staging point and token location', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A']);
    const r = apply(s, { type: 'decide', actionId: 'ms_contact_hall', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(r.result.ok).toBe(true);
    const t = r.state.activeRun!.squadTasks[0];
    expect(t).toMatchObject({ positionId: 'hall', stagingId: 'sp_d_hall_bede_hall', at: { x: 25.5, y: 14.35 } });
    // an action that stays put keeps the same staging point
    const before = r.state.activeRun!.squadTasks[0];
    const calm = setRun(r.state, { stage: 'adapt' });
    const wait = apply(calm, { type: 'decide', actionId: 'ms_preserve_time', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(wait.state.activeRun!.squadTasks[0]).toMatchObject({ positionId: before.positionId, stagingId: before.stagingId, at: before.at });
  });
});

describe('overlays', () => {
  it('every action with a spatial factor carries an overlay, and a movement action carries a path', () => {
    const s = base();
    const views = actionViews(s, NOW, 'A');
    for (const id of ['ms_contact', 'ms_contact_hall', 'ms_gather']) {
      const v = views.find((x) => x.id === id)!;
      expect(v.overlays.some((o) => o.kind === 'line')).toBe(true);
      expect(v.overlays.some((o) => o.kind === 'path')).toBe(true);
    }
    const resolving = setRun(s, { stage: 'resolve' });
    const resolve = actionViews(resolving, NOW, 'A');
    expect(resolve.find((x) => x.id === 'ms_controlled_entry')!.overlays.some((o) => o.kind === 'path')).toBe(true);
    expect(resolve.some((x) => x.id === 'ms_handover')).toBe(false);
    // The frozen no-movement action is still previewable for historical compatibility.
    expect(previewAction(resolving, NOW, 'ms_handover', ['A'], [])!.overlays).toEqual([]);
  });

  it('tone thresholds and quality follow the stated cut-offs', () => {
    expect(toneFor(0.6)).toBe('clear');
    expect(toneFor(0.59)).toBe('partial');
    expect(toneFor(0.25)).toBe('partial');
    expect(toneFor(0.24)).toBe('blocked');
    expect(signalQuality(0.3)).toBeCloseTo(0.5, 5);
    expect(signalQuality(0.9)).toBe(1);
  });

  it('unknown and reported positions are flagged as uncertain rather than treated as exact', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A']);
    const unknown = evalAction(s, 'ms_contact_hall', ['A']);
    expect(unknown.uncertainty.some((u) => /Nobody knows where in the bedroom/.test(u))).toBe(true);
    const sub = resolveSubject(occ, builtFor('maple_street', 0, []), { f_occ_e: 'reported', f_second: 'reported' }, 'bedroom_e', 'f_occ_e');
    expect(sub.basis).toBe('reported');
    expect(sub.at).not.toEqual(RESIDENT);
    const exact = resolveSubject(occ, builtFor('maple_street', 0, []), { f_occ_e: 'confirmed', f_second: 'reported' }, 'bedroom_e', 'f_occ_e');
    expect(exact).toMatchObject({ basis: 'exact', at: RESIDENT });
  });
});
