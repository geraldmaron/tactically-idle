import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StressDisplay, StressGuide } from './StressDisplay';
import { DecisionCard } from '../screens/OperationFeedback';
import type { DecisionView } from '../../sim/types';
import { establishedDepartment } from '../../sim/department-test-fixtures';

const render = (props: Parameters<typeof StressDisplay>[0]) => renderToStaticMarkup(createElement(StressDisplay, props));
describe('stress as a condition reading', () => {
  it.each([[29.9, 'Low stress'], [30, 'Under strain'], [59.9, 'Under strain'], [60, 'Overloaded'], [79.9, 'Overloaded'], [80, 'Needs rest']])('uses the actual boundary at %s', (value, label) => {
    const html = render({ value: value as number });
    expect(html).toContain(label);
    expect(html).not.toContain('Readiness');
    expect(html).not.toContain('percent');
  });
  it('shows exact before/after, direction and a crossed restriction', () => {
    const html = render({ value: 60.1, before: 58.9 });
    expect(html).toContain('before 58.9, change +1.2');
    expect(html).toContain('Under strain <span aria-hidden="true">→</span> Overloaded');
    expect(html).toContain('+1.2 stress');
  });
  it('never paints a made-up minimum stress or hides recovery', () => {
    expect(render({ value: 0 })).toContain('left:0%');
    const html = render({ value: 79, before: 82 });
    expect(html).toContain('-3 stress');
    expect(html).toContain('Needs rest <span aria-hidden="true">→</span> Overloaded');
  });
  it('explains stress separately from availability', () => {
    const html = renderToStaticMarkup(createElement(StressGuide));
    expect(html).toContain('Training, injury and current duties');
    expect(html).toContain('Sits out high-risk actions');
    expect(html).toContain('Cannot deploy again until stress falls below 80');
  });
});

describe('decision stress history', () => {
  const d: DecisionView = { revision: 1, actionId: 'test', title: 'Talk to the person', stageLabel: 'Check the report', band: 'favorable', timeCost: 3, objectiveDelta: 5, civilianSafetyDelta: 0, pressureDelta: 1, actualStressDeltas: true, stressDeltas: [{ officerId: 'off_chen', label: 'Chen', delta: 2, stressBefore: 29, stressAfter: 31 }], supplies: [], knowledgeChanges: [], contributors: [], consequences: [], explanation: ['The person spoke to the team.'], endingTitle: null };
  it('keeps saved readings even when the current officer later changes condition', () => {
    const a = establishedDepartment(0, 1).officers, b = structuredClone(a);
    b.off_chen.stress = 99;
    const show = (officers: typeof a) => renderToStaticMarkup(createElement(DecisionCard, { decision: d, officers }));
    expect(show(a)).toBe(show(b));
    expect(show(a)).toContain('before 29, change +2');
    expect(show(a)).toContain('File portrait of Mei Chen');
  });
  it('does not reconstruct missing old levels from current condition', () => {
    const old = { ...d, stressDeltas: [{ officerId: 'off_chen', label: 'Chen', delta: 2 }] };
    const html = renderToStaticMarkup(createElement(DecisionCard, { decision: old, officers: establishedDepartment(0, 1).officers }));
    expect(html).toContain('+2 stress');
    expect(html).toContain('Only the stress change was saved');
    expect(html).not.toContain('stress-scale');
    expect(html).not.toContain('Low stress');
  });
});
