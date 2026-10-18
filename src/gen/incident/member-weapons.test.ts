// A group member's weapon is a belief like the subject's (R-G1): one fact per member that claims they
// hold anything at all, unknown until the team sees them, and every reader of armamentFactId (the
// odds, sightings, the force rules, fact validation) reads it unchanged. Exercised on the group
// fixture, whose members carry a handgun in hand, compiled on a real building.
import { describe, expect, it } from 'vitest';
import { buildLocation } from '../../sim/location';
import { readForceThreat } from '../../sim/authorization';
import { incidentSubjects } from '../../sim/incident-factors';
import { validateScenario } from '../../sim/operation';
import { sightings } from '../../sim/sightings';
import type { KnowledgeStatus } from '../../sim/types';
import { generateIncident } from './index';
import { compileIncident, drawInstance, hostedSpec, memberWeaponFactId } from './instance';
import { memberCounts } from './trees-v13/compile';
import { GROUP_TEMPLATE } from './trees-v13/group-fixture';

function groupCall(members: number) {
  for (let seed = 1; seed < 600; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    try {
      if ((memberCounts(drawInstance(GROUP_TEMPLATE, built, spec).placed).others ?? 0) !== members) continue;
      return { s: compileIncident({ ...base, id: `member-weapons-${seed}`, incident: spec }, built, GROUP_TEMPLATE), built };
    } catch { continue; }
  }
  throw new Error(`No seed draws ${members} others`);
}

const { s, built } = groupCall(2);
const member = s.incidentPeople!.find(person => person.id === 'others_1')!;
const taker = s.incidentPeople!.find(person => person.id === 'taker')!;
const run = (status: KnowledgeStatus) => ({ flags: [] as string[], knowledge: { [member.armamentFactId!]: status } as Record<string, KnowledgeStatus> });

describe('a group member’s weapon is a belief', () => {
  it('each member reads a fact of their own that claims anything at all, and the call validates', () => {
    expect(member.armamentFactId).toBe(memberWeaponFactId('others_1'));
    expect(member.armamentClaim).toBe('any');
    expect(taker.armamentClaim).toBeUndefined();
    const fact = s.facts.find(entry => entry.id === member.armamentFactId)!;
    expect(fact).toMatchObject({ initial: 'unknown', truth: true, showWhenUnknown: false });
    expect(validateScenario(s, built)).toEqual([]);
  });

  it('a look into their room settles it, like the subject’s', () => {
    const look = { ...Object.values(s.stages)[0].actions[0], observes: [member.spaceId] };
    const seen = sightings(s, { flags: [], knowledge: {}, pressure: 0 }, look, 'favorable', []);
    expect(seen?.knowledge).toContainEqual({ factId: member.armamentFactId, status: 'confirmed' });
  });

  it('the odds read their weapon as unknown until seen, then as it is (incidentSubjects)', () => {
    const read = (status: KnowledgeStatus) => incidentSubjects(s, run(status), built).find(subject => subject.personId === member.id)!;
    expect(read('unknown')).toMatchObject({ armament: 'unknown', armSource: 'assumed' });
    expect(read('confirmed')).toMatchObject({ armament: member.threat!.armament, armSource: 'confirmed' });
  });
});

describe('force rules read a member’s weapon only once the team believes it (behavior change)', () => {
  it('a member with a gun in hand is force:unseen before the team believes their weapon, force:gun after', () => {
    expect(member.threat).toMatchObject({ armament: 'handgun', readiness: 'brandished' });
    expect(readForceThreat(s, run('unknown'), member)).toEqual({ deadly: false, rule: 'force:unseen' });
    expect(readForceThreat(s, run('disproved'), member)).toEqual({ deadly: false, rule: 'force:unseen' });
    expect(readForceThreat(s, run('reported'), member)).toEqual({ deadly: true, rule: 'force:gun' });
    expect(readForceThreat(s, run('confirmed'), member)).toEqual({ deadly: true, rule: 'force:gun' });
  });
});
