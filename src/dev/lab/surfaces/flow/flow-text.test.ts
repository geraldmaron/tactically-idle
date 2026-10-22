// Words for Flow's chips and pins: conditions read as plain phrases (facts with whether they hold in
// this call), public state as chips, and lint and notes pinned to the right boxes, muted findings out.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import { dependencyIndex, lintTree } from '../../../../gen/incident/trees-v13/dependencies';
import type { LintFinding } from '../../../../gen/incident/trees-v13/dependencies';
import { armedWithoutHitMark, HIT_FIXTURE } from '../../../../gen/incident/trees-v13/never-offered-fixture';
import { emptyNotes } from '../../model/endpoints';
import type { NotesFile, ReviewNote } from '../../types';
import { conditionChip, drawnWords, findingBoxes, noteBoxes, pinsByBox, stateChips, worstSeverity } from './flow-text';

const hostage = INCIDENT_TEMPLATES.hostage_crisis!;
const ctx = { tree: hostage.tree, template: hostage, deps: dependencyIndex(hostage) };

describe('conditions', () => {
  it('a fact chip says the claim, the wanted answer and whether this call has it', () => {
    const fact = Object.keys(hostage.tree.facts)[0];
    const [chip] = conditionChip(ctx, { kind: 'fact', fact, is: false, holds: true });
    expect(chip.kind).toBe('fact');
    expect(chip.text).toMatch(/^if .+: no$/);
    expect(chip.holds).toBe(true);
    expect(chip.text).not.toMatch(/\{/);
    expect(conditionChip(ctx, { kind: 'fact', fact, is: true })[0].holds).toBeUndefined();
  });
  it('clocks, meters and counts read as phrases with role nouns, never tokens', () => {
    const clock = hostage.situations.flatMap(s => s.clocks ?? [])[0];
    expect(conditionChip(ctx, { kind: 'clock', clock: clock.id, when: 'out', is: true })[0].text).toMatch(/^if .+ runs out$/);
    expect(conditionChip(ctx, { kind: 'clock', clock: clock.id, when: 'low', is: false })[0].text).toMatch(/is not low yet$/);
    const meter = conditionChip(ctx, { kind: 'meter', role: 'rider', stance: ['breaking'], is: false })[0].text;
    expect(meter).toBe('unless the delivery courier is breaking');
    expect(stateChips(ctx, { count: { role: 'others', min: 1 } })).toEqual([{ text: 'others ≥ 1', kind: 'count' }]);
    expect(stateChips(ctx, { marks: ['turned'], notSafe: ['manager'] }).map(c => c.text)).toEqual([ctx.deps.keys.get('mark:turned')!.label, expect.stringMatching(/night manager.* still inside$/)]);
    expect(drawnWords({ via: 'cascade', drawn: 'none' })).toBe('nobody follows');
    expect(drawnWords({ via: 'force', drawn: 'none' })).toBe('force: nobody hurt');
  });
});

describe('pins', () => {
  // The armed call with nothing setting officer_down, so lint pins the medic choice it never offers.
  const armed = armedWithoutHitMark();
  const findings = lintTree(armed);
  const never = findings.find(f => f.code === 'never_offered')!;
  it('a finding pins to its node and the choice its site names', () => {
    expect(findingBoxes(never)).toEqual([`node:${HIT_FIXTURE.node}`, `choice:${HIT_FIXTURE.node}/${HIT_FIXTURE.choice}`]);
    expect(noteBoxes('band:talking/offer/mixed')).toEqual(['node:talking', 'choice:talking/offer']);
    expect(noteBoxes('ending:owner_killed')).toEqual(['ending:owner_killed']);
    expect(noteBoxes('key:mark:turned')).toEqual([]);
  });
  it('counts open notes and drops findings an accepted note muted', () => {
    const note = (anchor: string, severity: ReviewNote['severity']): ReviewNote => ({ id: anchor, type: 'active_armed_incident', anchor, severity, rule: '', route: 'owner', sees: '', fix: '', text: 'ok',
      at: 0, draw: { situation: 0, call: 1 }, url: '', contentHash: '' });
    const file: NotesFile = { ...emptyNotes('active_armed_incident'), notes: [note(`node:${HIT_FIXTURE.node}`, 'fix'), note(`finding:${never.id}`, 'accepted')] };
    const pins = pinsByBox(findings, file);
    expect(pins.get(`node:${HIT_FIXTURE.node}`)?.notes).toBe(1);
    expect(pins.get(`node:${HIT_FIXTURE.node}`)?.lint.some(f => f.id === never.id)).toBe(false);
    expect(pinsByBox(findings, null).get(`node:${HIT_FIXTURE.node}`)?.lint.map(f => f.id)).toContain(never.id);
  });
  it('the pin shows the worst severity', () => {
    const f = (severity: LintFinding['severity']) => ({ ...never, severity });
    expect(worstSeverity([f('info'), f('warn')])).toBe('warn');
    expect(worstSeverity([f('info'), f('error'), f('warn')])).toBe('error');
    expect(worstSeverity([])).toBeNull();
  });
});
