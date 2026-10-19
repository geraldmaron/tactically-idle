// The Calls landing's data: the gate checks per call, gate lines and ages in words, how a call usually
// ends from cached runs, ending run classes for the shape, and the findings feed with muted findings
// last and raw ids read as labels.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import { GATE_SUITE, gateJobs } from '../../../../gen/incident/trees-v13/balance';
import type { CallResult, Weight } from '../../../../gen/incident/trees-v13/balance';
import { dependencyIndex, lintTree } from '../../../../gen/incident/trees-v13/dependencies';
import { CLOCK_FIXTURE_IDS, clockFixtureTemplate } from '../../../../gen/incident/gates/clock-fixture';
import { armedWithoutHitMark } from '../../../../gen/incident/trees-v13/never-offered-fixture';
import { emptyTally } from '../../jobs/tally';
import { emptyNotes } from '../../model/endpoints';
import { gateVerdicts } from '../../model/gate-view';
import type { GateRun } from '../../model/gate-view';
import { ageText, checkLabel, checksFor, endingWeights, findingSite, findingsFeed, gateHeadline, gateLine, gateTally, glyphRun, humanizeFinding, randomResults, severityCounts, usuallyOf } from './calls-model';

const result = (weight: Weight, ending: string, officersHurt = 0): CallResult => ({ weight, ending, minutes: 30, officersHurt, peopleHurt: 0, deaths: 0, decisions: 3 });

describe('gate checks per call', () => {
  it('splits the 24 checks 5, 5, 8 and 6, and labels the non-random styles', () => {
    expect(['hostage_crisis', 'barricaded', 'active_armed_incident', 'protected_rescue'].map(t => checksFor(t as never).length)).toEqual([5, 5, 8, 6]);
    expect(checksFor('hostage_crisis').length + checksFor('barricaded').length + checksFor('active_armed_incident').length + checksFor('protected_rescue').length).toBe(GATE_SUITE.length);
    expect(checkLabel(GATE_SUITE.find(c => c.id === 'hostage_crisis.best_odds.clean')!)).toBe('Clean endings · best odds');
    expect(checkLabel(GATE_SUITE.find(c => c.id === 'hostage_crisis.random.clean')!)).toBe('Clean endings');
  });
  it('says how the gate stands in words', () => {
    expect(gateLine(gateTally(gateVerdicts([])))).toBe('Not run (24 checks)');
    const runs: GateRun[] = gateJobs().map(job => ({ job, side: 'saved', results: Array.from({ length: job.calls }, (_, i) => result(i % 3 === 0 ? 'clean' : i % 3 === 1 ? 'costly' : 'unresolved', 'x', job.style === 'fast' ? 1 : 0)) }));
    const verdicts = gateVerdicts(runs);
    const t = gateTally(verdicts);
    expect(t.total).toBe(24);
    expect(t.notRun).toBe(0);
    expect(gateLine(t)).toMatch(/^\d+ of 24 pass(, \d+ fails?)?$/);
    expect(gateLine(gateTally(gateVerdicts(runs.slice(0, 1))))).toMatch(/^4 of 24 run: /);
  });
  it('names the side a headline speaks for, and never passes a pending patch on the saved side (review finding gate-pending-verdict-from-saved)', () => {
    const runs: GateRun[] = gateJobs().map(job => ({ job, side: 'saved', results: Array.from({ length: job.calls }, (_, i) => result(i % 3 === 0 ? 'clean' : i % 3 === 1 ? 'costly' : 'unresolved', 'x', job.style === 'fast' ? 1 : 0)) }));
    const saved = gateHeadline(gateVerdicts(runs), false);
    expect(saved.text).toMatch(/^Saved tuning: \d+ of 24 pass/);
    expect(saved.tone).not.toBeNull();
    // A pending patch with only the cached saved side: the saved count, said to be the saved one.
    const waiting = gateHeadline(gateVerdicts(runs, undefined, true), true);
    expect(waiting.text).toBe(`Saved: ${gateLine(gateTally(gateVerdicts(runs)))} · not run for this change yet`);
    expect(waiting.tone).toBeNull();
    expect(gateHeadline(gateVerdicts(runs, undefined, true), true, false).text).toBe(waiting.text);
    expect(gateHeadline(gateVerdicts(runs, undefined, true).slice(0, 5), true, false, 'for this call').text).toMatch(/^Saved: \d of 5 pass(, \d fails?)? for this call · not run for this change yet$/);
    expect(gateHeadline(gateVerdicts(runs).slice(0, 5), false, false, 'for this call').text).toMatch(/^\d of 5 pass(, \d fails?)? for this call$/);
    // Once the patched side runs, its verdicts.
    const both = [...runs, ...runs.map(run => ({ ...run, side: 'patch' as const }))];
    expect(gateHeadline(gateVerdicts(both, undefined, true), true).text).toBe(`Unsaved tuning: ${gateLine(gateTally(gateVerdicts(runs)))}`);
    expect(gateHeadline(gateVerdicts(both, undefined, true), true, false).text).toBe(gateLine(gateTally(gateVerdicts(runs))));
    // Nothing run at all.
    expect(gateHeadline(gateVerdicts([], undefined, true), true).text).toBe('Unsaved tuning: Not run (24 checks)');
    expect(gateHeadline(gateVerdicts([]), false)).toEqual({ text: 'Saved tuning: Not run (24 checks)', tone: null });
  });
  it('ages read in minutes and hours, with the cache named', () => {
    expect(ageText(1000, 1000 + 20_000, true)).toBe('from cache, just now');
    expect(ageText(0, 4 * 60_000, true)).toBe('from cache, 4 min ago');
    expect(ageText(0, 3 * 3_600_000, false)).toBe('3 h ago');
  });
});

describe('usually and endings', () => {
  const runs: GateRun[] = [{ job: { type: 'barricaded', style: 'random', calls: 60, tier: 2 }, side: 'saved',
    results: [...Array.from({ length: 40 }, () => result('clean', 'everyone_out')), ...Array.from({ length: 20 }, () => result('hurt', 'entry_son_hurt'))] }];
  it('comes from a cached this-type tally first, else from the gate’s random-style calls', () => {
    const tally = { ...emptyTally(), runs: 60, weights: { death: 1, hurt: 2, unresolved: 3, costly: 4, clean: 50 } };
    expect(usuallyOf('barricaded', tally, runs)).toEqual({ counts: tally.weights, n: 60, source: 'reach' });
    expect(usuallyOf('barricaded', null, runs)).toEqual({ counts: { death: 0, hurt: 20, unresolved: 0, costly: 0, clean: 40 }, n: 60, source: 'gate' });
    expect(usuallyOf('hostage_crisis', null, runs)).toBeNull();
    expect(endingWeights(null, randomResults('barricaded', runs))).toEqual({ everyone_out: { death: 0, hurt: 0, unresolved: 0, costly: 0, clean: 40 }, entry_son_hurt: { death: 0, hurt: 20, unresolved: 0, costly: 0, clean: 0 } });
  });
});

describe('the call strip glyph row', () => {
  it('scales counts to eight glyphs, best class first, by largest remainder', () => {
    // Hostage random 60 (the gate's calls): clean 14, costly 24, unresolved 19, hurt 2, death 1.
    expect(glyphRun({ clean: 14, costly: 24, unresolved: 19, hurt: 2, death: 1 })).toEqual(['clean', 'clean', 'costly', 'costly', 'costly', 'unresolved', 'unresolved', 'unresolved']);
    expect(glyphRun({ clean: 1, costly: 0, unresolved: 0, hurt: 0, death: 0 })).toEqual(Array(8).fill('clean'));
    expect(glyphRun({ clean: 0, costly: 0, unresolved: 0, hurt: 0, death: 0 })).toEqual([]);
    for (const counts of [{ clean: 3, costly: 3, unresolved: 3, hurt: 3, death: 3 }, { clean: 7, costly: 0, unresolved: 1, hurt: 0, death: 1 }]) expect(glyphRun(counts)).toHaveLength(8);
  });
});

describe('findings feed', () => {
  // The armed call with nothing setting officer_down: an error (the read nobody writes) and a
  // warning (the medic choice never offered) beside the shipped hostage call's notes.
  const armed = armedWithoutHitMark(), hostage = INCIDENT_TEMPLATES.hostage_crisis!;
  const armedLint = lintTree(armed), hostageLint = lintTree(hostage);
  const never = armedLint.find(f => f.code === 'never_offered')!;
  const muted = { ...emptyNotes('hostage_crisis'), notes: [{ id: 'm', type: 'hostage_crisis' as const, anchor: `finding:${hostageLint[0].id}`, severity: 'accepted' as const, rule: '', route: 'owner' as const,
    sees: '', fix: '', text: 'Known: by design', at: 0, draw: { situation: 0 as const, call: 1 }, url: '', contentHash: '' }] };
  it('puts the worst first and muted findings last with the reason, out of the counts', () => {
    const rows = findingsFeed([{ type: 'hostage_crisis', findings: hostageLint, notes: muted }, { type: 'active_armed_incident', findings: armedLint, notes: null }]);
    expect(rows.map(row => row.finding.severity).slice(0, 2)).toEqual(['error', 'warn']);
    expect(rows[rows.length - 1].muted).toBe('Known: by design');
    expect(severityCounts(rows)).toEqual({ error: 1, warn: 1, info: hostageLint.length - 1 });
  });
  it('links each finding to where it lives', () => {
    expect(findingSite(never)).toEqual({ tab: 'flow', sel: { kind: 'node', node: 'pinned' } });
    const keyed = hostageLint.find(f => f.key)!;
    expect(findingSite(keyed)).toEqual({ tab: 'deps', sel: { kind: 'key', key: keyed.key } });
  });
  it('reads raw ids as names', () => {
    const words = humanizeFinding(never, armed, dependencyIndex(armed));
    const choice = armed.tree.nodes.find(n => n.id === 'pinned')!.choices.find(c => c.id === 'treat_ours')!;
    expect(words.where).toBe(`Pinned › ${choice.title}`);
    expect(words.message).not.toMatch(/treat_ours|officer_down/);
    expect(words.message).toContain(`“${choice.title}” at Pinned`);
    // A clock writer from an owned fixture, so a content change can't remove it.
    const fixture = clockFixtureTemplate();
    const clock = lintTree(fixture).find(f => f.code === 'clock_writer')!;
    expect(humanizeFinding(clock, fixture, dependencyIndex(fixture)).message).not.toContain(CLOCK_FIXTURE_IDS.clock);
  });
});
