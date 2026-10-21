// The prose lint after the content rules audit (docs/calls/notes/content-rules-audit.md, owner
// 2026-10-20). Kept rules keep matching; lifted words no longer do; the string checker reads every
// pattern this file exports.
import { describe, expect, it } from 'vitest';
import * as LINT from './prose-lint';
import { ACCUSATION, HEDGE, META_PHRASING, METHOD_REVIEW, SETTLED, SUICIDE_METHOD, UNSAFE_DETAIL } from './prose-lint';

// Node built-ins reached the way src/dev/lab/css-rules.ts does, so the test needs no Node type package.
interface NodeFs { readFileSync(path: string, encoding: 'utf8'): string; writeFileSync(path: string, data: string): void; mkdtempSync(prefix: string): string }
interface NodeChild { spawnSync(cmd: string, args: string[], opts: { encoding: 'utf8' }): { status: number | null; stdout: string; stderr: string } }
const node = (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): NodeFs; getBuiltinModule(id: 'node:child_process'): NodeChild } }).process;
const fs = node.getBuiltinModule('node:fs');
const readFileSync = (path: string) => fs.readFileSync(path, 'utf8');

describe('suicide method detail stays banned (ethics E4.1)', () => {
  it.each([
    'a lethal dose', 'a noose in the garage', 'he hanged himself', 'they tried to hang themselves', 'He shot himself.',
    'She tried to drown herself.', 'He cut himself again.', 'she slit her wrists', 'He cut his own wrist.',
    'He took pills to kill himself.', 'enough pills to die', 'She jumped off the bridge.', 'He wanted to jump from the roof.',
  ])('blocks %j', text => expect(SUICIDE_METHOD.test(text)).toBe(true));

  it.each([
    'He told his sister he won’t be here tomorrow.', 'She says she doesn’t want to be alive.', 'He hurt himself before the call.',
    'He takes his heart pills at noon.', 'The courier hangs up.', 'The coat hangs on the stool.', 'She cut the cord.',
    'He is at risk of suicide.', 'He jumped the fence.', 'The crew checks the carbon monoxide alarm.',
    'She needs her sleeping pills from the pharmacy.', 'The medic checks the dosage on her prescription.',
  ])('does not block %j', text => expect(SUICIDE_METHOD.test(text)).toBe(false));

  it.each([
    'He took an overdose.', 'She says it was 40 milligrams.', 'The medic checks the dosage on her prescription.',
    'She needs her sleeping pills from the pharmacy.', 'The crew checks the carbon monoxide alarm.',
  ])('asks for a human read on %j', text => expect(METHOD_REVIEW.test(text)).toBe(true));
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
    expect(METHOD_REVIEW.test(text)).toBe(false);
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

// The checker itself, run on a small strings file: a method line blocks, a review word reports
// without blocking, and the words the audit lifted pass (Codex audit read, 2026-10-20).
describe('the string checker on real rows', () => {
  const run = (rows: string[]) => {
    const dir = fs.mkdtempSync('/tmp/prose-lint-');
    const tsv = `${dir}/rows.tsv`;
    fs.writeFileSync(tsv, ['situation\twhere\tsurface\ttext', ...rows.map((text, i) => `all\tcase.${i}\tresult\t${text}`)].join('\n') + '\n');
    return node.getBuiltinModule('node:child_process').spawnSync('python3',
      ['.agents/skills/swat-call-prose/scripts/game_string_checks.py', tsv, '--lint-source', 'src/gen/incident/gates/prose-lint.ts'], { encoding: 'utf8' });
  };
  const count = (stdout: string, kind: string) => Number(new RegExp(`[ ,]${kind} (\\d+)`).exec(/^summary .*$/m.exec(stdout)![0])![1]);

  it('blocks a method line', () => {
    const out = run(['The team finds him at the counter. He took pills to kill himself.']);
    expect(out.stderr).toBe('');
    expect(count(out.stdout, 'method')).toBe(1);
    expect(out.status).toBe(1);
  });

  it('reports a review word without blocking, and passes the lifted words', () => {
    const out = run(['The medic checks the dosage on her prescription.', 'The medic starts CPR on the floor.', 'Patrol handcuffs him at the car.', 'He is at risk of suicide.']);
    expect(out.stderr).toBe('');
    expect(count(out.stdout, 'method-review')).toBe(1);
    expect(count(out.stdout, 'method')).toBe(0);
    expect(count(out.stdout, 'unsafe')).toBe(0);
  });
});
