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

const ALL_EMBLEMS = ['composure_workshop', 'branch_personnel', 'branch_field'];
const ALL_MEDALLIONS = ['hostage_crisis', 'barricaded'];
const MANAGERS = ['watch_commander', 'training_sergeant', 'quartermaster', 'recruiter', 'peer_support_lead'];
const CRESTS = ['alpha', 'bravo', 'charlie', 'delta'];

/** A minimal checkout: one course, two branches, one item, and complete art sets except where a test gives its own
 * emblems or medallions (every set must be complete, so a default set lists everything the checkout defines). */
function fixture(emblemIds: string[] = ALL_EMBLEMS, medallionIds: string[] = ALL_MEDALLIONS, gearIds: string[] = ['radio_kit']): string {
  const root = fs.mkdtempSync(join(node.getBuiltinModule('node:os').tmpdir(), 'ti-art-'));
  roots.push(root);
  const write = (file: string, content: string) => {
    fs.mkdirSync(dirname(join(root, file)), { recursive: true });
    fs.writeFileSync(join(root, file), content);
  };
  write('src/content/personas.json', '[]');
  write('src/content/courses.ts', "export const COURSES = {\n  composure_workshop: {\n    name: 'Composure workshop',\n  },\n};\n");
  write('src/ui/components/labels.ts', "export const BRANCHES: DevBranch[] = ['personnel', 'field'];\n");
  write('src/content/items.ts', "export const ITEMS: Record<string, ItemDefinition> = {\n  radio_kit: {\n    id: 'radio_kit',\n  },\n};\n");
  for (const set of ['portraits', 'materials', 'plates']) write(`public/art/${set}/manifest.json`, JSON.stringify({ version: 1, readyIds: [], width: 100, height: 100 }));
  for (const [set, ids] of [['gear', gearIds], ['managers', MANAGERS], ['crests', CRESTS]] as const) {
    write(`public/art/${set}/manifest.json`, JSON.stringify({ version: 1, readyIds: ids, width: 100, height: 100 }));
    for (const id of ids) write(`public/art/${set}/${id}.webp`, WEBP);
  }
  write('src/ui/icons/kit.ts', "export const CALL_TYPE_ICON: Record<IncidentType, IconName> = {\n  hostage_crisis: 'hostage',\n  barricaded: 'barricade',\n};\n");
  write('public/art/medallions/manifest.json', JSON.stringify({ version: 1, readyIds: medallionIds, width: 100, height: 100 }));
  for (const id of medallionIds) write(`public/art/medallions/${id}.webp`, WEBP);
  write('public/art/emblems/manifest.json', JSON.stringify({ version: 1, readyIds: emblemIds, width: 100, height: 100 }));
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
    const result = run(fixture());
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ emblemsReady: 3, emblemIds: 3 });
  });

  it('fails on an emblem id that matches no course or branch', () => {
    const result = run(fixture([...ALL_EMBLEMS, 'branch_logistics', 'field']));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('emblems/branch_logistics: not a course or development branch');
    expect(result.stderr).toContain('emblems/field: not a course or development branch');
    expect(result.stderr).not.toContain('composure_workshop');
    expect(result.stderr).not.toContain('no art');
  });
});

describe('validate-art medallions', () => {
  it('accepts a medallion for each call type', () => {
    const result = run(fixture(undefined, ['hostage_crisis', 'barricaded']));
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ medallionsReady: 2, callTypeIds: 2 });
  });

  it('fails on a medallion id that is no call type, and on a ready id with no file', () => {
    const root = fixture(undefined, ['hostage_crisis', 'barricade']);
    fs.rmSync(join(root, 'public/art/medallions/hostage_crisis.webp'), { recursive: true, force: true });
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('medallions/barricade: not a call type');
    expect(result.stderr).toContain('medallions/hostage_crisis: marked ready but file missing');
  });
});

describe('validate-art station rebuild sets', () => {
  const ready = (root: string, kind: string, ids: string[]) => {
    fs.writeFileSync(join(root, `public/art/${kind}/manifest.json`), JSON.stringify({ version: 1, readyIds: ids, width: 100, height: 100 }));
    for (const id of ids) fs.writeFileSync(join(root, `public/art/${kind}/${id}.webp`), WEBP);
  };

  it('accepts the squad crests, the five managers and the room vignettes', () => {
    const root = fixture();
    ready(root, 'plates', ['room_recovery_lit', 'room_garage_dark', 'scene_swat_locker']);
    const result = run(root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ crestsReady: 4, managersReady: 5 });
  });

  it('fails on a crest, manager or room id outside the sets', () => {
    const root = fixture();
    ready(root, 'crests', ['echo']);
    ready(root, 'managers', ['janitor']);
    ready(root, 'plates', ['room_attic_lit']);
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('crests/echo: not a squad crest');
    expect(result.stderr).toContain('managers/janitor: not a Command Staff manager');
    expect(result.stderr).toContain('plates/room_attic_lit: not a scene, banner or texture id');
  });
});

/** A stub header long enough to carry dimensions: a VP8X chunk of `w` x `h` with the alpha flag as given. Sizes stay
 * under 128 so every byte survives the UTF-8 write. */
const sized = (w: number, h: number, alpha: boolean) => {
  const header = new Uint8Array(30);
  header.set([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 88, 10, 0, 0, 0, alpha ? 0x10 : 0], 0);
  for (const [at, v] of [[24, w - 1], [27, h - 1]] as const) header.set([v & 255, (v >> 8) & 255, (v >> 16) & 255], at);
  return String.fromCharCode(...header);
};

describe('validate-art one style per set', () => {
  const put = (root: string, kind: string, id: string, content: string) => fs.writeFileSync(join(root, `public/art/${kind}/${id}.webp`), content);

  it('accepts a cutout set with alpha at the set size', () => {
    const root = fixture();
    put(root, 'gear', 'radio_kit', sized(100, 100, true));
    expect(run(root).status).toBe(0);
  });

  it('fails a cutout with no alpha, a wrong canvas, and a file the manifest does not list', () => {
    const root = fixture();
    put(root, 'gear', 'radio_kit', sized(100, 100, false));
    put(root, 'emblems', 'branch_field', sized(60, 60, true));
    put(root, 'gear', 'battery_pack', sized(100, 100, true));
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('gear/radio_kit: no alpha channel');
    expect(result.stderr).toContain('emblems/branch_field: 60x60, the set is 100x100');
    expect(result.stderr).toContain('gear/battery_pack: file is not listed in the manifest');
  });

  it('fails a set that is missing the painting for something the game defines', () => {
    const result = run(fixture(undefined, undefined, []));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('gear/radio_kit: no art');
  });
});
