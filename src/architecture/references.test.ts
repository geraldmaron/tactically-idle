// Every source path a doc or skill cites must exist, so the writing pipeline and the design docs
// can't point agents at deleted modules. Dated records (captures, verification runs, research and
// review notes) are history and keep the paths they had.
import { describe, expect, it } from 'vitest';

const DOCS = import.meta.glob(['/AGENTS.md', '/README.md', '/PLAN.md', '/docs/*.md', '/docs/calls/*.md', '/.agents/skills/**/*.md'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
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
