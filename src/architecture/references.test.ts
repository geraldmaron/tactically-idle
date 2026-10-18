// Every source path a doc or skill cites must exist, so the writing pipeline and the design docs
// can't point agents at deleted modules. Dated records (captures, verification runs, research and
// review notes) are history and keep the paths they had. HANDOFF.md is left out: it lists the files
// lanes are changing on their branches, which may not exist on main yet.
import { describe, expect, it } from 'vitest';
import { JOBS, JOURNEYS } from './journeys';
import { WIRING } from './wiring';

const DOCS = import.meta.glob(['/AGENTS.md', '/README.md', '/PLAN.md', '/COORDINATION.md', '/docs/*.md', '/docs/calls/*.md', '/.agents/skills/**/*.md'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const FILES = new Set(Object.keys(import.meta.glob(['/src/**/*', '/scripts/**/*', '/public/**/*', '/.agents/skills/**/*', '/docs/**/*', '/*.md', '/*.html'])));
// Vite leaves the importing file out of its own glob.
FILES.add('/src/architecture/references.test.ts');
const DIRS = new Set([...FILES].flatMap(file => file.split('/').slice(1, -1).map((_, i, parts) => `/${parts.slice(0, i + 1).join('/')}`)));

/** `src/...` or `scripts/...` paths in prose, code spans and links, without a trailing `:line`. */
export function citedPaths(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?<![\w/.-])((?:src|scripts)\/[\w./-]*[\w-])/g)) found.add(match[1].replace(/[.]+$/, '').replace(/:\d+$/, ''));
  return [...found];
}

const existsAt = (path: string) => FILES.has(path) || DIRS.has(path) || FILES.has(`${path}.ts`) || FILES.has(`${path}.tsx`);
/** From the project root, or (for a skill citing its own `scripts/`) from the skill's folder. */
const exists = (doc: string, path: string) => /[*{]/.test(path) || existsAt(`/${path}`)
  || (doc.startsWith('/.agents/skills/') && existsAt(`${doc.split('/').slice(0, 4).join('/')}/${path}`));

/** Relative markdown link targets (`[text](../x.md#part)`), resolved against the linking doc. */
export function linkedPaths(doc: string, text: string): string[] {
  const dir = doc.slice(0, doc.lastIndexOf('/'));
  const out: string[] = [];
  // `[text](target)` and `[text](<target with spaces>)`; `#part` and a trailing `:line` dropped.
  for (const match of text.matchAll(/\]\((?:<([^>]+)>|([^)\s]+))\)/g)) {
    const target = (match[1] ?? match[2]).split('#')[0].replace(/:\d+(?:-\d+)?$/, '');
    if (!target || /^[a-z]+:/i.test(target)) continue;
    const parts: string[] = [];
    for (const part of (target.startsWith('/') ? target : `${dir}/${decodeURI(target)}`).split('/')) { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); }
    out.push(`/${parts.join('/')}`);
  }
  return out;
}

describe('doc references', () => {
  it('links only to files that exist', () => {
    const broken = Object.entries(DOCS).flatMap(([doc, text]) => linkedPaths(doc, text).filter(path => !existsAt(path.replace(/\/$/, ''))).map(path => `${doc.slice(1)} -> ${path.slice(1)}`));
    expect(broken, 'fix or remove these links').toEqual([]);
  });

  it('cites only source paths that exist', () => {
    const broken = Object.entries(DOCS).flatMap(([doc, text]) => citedPaths(text).filter(path => !exists(doc, path)).map(path => `${doc.slice(1)}: ${path}`));
    expect(broken, 'update or remove these references').toEqual([]);
  });
});

// The backlog's ids and tags (format in COORDINATION.md). This checks references only: that every
// job, journey, probe and backlog id an item names exists, and that the Needs graph has no cycle.
// Whether the tags still mean the right thing is the lead's read when an item ships.
const LANES = new Set(['engine', 'calls', 'tooling', 'interface', 'lead', 'deferred']);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface BacklogItem { id: string; line: number; tags: Record<string, string>; needs: Record<string, string> }

/** `key=value; key=value` after a `Tags:` or `Needs:` prefix. */
function fields(line: string | undefined, prefix: string): Record<string, string> | null {
  if (!line?.startsWith(`${prefix}: `)) return null;
  return Object.fromEntries(line.slice(prefix.length + 2).split('; ').map(part => [part.slice(0, part.indexOf('=')), part.slice(part.indexOf('=') + 1)]));
}

export function backlogItems(text: string): BacklogItem[] {
  const lines = text.split('\n');
  return lines.flatMap((line, i) => {
    if (!line.startsWith('### ')) return [];
    // A heading without `id: title` still becomes an item, so the id check reports it.
    const heading = /^### ([^:]+): ./.exec(line);
    return [{ id: heading ? heading[1] : line.slice(4), line: i + 1, tags: fields(lines[i + 1], 'Tags') ?? {}, needs: fields(lines[i + 2], 'Needs') ?? {} }];
  });
}

/** Ids in a value, parenthetical notes dropped. `none` stands alone; with `reason` set it must
 * carry a (reason). */
function listed(value: string | undefined, reason: boolean): { ids: string[]; problem?: string } {
  if (value === undefined) return { ids: [], problem: 'missing' };
  if (/^none(?: \([^()]*\))?$/.test(value)) return reason && value === 'none' ? { ids: [], problem: 'none needs a (reason)' } : { ids: [] };
  const ids = value.replace(/\s*\([^)]*\)/g, '').split(', ').map(id => id.trim());
  return ids.includes('none') || ids.some(id => id.startsWith('none ')) ? { ids, problem: 'none must stand alone' } : { ids };
}

export function backlogProblems(items: BacklogItem[], known: { jobs: Set<string>; journeys: Set<string>; probes: Set<string> }): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    const at = `${item.id} (line ${item.line})`;
    if (!ID.test(item.id)) problems.push(`${at}: id must be lowercase words joined by hyphens`);
    if (ids.has(item.id)) problems.push(`${at}: duplicate id`);
    ids.add(item.id);
    if (Object.keys(item.tags).sort().join() !== 'job,journeys,lane,probes') problems.push(`${at}: Tags line must have exactly job, journeys, probes, lane`);
    if (Object.keys(item.needs).sort().join() !== 'integrate,ship,start') problems.push(`${at}: Needs line must have exactly start, integrate, ship`);
    if (item.tags.lane !== undefined && !LANES.has(item.tags.lane)) problems.push(`${at}: unknown lane ${item.tags.lane}`);
    for (const [key, set] of [['job', known.jobs], ['journeys', known.journeys], ['probes', known.probes]] as const) {
      const { ids: named, problem } = listed(item.tags[key], true);
      if (problem && item.tags[key] !== undefined) problems.push(`${at}: ${key} ${problem}`);
      if (key === 'job' && named.length > 1) problems.push(`${at}: one job per item`);
      for (const name of named) {
        if (name.startsWith('new:')) { if (set.has(name.slice(4))) problems.push(`${at}: ${name} exists now; drop the new: prefix`); }
        else if (!set.has(name)) problems.push(`${at}: unknown ${key} id ${name}`);
      }
    }
  }
  const edges = new Map<string, string[]>();
  for (const item of items) {
    const out: string[] = [];
    for (const stage of ['start', 'integrate', 'ship']) {
      const { ids: needs, problem } = listed(item.needs[stage], false);
      if (problem && item.needs[stage] !== undefined) problems.push(`${item.id}: Needs ${stage} ${problem}`);
      for (const need of needs.filter(id => id !== 'none')) {
        if (!ids.has(need)) problems.push(`${item.id}: Needs ${stage} names ${need}, which is not in the backlog (shipped? remove it)`);
        else if (need === item.id) problems.push(`${item.id}: needs itself`);
        else out.push(need);
      }
    }
    edges.set(item.id, out);
  }
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'open') { problems.push(`Needs cycle: ${[...path.slice(path.indexOf(id)), id].join(' -> ')}`); return; }
    state.set(id, 'open');
    for (const next of edges.get(id) ?? []) visit(next, [...path, id]);
    state.set(id, 'done');
  };
  for (const id of edges.keys()) visit(id, []);
  return problems;
}

describe('backlog ids and tags', () => {
  const known = { jobs: new Set(Object.keys(JOBS)), journeys: new Set(JOURNEYS.map(j => j.id)), probes: new Set(WIRING.map(p => p.id)) };

  it('names only jobs, journeys, probes and backlog ids that exist, with no Needs cycle', () => {
    const items = backlogItems(DOCS['/docs/backlog.md']);
    expect(items.length, 'the backlog has items').toBeGreaterThan(0);
    expect(backlogProblems(items, known), 'fix these backlog tags (format in COORDINATION.md)').toEqual([]);
  });

  it('catches the mistakes it exists for', () => {
    const items = backlogItems([
      '### a-one: A', 'Tags: job=command; journeys=nope, new:answer-a-call; probes=none; lane=engine', 'Needs: start=b-two; integrate=gone; ship=none',
      '### b-two: B', 'Tags: job=command, build; journeys=answer-a-call; probes=items-none; lane=elsewhere', 'Needs: start=a-one; integrate=none; ship=none',
    ].join('\n'));
    expect(backlogProblems(items, known)).toEqual([
      'a-one (line 1): unknown journeys id nope',
      'a-one (line 1): new:answer-a-call exists now; drop the new: prefix',
      'a-one (line 1): probes none needs a (reason)',
      'b-two (line 4): unknown lane elsewhere',
      'b-two (line 4): one job per item',
      'a-one: Needs integrate names gone, which is not in the backlog (shipped? remove it)',
      'Needs cycle: a-one -> b-two -> a-one',
    ]);
  });

  it('reports untagged headings and a dependency hidden behind none', () => {
    const items = backlogItems([
      '### c-three: C', 'Tags: job=command; journeys=answer-a-call; probes=none (text); lane=calls', 'Needs: start=none (ready), d-four (must ship); integrate=none (a note); ship=none',
      '### an untagged item',
    ].join('\n'));
    expect(backlogProblems(items, known)).toEqual([
      'an untagged item (line 4): id must be lowercase words joined by hyphens',
      'an untagged item (line 4): Tags line must have exactly job, journeys, probes, lane',
      'an untagged item (line 4): Needs line must have exactly start, integrate, ship',
      'c-three: Needs start none must stand alone',
      'c-three: Needs start names d-four, which is not in the backlog (shipped? remove it)',
    ]);
  });
});
