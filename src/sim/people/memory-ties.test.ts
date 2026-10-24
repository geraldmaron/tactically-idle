import { describe, expect, it } from 'vitest';
import { applyPeopleDebrief, recordCaseFact, seedTiesForSubject } from './index';
import { jacketView, peopleBeatsFor } from './selectors';
import { detailFor, bindShape } from './memory';
import { PEOPLE_TUNING } from './tuning';
import { FACT_SHAPES } from '../../content/people/facts';
import { advance, buildCall, CONTACT_ACTION, freshState, scenarioFixture } from '../fixtures/people-fixtures';
import { validPeopleState } from './validate';
import type { GameState, Id } from '../types';
import type { Subject } from '../world/types';
import type { FactKind, MemoryFact } from './types';

function subject(id: string, districtId: Subject['districtId']): Subject {
  return {
    id, firstName: 'Dale', surname: 'Moss', pronouns: 'he', nameKey: { first: 0, last: 0 }, crewId: null, tier: 2, districtId,
    status: 'free', traits: [], known: true, reservedBy: null, history: [],
  };
}

/** Give an officer a home district by lending them an authored persona (the seat shuffle decides who is who). */
function lend(d: GameState, officerId: Id, personaId: string): void {
  d.officers[officerId].identityId = personaId;
  d.people.records[officerId].identityId = personaId;
}

describe('memory facts', () => {
  it('a first call, a negotiated contact and a rescue are recorded with the place, colleagues and a detail of 80 or fewer characters', () => {
    const d = freshState();
    advance(d, 1);
    const { run, result } = buildCall(d, { officers: ['off_chen', 'off_ortiz'], verdict: 'favorable', disposition: 'resolved', pressure: 60, steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_chen'], pressureDelta: 5 }] });
    applyPeopleDebrief(d, run, result, 'favorable');
    const mine = d.people.facts.filter((f) => f.officerId === 'off_chen');
    expect(mine.map((f) => f.kind).sort()).toEqual(['favorable_under_pressure', 'first_call', 'negotiated', 'rescue']);
    for (const f of mine) {
      expect(f.place).toBe('Cedar Close');
      expect(f.with).toEqual(['off_ortiz']);
      expect(f.runId).toBe(run.id);
      expect(f.detail.length).toBeLessThanOrEqual(80);
      expect(f.detail.length).toBeGreaterThan(10);
    }
    // Ortiz was on the call but on no step: a first call and nothing she did not do.
    expect(d.people.facts.filter((f) => f.officerId === 'off_ortiz').map((f) => f.kind)).toEqual(['first_call']);
  });

  it('never carries a civilian name from the call, and never a dash or a colon', () => {
    const d = freshState();
    const { scenario } = scenarioFixture();
    const names = (scenario.civilianOutcomes ?? []).flatMap((c) => c.label.toLowerCase().split(' '));
    expect(names.length).toBeGreaterThan(0);
    for (let i = 0; i < 6; i++) {
      advance(d, 1);
      const { run, result } = buildCall(d, { officers: ['off_chen', 'off_ortiz'], verdict: 'favorable', disposition: 'resolved', pressure: 60, hurt: i === 2 ? ['off_chen'] : [], steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_chen', 'off_ortiz'], pressureDelta: 5 }] });
      result.endingTitle = i % 2 ? 'Victoria Morrison walked out' : 'Out on camera';
      applyPeopleDebrief(d, run, result, 'favorable');
    }
    for (const f of d.people.facts) {
      const lower = f.detail.toLowerCase();
      for (const n of names) expect(lower, `${f.detail} names ${n}`).not.toContain(n);
      expect(f.detail).not.toMatch(/[–—:]| - /);
    }
  });

  it('an officer\'s next entry of a kind uses another shape, so two entries never share a frame', () => {
    const shapes = FACT_SHAPES.negotiated;
    const slots = { place: 'Cedar Close', minutes: 24, steps: 3 };
    const existing: MemoryFact[] = [];
    const seen: string[] = [];
    for (let i = 0; i < shapes.length; i++) {
      const detail = detailFor('negotiated', slots, existing, new Set())!;
      seen.push(detail);
      existing.push({ id: `f${i}`, officerId: 'x', at: i, kind: 'negotiated', place: 'x', with: [], detail });
    }
    expect(new Set(seen).size).toBe(shapes.length);
    const opening = (s: string) => s.split(' ').slice(0, 3).join(' ');
    expect(new Set(seen.map(opening)).size).toBe(shapes.length);
  });

  it('every kind has three shapes that bind within 80 characters for a long place', () => {
    for (const kind of Object.keys(FACT_SHAPES) as FactKind[]) {
      expect(FACT_SHAPES[kind]).toHaveLength(3);
      let fits = 0;
      for (const shape of FACT_SHAPES[kind]) {
        const text = bindShape(shape, { place: 'Blue Heron Grill', minutes: 41, steps: 4, ending: 'Out on camera', label: 'Fall at the doorway while meeting the resident', colleague: 'Okafor', tier: 2, caseEnd: 'in a charge', hours: 4, days: 3 });
        if (text && text.length <= 80) fits++;
      }
      expect(fits, kind).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the newest facts per officer and the same call is recorded once', () => {
    const d = freshState();
    const { run, result } = buildCall(d, { officers: ['off_chen'], verdict: 'favorable', steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_chen'] }] });
    applyPeopleDebrief(d, run, result, 'favorable');
    const count = d.people.facts.length;
    applyPeopleDebrief(d, run, result, 'favorable');
    expect(d.people.facts.length).toBe(count);
    for (let i = 0; i < PEOPLE_TUNING.factsPerOfficer + 5; i++) {
      advance(d, 1);
      const c = buildCall(d, { officers: ['off_chen'], verdict: 'favorable', hurt: ['off_chen'], steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_chen'] }] });
      applyPeopleDebrief(d, c.run, c.result, 'favorable');
    }
    expect(d.people.facts.filter((f) => f.officerId === 'off_chen').length).toBeLessThanOrEqual(PEOPLE_TUNING.factsPerOfficer);
  });
});

describe('ties', () => {
  it('jacket ties form only for subjects from the officer\'s own home district, at most three, never as a number', () => {
    const d = freshState();
    lend(d, 'off_brooks', 'person_002'); // home district: pike
    lend(d, 'off_chen', 'person_001');   // home district: harbor
    for (let i = 0; i < 200; i++) {
      const s = subject(`s${i}`, 'pike');
      d.world.subjects[s.id] = s;
      seedTiesForSubject(d, s.id);
    }
    const brooks = d.people.ties.filter((t) => t.officerId === 'off_brooks');
    expect(brooks.length).toBeGreaterThan(0);
    expect(brooks.length).toBeLessThanOrEqual(PEOPLE_TUNING.ties.cap);
    expect(d.people.ties.filter((t) => t.officerId === 'off_chen')).toHaveLength(0);
    for (const t of brooks) {
      expect(t.origin).toBe('jacket');
      expect(['gym', 'old_job']).toContain(t.kind);
      expect(Object.keys(t).sort()).toEqual(['id', 'kind', 'officerId', 'onRecord', 'origin', 'since', 'subjectId']);
    }
    expect(validPeopleState(d.people, { officers: d.officers, subjectIds: new Set(Object.keys(d.world.subjects)) })).toBeNull();
  });

  it('is deterministic: the same subjects give the same ties on a second run', () => {
    const run = () => {
      const d = freshState();
      lend(d, 'off_brooks', 'person_002');
      for (let i = 0; i < 60; i++) { const s = subject(`s${i}`, 'pike'); d.world.subjects[s.id] = s; seedTiesForSubject(d, s.id); }
      return d.people.ties.map((t) => [t.subjectId, t.kind, t.onRecord]);
    };
    expect(run()).toEqual(run());
  });

  it('a templated persona has no home district and no jacket ties', () => {
    const d = freshState();
    lend(d, 'off_chen', 'person_050');
    for (let i = 0; i < 100; i++) { const s = subject(`s${i}`, 'harbor'); d.world.subjects[s.id] = s; seedTiesForSubject(d, s.id); }
    expect(d.people.ties).toHaveLength(0);
  });

  it('a share of jacket ties start off the record and surface as a beat when the officer works that subject', () => {
    const d = freshState();
    lend(d, 'off_brooks', 'person_002');
    let hidden: string | undefined;
    for (let i = 0; i < 400 && !hidden; i++) {
      const s = subject(`s${i}`, 'pike');
      d.world.subjects[s.id] = s;
      seedTiesForSubject(d, s.id);
      hidden = d.people.ties.find((t) => !t.onRecord)?.subjectId;
      // Keep the officer under the cap so more subjects can form ties.
      if (d.people.ties.length >= PEOPLE_TUNING.ties.cap && !hidden) d.people.ties = [];
    }
    expect(hidden).toBeDefined();
    const tie = d.people.ties.find((t) => t.subjectId === hidden)!;
    // Not on the record: the jacket does not show it and no beat exists.
    expect(jacketView(d, 'off_brooks')!.ties.map((t) => t.id)).not.toContain(tie.id);
    // A call that served this subject brings it to light.
    advance(d, 1);
    const { run, result } = buildCall(d, { officers: ['off_brooks', 'off_ortiz'], verdict: 'favorable', world: true, steps: [{ actionId: CONTACT_ACTION().id, band: 'favorable', officers: ['off_brooks'] }] });
    (run.world as { subjectId: string }).subjectId = hidden!;
    applyPeopleDebrief(d, run, result, 'favorable');
    expect(tie.onRecord).toBe(true);
    expect(d.people.beats.filter((b) => b.kind === 'tie_surfaced' && b.refId === tie.id)).toHaveLength(1);
    expect(jacketView(d, 'off_brooks')!.ties.map((t) => t.id)).toContain(tie.id);
    expect(peopleBeatsFor(d, ['off_brooks']).some((b) => /knows/.test(b.line))).toBe(true);
  });

  it('a closed case records an arrest fact and a prior_arrest tie for each officer who worked it, once', () => {
    const d = freshState();
    const s = subject('s1', 'larkin');
    d.world.subjects.s1 = s;
    d.world.cases.push({
      id: 'c1', subjectId: 's1', crewId: null, archetype: null, tier: 2, districtId: 'larkin', source: 'warrant', openedAt: 0, status: 'closed', closesAt: 1, repeat: false,
      resolution: 'charged', award: 600, paidAt: d.department.clockHighWater, paidEventId: 'e1', officerIds: ['off_chen', 'off_ortiz', 'off_ghost'],
    });
    recordCaseFact(d, 'c1');
    recordCaseFact(d, 'c1');
    recordCaseFact(d, 'nothing');
    const facts = d.people.facts.filter((f) => f.kind === 'arrest');
    expect(facts.map((f) => f.officerId).sort()).toEqual(['off_chen', 'off_ortiz']);
    expect(facts[0]).toMatchObject({ caseId: 'c1', place: 'Larkin' });
    expect(facts[0].detail).toMatch(/tier 2/);
    expect(facts[0].detail.length).toBeLessThanOrEqual(80);
    const ties = d.people.ties.filter((t) => t.kind === 'prior_arrest');
    expect(ties.map((t) => [t.officerId, t.subjectId, t.onRecord, t.origin]).sort()).toEqual([['off_chen', 's1', true, 'play'], ['off_ortiz', 's1', true, 'play']]);
  });
});
