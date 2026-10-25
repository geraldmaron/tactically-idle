import { describe, expect, it } from 'vitest';
import type { DecisionView } from '../../sim/types';
import { THREAT_STAGE_NOTE, threatStage } from './fill-gauge';
import { verdictOf } from './verdict';

// The warnings a threat gives as its window closes, and the color a result's frame takes
// (docs/result-surface.md, owner 2026-10-24).
describe('the threat stages', () => {
  it('step from steady to half, a quarter and the last moments, by the same minutes the pill shows', () => {
    expect(threatStage(10, 10)).toBe('steady');
    expect(threatStage(10, 5.1)).toBe('steady');
    expect(threatStage(10, 5)).toBe('half');
    expect(threatStage(10, 2.6)).toBe('half');
    expect(threatStage(10, 2.5)).toBe('quarter');
    expect(threatStage(10, 1.1)).toBe('quarter');
    expect(threatStage(10, 1)).toBe('last');
    expect(threatStage(40, 4)).toBe('last');
    expect(threatStage(10, 0)).toBe('landed');
  });
  it('has a line for every stage, with no dash', () => {
    for (const stage of ['steady', 'half', 'quarter', 'last', 'landed'] as const) expect(THREAT_STAGE_NOTE[stage]).toMatch(/^[^—–]+$/);
  });
});

const decision = (patch: Partial<DecisionView>): DecisionView => ({
  revision: 1, actionId: 'a', title: 'A choice', stageLabel: 'Stage', band: 'favorable', explanation: [], timeCost: 3, objectiveDelta: 0, civilianSafetyDelta: 0, pressureDelta: 0,
  actualStressDeltas: true, stressDeltas: [], supplies: [], knowledgeChanges: [], contributors: [], consequences: [], endingTitle: null, ...patch,
});

describe('the result frame', () => {
  it('reads a band as a color, and a lapse as amber', () => {
    expect(verdictOf(decision({ band: 'favorable' }))).toBe('good');
    expect(verdictOf(decision({ band: 'mixed' }))).toBe('warn');
    expect(verdictOf(decision({ band: 'adverse' }))).toBe('harm');
    expect(verdictOf(decision({ band: null, lapse: true }))).toBe('warn');
  });
  it('never frames a task that hurt someone as a win', () => {
    const hurt = (severity: 'wounded' | 'serious' | 'fatal') => ({ personCasualties: [{ personId: 'p', personRole: 'civilian' as const, label: 'P', severity, at: 1, care: 'needed' as const, causeRevision: 1 }] });
    expect(verdictOf(decision({ band: 'favorable', ...hurt('wounded') }))).toBe('warn');
    expect(verdictOf(decision({ band: 'favorable', ...hurt('serious') }))).toBe('harm');
    expect(verdictOf(decision({ band: null, lapse: true, ...hurt('wounded') }))).toBe('warn');
  });
  it('gives a drawn use of force and an authored event a neutral frame', () => {
    expect(verdictOf(decision({ band: 'favorable', resultLabel: 'Shots fired' }))).toBe('neutral');
  });
});
