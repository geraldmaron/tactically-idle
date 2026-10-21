import { describe, expect, it } from 'vitest';
import type { ContentDescriptor } from '../../../content/content-descriptors';
import type { CallTree, TreeOutcome, TreeSituation } from '../../../content/call-trees/types';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { adultNoFatalSubjects, derivedDescriptors, descriptorFindings } from './content-descriptors';

describe('content descriptors (docs/content-rating.md)', () => {
  it('every shipping situation declares what its data derives, and screens every noFatal adult subject', () => {
    for (const template of Object.values(INCIDENT_TEMPLATES)) expect(descriptorFindings(template!), template!.type).toEqual([]);
  });

  it('every shipping situation declares a list', () => {
    for (const template of Object.values(INCIDENT_TEMPLATES)) for (const situation of template!.tree.situations) expect(situation.descriptors, `${template!.type}: ${situation.note.slice(0, 40)}`).toBeDefined();
  });
});

// Negative controls on a fixture this test owns: one node, one choice, one situation per case.
const outcome = (extra: Partial<TreeOutcome>): TreeOutcome => ({ text: 'x', next: { ending: 'done' }, ...extra });
type Person = IncidentTemplate['cast'][number]['person'];
function fixture(adverse: TreeOutcome[], situation: Partial<TreeSituation> = {}, age: Person['age'] = 'adult', clockHarm = false, identity?: Person['identity'], override?: Partial<Person>): IncidentTemplate {
  const sit = (index: number): TreeSituation => ({ note: `s${index}`, truth: { armed: index !== 1 }, ...situation });
  const tree = {
    type: 'hostage_crisis', root: 'start', facts: { armed: { label: 'a', claim: 'a', confirmed: 'a', disproved: 'a' } },
    roles: [{ id: 'subject', label: 'subject', pronouns: 'they', kind: 'subject' }],
    situations: [sit(0), sit(1), sit(2)],
    nodes: [{ id: 'start', stage: 'assess', prompt: 'p', choices: [{ id: 'act', outcomes: { favorable: [outcome({})], mixed: [outcome({})], adverse } }] }],
    endings: { done: {}, handed_over: {} },
  } as unknown as CallTree;
  const clocks = clockHarm ? [{ id: 'c', onOut: { harm: 'wounded' } }] : [];
  return { type: 'hostage_crisis', tree, cast: [{ id: 'subjects', keyRoles: ['subject'], person: { age, ...identity ? { identity } : {} } }],
    situations: [0, 1, 2].map(index => ({ index, clocks, ...override ? { people: { subject: override } } : {} })) } as unknown as IncidentTemplate;
}
const FORCE = (noFatal?: true): TreeOutcome => ({ text: 'x', force: { on: 'subject', next: { hurt: { ending: 'done' }, none: { ending: 'done' } }, ...noFatal ? { noFatal } : {} } });

describe('derived descriptors', () => {
  it('reads death, injury and police gunfire from the outcomes a situation reaches', () => {
    expect(derivedDescriptors(fixture([outcome({})]), 0)).toEqual([]);
    expect(derivedDescriptors(fixture([outcome({ harm: { subject: 'fatal' } })]), 0)).toEqual<ContentDescriptor[]>(['death', 'injury']);
    expect(derivedDescriptors(fixture([outcome({ officer: 'wounded' })]), 0)).toEqual<ContentDescriptor[]>(['injury']);
    expect(derivedDescriptors(fixture([outcome({ fire: { from: 'subject' } })]), 0)).toEqual<ContentDescriptor[]>(['injury']);
    expect(derivedDescriptors(fixture([FORCE()]), 0)).toEqual<ContentDescriptor[]>(['death', 'injury', 'police_gunfire']);
    expect(derivedDescriptors(fixture([FORCE(true)]), 0)).toEqual<ContentDescriptor[]>(['injury', 'police_gunfire']);
    expect(derivedDescriptors(fixture([outcome({})], {}, 'adult', true), 0)).toEqual<ContentDescriptor[]>(['injury']);
  });

  it('leaves out an outcome whose fact is false in the situation, and a clock fork on a clock it lacks', () => {
    const gated = fixture([outcome({ if: { fact: 'armed', is: true }, harm: { subject: 'fatal' } }), outcome({ if: { fact: 'armed', is: false } })]);
    expect(derivedDescriptors(gated, 0)).toContain('death');
    expect(derivedDescriptors(gated, 1)).toEqual([]);
    expect(derivedDescriptors(fixture([outcome({ if: { clock: 'missing', out: true }, harm: { subject: 'fatal' } })]), 0)).toEqual([]);
  });
});

describe('descriptor gate', () => {
  it('fails a declared list that leaves out a derived descriptor, and passes one that declares more', () => {
    expect(descriptorFindings(fixture([FORCE()], { descriptors: ['injury'] })).map(f => f.message)).toEqual(
      [0, 1, 2].map(s => `situation ${s} leaves out death, police_gunfire, which its data derives`));
    expect(descriptorFindings(fixture([FORCE()], { descriptors: ['death', 'injury', 'police_gunfire', 'child_at_risk'] }))).toEqual([]);
  });

  it('needs suicide_self_harm or a recorded reason for an adult subject spared by noFatal, never for a minor', () => {
    const full: ContentDescriptor[] = ['injury', 'police_gunfire'];
    expect(descriptorFindings(fixture([FORCE(true)], { descriptors: full }))).toHaveLength(3);
    expect(descriptorFindings(fixture([FORCE(true)], { descriptors: [...full, 'suicide_self_harm'] }))).toEqual([]);
    expect(descriptorFindings(fixture([FORCE(true)], { descriptors: full, selfHarmScreened: 'Wants the cash and a way out.' }))).toEqual([]);
    expect(descriptorFindings(fixture([FORCE(true)], { descriptors: full, selfHarmScreened: '  ' }))).toHaveLength(3);
    expect(adultNoFatalSubjects(fixture([FORCE(true)], {}, 'teen'), 0)).toEqual([]);
    expect(adultNoFatalSubjects(fixture([FORCE(true)], {}, { pick: [['teen', 50], ['adult', 50]] }), 0)).toEqual(['subject']);
  });

  it('reads drawn years before the age band, and the situation override before the slot, as drawInstance does', () => {
    // Codex review 2026-10-20: a teen band with adult years compiles an adult.
    expect(adultNoFatalSubjects(fixture([FORCE(true)], {}, 'teen', false, { years: { min: 20, max: 30 } }), 0)).toEqual(['subject']);
    expect(adultNoFatalSubjects(fixture([FORCE(true)], {}, 'adult', false, { years: { min: 14, max: 17 } }), 0)).toEqual([]);
    expect(adultNoFatalSubjects(fixture([FORCE(true)], {}, 'teen', false, undefined, { identity: { years: { min: 16, max: 19 } } }), 0)).toEqual(['subject']);
    expect(adultNoFatalSubjects(fixture([FORCE(true)], {}, 'adult', false, undefined, { age: 'teen' }), 0)).toEqual([]);
  });
});
