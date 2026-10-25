import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../incidents';
import type { IncidentTemplate } from '../incidents/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { generateIncident } from '../../gen/incident';
import { mapScenarioText } from '../../gen/incident/scenario-text';
import { specForSituation, VARIANTS } from '../../gen/incident/gates/catalog';
import { SOFT_PAIRS, hasStrongLanguage, softenAuthored, softenLanguage } from './index';

// The Soften strong language gate (docs/content-policy.md, control L1; backlog `language-coverage`). Three readings:
// every strong line in a finished scenario has an authored alternate, the scenario mapper reaches every prose field
// a screen can print, and the alternates themselves are clean.

const templates = (Object.values(INCIDENT_TEMPLATES) as (IncidentTemplate | undefined)[]).filter((t): t is IncidentTemplate => !!t);

/** Finished scenarios the way the policy corpus gate reads them: every variant of every template, two seeds. */
function scenarios(): { id: string; scenario: ScenarioDefinition }[] {
  const out: { id: string; scenario: ScenarioDefinition }[] = [];
  for (const template of templates) for (const variant of VARIANTS) for (const seed of [7, 11]) {
    try { out.push({ id: `${template.type}/v${variant}/${seed}`, scenario: generateIncident(specForSituation(template.type, template.tree.families[0], variant, seed)) }); } catch { /* an unbuildable pair */ }
  }
  return out;
}

/** Every prose string in `value` with its path. Prose is a string with a space in it, as the policy guard reads it. */
function prose(value: unknown): { where: string; text: string }[] {
  const found: { where: string; text: string }[] = [];
  const seen = new WeakSet<object>();
  const visit = (node: unknown, where: string): void => {
    if (typeof node === 'string') { if (/\s/.test(node)) found.push({ where, text: node }); return; }
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) node.forEach((item, index) => visit(item, `${where}[${index}]`));
    else for (const [key, item] of Object.entries(node)) visit(item, where ? `${where}.${key}` : key);
  };
  visit(value, '');
  return found;
}

/** The operation code ('OP 0141') has a space in it and is not call text. Everything else a scenario holds with a space is read. */
const NOT_SHOWN = /^code$/;

describe('strong language, softened', () => {
  const finished = scenarios();

  it('builds scenarios to read', () => { expect(finished.length).toBeGreaterThan(0); });

  it('every line with strong language has an authored alternate', () => {
    const missing = finished.flatMap(({ id, scenario }) => prose(scenario)
      .filter(({ text }) => hasStrongLanguage(softenAuthored(text)))
      .map(({ where, text }) => `${id} ${where}: "${text.slice(0, 90)}"`));
    expect([...new Set(missing)]).toEqual([]);
  });

  it('the scenario mapper reaches every prose field', () => {
    // Put a strong word in every prose string, map the scenario through the softener, and see what survives.
    const marked = structuredClone(finished[0].scenario);
    const mark = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const holder = node as Record<string, unknown>;
      for (const key of Object.keys(holder)) {
        const item = holder[key];
        if (typeof item === 'string') { if (/\s/.test(item)) holder[key] = `${item} fuck`; } else mark(item);
      }
    };
    mark(marked);
    const left = prose(mapScenarioText(marked, softenLanguage)).filter(({ text }) => /\bfuck\b/i.test(text)).map(({ where }) => where.replace(/\[\d+\]/g, '[]'));
    expect([...new Set(left)].filter((where) => !NOT_SHOWN.test(where))).toEqual([]);
  });

  it('each authored pair is clean, used and free of dashes', () => {
    const dashes = /[‒-―]|(?<=\S) - (?=\S)|--/;
    for (const pair of SOFT_PAIRS) {
      expect(hasStrongLanguage(pair.to), pair.to).toBe(false);
      expect(dashes.test(pair.to), pair.to).toBe(false);
      expect(hasStrongLanguage(pair.from), `${pair.from} is not strong language, so it needs no pair`).toBe(true);
      const used = finished.some(({ scenario }) => prose(scenario).some(({ text }) => text.includes(pair.from)));
      expect(used, `no finished scenario carries: ${pair.from}`).toBe(true);
    }
  });

  it('the net replaces whole words only', () => {
    expect(softenLanguage('What the fuck, Rachel.')).toBe('What the heck, Rachel.');
    expect(softenLanguage('Scunthorpe, class, a hello.')).toBe('Scunthorpe, class, a hello.');
  });

  it('no screen prints a saved line of recorded text without the player\'s text choice', () => {
    // The simulation saves the words a result used when it happened, so a screen reads them through `shown`
    // (ui/language.ts) or PeopleText. These fields are the saved ones a screen prints on its own.
    const saved = /\b(endingTitle|endingSummary|endingEpilogue|epilogue|cause)\b/;
    const files: string[] = [];
    const walk = (dir: string): void => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) files.push(path); } };
    walk('src/ui');
    const raw: string[] = [];
    for (const file of files) readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      // A value printed: a JSX hole or a template hole that names a saved field, with no `shown(` or PeopleText on the line.
      if (/(?:\$\{|\{)[^{}]*\.(?:endingTitle|endingSummary|endingEpilogue|epilogue|cause)\b[^{}]*\}/.test(line) && saved.test(line) && !/shown\(|PeopleText/.test(line)) raw.push(`${file}:${index + 1}: ${line.trim().slice(0, 100)}`);
    });
    expect(raw).toEqual([]);
  });
});
