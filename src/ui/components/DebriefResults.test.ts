import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { establishedDepartment } from '../../sim/department-test-fixtures';
import type { DebriefResult, DecisionView } from '../../sim/types';
import { SavedDebriefContents } from '../screens/OpsDebrief';
import { DebriefConsequences, DebriefSummary, OfficerResults, visibleDebriefConsequences } from './DebriefResults';

const result: DebriefResult = {
  runId: 'saved_original', scenarioId: 'legacy_missing_scenario', endingId: 'done', endingTitle: 'Operation complete',
  endingSummary: 'The handover is complete.', practice: false,
  objective: { score: 75, label: 'Largely resolved' }, civilianSafety: { score: 68, label: 'Safety was strained' },
  officerCondition: [{ officerId: 'off_chen', stressBefore: 12.5, stressAfter: 23.5, xpGained: 29 }],
  informationPreserved: [], resources: [], unitWear: [], trustDelta: -2, fundingReward: 400, devPointReward: 1,
  causes: ['The team verified access before the handover.'],
};
const state = establishedDepartment(Date.UTC(2026, 9, 3), 1);
const decision: DecisionView = {
  revision: 1, actionId: 'rescue', title: 'Provide aid', stageLabel: 'Resolve', band: 'mixed',
  explanation: ['Medical cover was ready.'], consequences: ['Access was established.', 'A resident was injured during the delay.'],
  timeCost: 4, objectiveDelta: 5, civilianSafetyDelta: -4, pressureDelta: 1, actualStressDeltas: true,
  stressDeltas: [], supplies: [], knowledgeChanges: [], contributors: [], endingTitle: 'Operation complete',
};

describe('scannable debrief results', () => {
  it('keeps objective, safety and real reward losses in the first summary', () => {
    const html = renderToStaticMarkup(createElement(DebriefSummary, { debrief: result }));
    for (const label of ['75/100', '68/100', 'Largely resolved', 'Safety was strained', '+$400', '-2 trust', '+1 dev point']) expect(html).toContain(label);
    expect(html).not.toContain('<details');
  });

  it('replaces repeated practice zero-change rows with one collapsed condition group', () => {
    const practice = { ...result, practice: true, officerCondition: Object.values(state.officers).map((o) => ({ officerId: o.id, stressBefore: o.stress, stressAfter: o.stress, xpGained: 0 })) };
    const summary = renderToStaticMarkup(createElement(DebriefSummary, { debrief: practice }));
    const html = renderToStaticMarkup(createElement(OfficerResults, { debrief: practice, officers: state.officers }));
    expect(summary).toContain('No lasting changes to officers, supplies or reputation. No rewards earned.');
    expect(summary).not.toContain('+$400');
    expect(html).toContain(`${practice.officerCondition.length} officers · unchanged`);
    expect(html.match(/<details/g)).toHaveLength(1);
    expect(html).not.toContain('<details open');
    expect(html).not.toContain('+0');
    expect(html).not.toContain('XP');
    expect(html).not.toContain('stress before');
    expect(html).toContain('View condition');
  });

  it('shows meaningful XP and stress changes with portraits and exact text alternatives', () => {
    const html = renderToStaticMarkup(createElement(OfficerResults, { debrief: result, officers: state.officers }));
    expect(html).toContain('+29 XP');
    expect(html).toContain('File portrait of Mei Chen');
    expect(html).toContain('before 12.5, change +11');
    expect(html).toContain('Stress 23.5 of 100');
    expect(html).toContain('+11');
    expect(html).not.toContain('>+0');
    expect(html).not.toContain('<details');
  });

  it('keeps real zero-change officers available without a zero reward or duplicate bars', () => {
    const unchanged = { ...result, officerCondition: [{ officerId: 'off_chen', stressBefore: 12, stressAfter: 12, xpGained: 0 }] };
    const html = renderToStaticMarkup(createElement(OfficerResults, { debrief: unchanged, officers: state.officers }));
    expect(html).toContain('1 officer · unchanged');
    expect(html).toContain('Stress unchanged');
    expect(html).not.toContain('XP');
    expect(html).not.toContain('stress before');
  });

  it('shows harm from any decision, including later narrative lines, outside disclosure', () => {
    const saved = { ...result, decisions: [decision], causes: [...result.causes, 'Equipment was lost during withdrawal.'] };
    const lines = visibleDebriefConsequences(saved);
    expect(lines).toContain('Provide aid: A resident was injured during the delay.');
    expect(lines).toContain('Provide aid: Civilian safety -4.');
    expect(lines).not.toContain('Provide aid: Medical cover was ready.');
    expect(lines).toContain('Equipment was lost during withdrawal.');
    const html = renderToStaticMarkup(createElement(DebriefConsequences, { debrief: saved }));
    expect(html).toContain('A resident was injured during the delay.');
    expect(html).not.toContain('<details');
    const entire = renderToStaticMarkup(createElement(SavedDebriefContents, { debrief: saved, officers: {} }));
    expect(entire.indexOf('A resident was injured during the delay.')).toBeLessThan(entire.indexOf('<details'));
    expect(entire).toContain('Medical cover was ready.');
    expect(entire).toContain('The team verified access before the handover.');
  });

  it('retains legacy harm evidence even with no decision log', () => {
    const saved = { ...result, causes: ['An officer suffered an injury while withdrawing.'] };
    expect(visibleDebriefConsequences(saved)).toEqual(saved.causes);
    const html = renderToStaticMarkup(createElement(SavedDebriefContents, { debrief: saved, officers: {} }));
    expect(html).toContain('No per-decision log is stored for this operation.');
    expect(html).toContain('An officer suffered an injury while withdrawing.');
  });

  it('does not turn a completed fixed event into a warning because its effort band was adverse', () => {
    const event = { ...decision, band: 'adverse' as const, resultLabel: 'Mara reached safety', officerCasualties: [], civilianSafetyDelta: 0, objectiveDelta: 0,
      consequences: ['Mara reached safety.', 'No new symptom was reported. Any recorded injury still needs care.'],
      explanation: ['Mara reached safety. No new symptom was reported. Any recorded injury still needs care.'] };
    expect(visibleDebriefConsequences({ ...result, decisions: [event] })).toEqual([]);
    const entire = renderToStaticMarkup(createElement(SavedDebriefContents, { debrief: { ...result, decisions: [event] }, officers: {} }));
    expect(entire).toContain('Mara reached safety.');
  });

  it('keeps actual adverse events once without repeating their joined explanation', () => {
    const event = { ...decision, band: 'adverse' as const, officerCasualties: [], civilianSafetyDelta: 0, objectiveDelta: 0,
      consequences: ['Lewis stopped answering.', 'The phone carried his current threat.'],
      explanation: ['Lewis stopped answering. The phone carried his current threat.'] };
    expect(visibleDebriefConsequences({ ...result, decisions: [event] })).toEqual(['Provide aid: Lewis stopped answering.', 'Provide aid: The phone carried his current threat.']);
  });

  it('keeps structured losses visible while leaving adverse scoring details in the full log', () => {
    const failed = { ...decision, band: 'adverse' as const, objectiveDelta: -8, civilianSafetyDelta: 0, consequences: ['The transfer was not completed.'], explanation: ['Coordination 42 contributed 11 points.', 'The time cost was four minutes.'] };
    const lines = visibleDebriefConsequences({ ...result, decisions: [failed] });
    expect(lines).toContain('Provide aid: Call progress -8.');
    expect(lines).toContain('Provide aid: The transfer was not completed.');
    expect(lines.join(' ')).not.toContain('Coordination 42');
    expect(lines.join(' ')).not.toContain('The time cost');
    const entire = renderToStaticMarkup(createElement(SavedDebriefContents, { debrief: { ...result, decisions: [failed] }, officers: {} }));
    expect(entire).toContain('Coordination 42 contributed 11 points.');
  });

  it('never uses current XP, ratings, condition or a different run to fabricate archived progress', () => {
    const a = structuredClone(state.officers);
    const b = structuredClone(a);
    b.off_chen.xp += 9_000;
    b.off_chen.xpBanked = 8_000;
    b.off_chen.ratings.communication = 99;
    b.off_chen.stress = 99;
    b.off_chen.injury = { label: 'Later injury', until: Date.now() + 100_000 };
    const saved = { ...result, decisions: [decision] };
    const render = (officers: typeof a) => renderToStaticMarkup(createElement(SavedDebriefContents, { debrief: saved, officers }));
    expect(render(a)).toBe(render(b));
    expect(render(a)).not.toContain('XP to +1');
    expect(render(a)).not.toContain('Later injury');
  });

  it('uses a neutral missing-identity record instead of borrowing a retired officer’s face', () => {
    const html = renderToStaticMarkup(createElement(OfficerResults, { debrief: result, officers: {} }));
    expect(html).toContain('Former officer');
    expect(html).toContain('Officer off_chen; identity no longer on file');
    expect(html).not.toContain('data-portrait="painted"');
    expect(html).not.toContain('Chen');
    expect(html).toContain('+29 XP');
    expect(html).toContain('Stress 23.5 of 100');
  });
});


describe('explicit completion evidence in current and archived results', () => {
  it('does not turn a high score into resolution when work remains', () => {
    const debrief: DebriefResult = { ...result, disposition: 'unresolved', completionAchieved: false, objective: { score: 100, label: 'Resolved' }, remainingTasks: ['Keep the resident safe until care is accepted.'] };
    const html = renderToStaticMarkup(createElement(DebriefSummary, { debrief }));
    expect(html).toContain('Call unresolved');
    expect(html).toContain('Still needed');
    expect(html).toContain('Keep the resident safe until care is accepted.');
    expect(html).not.toContain('100/100');
    expect(html).not.toContain('>Resolved<');
    expect(html).toContain('68/100');
  });

  it('shows care acceptance only with the saved receiving service and accepted time', () => {
    const debrief: DebriefResult = { ...result, disposition: 'care_accepted', completionAchieved: true, receivingService: { id: 'medics', label: 'Original receiving crew', kind: 'medical', acceptedAt: 17.5 }, remainingTasks: [] };
    const html = renderToStaticMarkup(createElement(DebriefSummary, { debrief }));
    expect(html).toContain('Care accepted');
    expect(html).toContain('Original receiving crew accepted responsibility at 17.5 min.');
    expect(html).not.toContain('Call progress');
    expect(html).not.toContain('Still needed');
    const missingReceiver = renderToStaticMarkup(createElement(DebriefSummary, { debrief: { ...debrief, receivingService: undefined } }));
    expect(missingReceiver).toContain('Call unresolved');
    expect(missingReceiver).not.toContain('Care accepted');
  });

  it('distinguishes partial relief and agreed follow-up from a fully resolved call', () => {
    const followup = renderToStaticMarkup(createElement(DebriefSummary, { debrief: { ...result, disposition: 'followup_agreed', completionAchieved: true } }));
    expect(followup).toContain('Follow-up agreed');
    expect(followup).not.toContain('Call resolved');
    const partial = renderToStaticMarkup(createElement(DebriefSummary, { debrief: { ...result, disposition: 'relief_partial', completionAchieved: false, remainingTasks: ['The access route still needs to be made safe.'] } }));
    expect(partial).toContain('Partial progress · call unresolved');
    expect(partial).toContain('The access route still needs to be made safe.');
  });
});
