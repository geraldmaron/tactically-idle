// The prose lint after the content rules audit (docs/calls/notes/content-rules-audit.md, owner
// 2026-10-20). Kept rules keep matching; lifted words no longer do; the string checker reads every
// pattern this file exports.
import { describe, expect, it } from 'vitest';
import * as LINT from './prose-lint';
import { ACCUSATION, HEDGE, META_PHRASING, SETTLED, SUICIDE_METHOD, UNSAFE_DETAIL } from './prose-lint';

// Read from disk the way src/dev/lab/css-rules.ts does, so the test needs no Node type package.
const fs = (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): { readFileSync(path: string, encoding: 'utf8'): string } } })
  .process.getBuiltinModule('node:fs');
const readFileSync = (path: string) => fs.readFileSync(path, 'utf8');

describe('suicide method detail stays banned (ethics E4.1)', () => {
  it.each([
    'He took an overdose.', 'She says it was 40 milligrams.', 'the dosage on the bottle', 'a lethal dose',
    'his sleeping pills', 'enough pills to die', 'a noose in the garage', 'he hanged himself', 'they tried to hang themselves',
    'she slit her wrists', 'he cut his wrists', 'the car running for the carbon monoxide',
  ])('matches %j', text => expect(SUICIDE_METHOD.test(text)).toBe(true));

  it.each([
    'He told his sister he won’t be here tomorrow.', 'She says she doesn’t want to be alive.', 'He takes his heart pills at noon.',
    'The courier hangs up.', 'The coat hangs on the stool.', 'She cut the cord.', 'He is at risk of suicide.',
  ])('leaves %j alone', text => expect(SUICIDE_METHOD.test(text)).toBe(false));
});

describe('wound anatomy and gore stay banned (ethics E7)', () => {
  it.each(['blood on the counter', 'he is bleeding', 'gore', 'a gory scene'])('matches %j', text => expect(UNSAFE_DETAIL.test(text)).toBe(true));
});

describe('topic words the settings filter now covers are allowed', () => {
  it.each([
    'He is at risk of suicide.', 'The medic starts CPR.', 'chest compressions', 'the defibrillator', 'a tourniquet on the leg',
    'Patrol handcuffs him.', 'restrained on the floor', 'a taser', 'pepper spray', 'a baton', 'a chokehold',
    'a bullet hole in the ceiling', 'ammunition on the shelf', 'shot dead', 'a dead body', 'the corpse', 'he was stabbed',
    'a fractured wrist', 'a broken leg', 'a concussion', 'He is stable now.',
  ])('passes %j', text => {
    expect(UNSAFE_DETAIL.test(text)).toBe(false);
    expect(SUICIDE_METHOD.test(text)).toBe(false);
  });
});

describe('craft and honesty lists are unchanged', () => {
  it('still flags unsourced accusations, settled guilt and meta phrasing', () => {
    expect(ACCUSATION.test('He stole the money.')).toBe(true);
    expect(HEDGE.test('The owner says he stole the money.')).toBe(true);
    expect(SETTLED.test('He was arrested.')).toBe(true);
    expect(META_PHRASING.test('In this scenario the player waits.')).toBe(true);
  });
});

describe('the string checker reads every pattern', () => {
  it('lists each exported pattern in LINT_NAMES', () => {
    const script = readFileSync('.agents/skills/swat-call-prose/scripts/game_string_checks.py');
    const names = /LINT_NAMES = \[([^\]]*)\]/.exec(script)![1].match(/"([A-Z_]+)"/g)!.map(name => name.slice(1, -1));
    const exported = Object.entries(LINT).filter(([, value]) => value instanceof RegExp).map(([name]) => name);
    expect([...names].sort()).toEqual([...exported].sort());
  });

  it('keeps each pattern on one line, the shape the checker parses', () => {
    const source = readFileSync('src/gen/incident/gates/prose-lint.ts');
    for (const name of Object.keys(LINT)) expect(source, name).toMatch(new RegExp(`const ${name} = /.+/[a-z]*;`));
  });
});
