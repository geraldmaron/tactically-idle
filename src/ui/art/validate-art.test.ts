import { afterEach, describe, expect, it } from 'vitest';

// Node built-ins without @types/node, as in src/sim/tuning-meta.test.ts.
interface NodeFs {
  mkdtempSync(prefix: string): string;
  mkdirSync(path: string, options: { recursive: true }): void;
  writeFileSync(path: string, data: string): void;
  rmSync(path: string, options: { recursive: true; force: true }): void;
}
interface Spawned { status: number | null; stdout: string; stderr: string }
interface NodeProcess {
  cwd(): string;
  execPath: string;
  getBuiltinModule(id: 'node:fs'): NodeFs;
  getBuiltinModule(id: 'node:os'): { tmpdir(): string };
  getBuiltinModule(id: 'node:child_process'): { spawnSync(command: string, args: string[], options: { encoding: 'utf8' }): Spawned };
}
const node = (globalThis as unknown as { process: NodeProcess }).process;
const fs = node.getBuiltinModule('node:fs');
const join = (...parts: string[]) => parts.join('/');
const dirname = (file: string) => file.slice(0, file.lastIndexOf('/'));

const script = join(node.cwd(), 'scripts/validate-art.mjs');
const roots: string[] = [];
const WEBP = 'RIFF\0\0\0\0WEBPVP8 ';

/** A minimal checkout: one course, two branches, empty art sets except the emblems given. */
function fixture(emblemIds: string[], medallionIds: string[] = []): string {
  const root = fs.mkdtempSync(join(node.getBuiltinModule('node:os').tmpdir(), 'ti-art-'));
  roots.push(root);
  const write = (file: string, content: string) => {
    fs.mkdirSync(dirname(join(root, file)), { recursive: true });
    fs.writeFileSync(join(root, file), content);
  };
  write('src/content/personas.json', '[]');
  write('src/content/courses.ts', "export const COURSES = {\n  composure_workshop: {\n    name: 'Composure workshop',\n  },\n};\n");
  write('src/ui/components/labels.ts', "export const BRANCHES: DevBranch[] = ['personnel', 'field'];\n");
  for (const set of ['portraits', 'gear', 'materials', 'managers', 'plates']) write(`public/art/${set}/manifest.json`, JSON.stringify({ version: 1, readyIds: [], width: 512, height: 512 }));
  write('src/ui/icons/kit.ts', "export const CALL_TYPE_ICON: Record<IncidentType, IconName> = {\n  hostage_crisis: 'hostage',\n  barricaded: 'barricade',\n};\n");
  write('public/art/medallions/manifest.json', JSON.stringify({ version: 1, readyIds: medallionIds, width: 512, height: 512 }));
  for (const id of medallionIds) write(`public/art/medallions/${id}.webp`, WEBP);
  write('public/art/emblems/manifest.json', JSON.stringify({ version: 1, readyIds: emblemIds, width: 512, height: 512 }));
  for (const id of emblemIds) write(`public/art/emblems/${id}.webp`, WEBP);
  for (const file of ['header-lockup-dark.svg', 'favicon.svg', 'apple-touch-icon.png']) write(`public/brand/${file}`, '');
  return root;
}
const run = (root: string) => node.getBuiltinModule('node:child_process').spawnSync(node.execPath, [script, root], { encoding: 'utf8' });

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('validate-art emblems', () => {
  it('accepts emblems for a course and for a development branch', () => {
    const result = run(fixture(['composure_workshop', 'branch_field']));
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ emblemsReady: 2, emblemIds: 3 });
  });

  it('fails on an emblem id that matches no course or branch', () => {
    const result = run(fixture(['composure_workshop', 'branch_logistics', 'field']));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('emblems/branch_logistics: not a course or development branch');
    expect(result.stderr).toContain('emblems/field: not a course or development branch');
    expect(result.stderr).not.toContain('composure_workshop');
  });
});

describe('validate-art medallions', () => {
  it('accepts a medallion for each call type', () => {
    const result = run(fixture([], ['hostage_crisis', 'barricaded']));
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ medallionsReady: 2, callTypeIds: 2 });
  });

  it('fails on a medallion id that is no call type, and on a ready id with no file', () => {
    const root = fixture([], ['hostage_crisis', 'barricade']);
    fs.rmSync(join(root, 'public/art/medallions/hostage_crisis.webp'), { recursive: true, force: true });
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('medallions/barricade: not a call type');
    expect(result.stderr).toContain('medallions/hostage_crisis: marked ready but file missing');
  });
});
