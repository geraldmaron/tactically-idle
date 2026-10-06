import { describe, expect, it } from 'vitest';
import { AMERICAN_ENGLISH } from '../../content/american-english';
import { PROCEDURAL_FAMILIES, PROCEDURAL_FAMILIES_G2, generateBuilding } from './index';

// Player-visible text of generated buildings is American English. The game's spelling bridge
// supplies the words; the extras are building vocabulary it does not cover.
const EXTRA = ['harbour', 'grey', 'metre', 'metres', 'programme', 'kerb', 'tyre', 'storey', 'storeys', 'semi-detached', 'flat', 'flats', 'mews', 'ensuite', 'en-suite', 'wc', 'bins', 'lorry', 'car park', 'pavement', 'forecourt', 'joinery', 'shop floor', 'colour', 'centre', 'neighbour'];
const BRITISH = [...new Set([...Object.keys(AMERICAN_ENGLISH).map((w) => w.toLowerCase()), ...EXTRA])];
const PATTERN = new RegExp(`\\b(${BRITISH.map((w) => w.replace(/[-]/g, '\\-')).join('|')})\\b`, 'i');

function britishIn(text: string): string | null {
  return PATTERN.exec(text)?.[0] ?? null;
}

describe('American English in generated buildings', () => {
  it('flags a British spelling', () => {
    expect(britishIn('Two-storey house')).toBe('storey');
    expect(britishIn('Neighbour')).toBe('Neighbour');
    expect(britishIn('Two-story house')).toBeNull();
  });

  it('labels every family, room, zone and note in American English for 50 seeds of each type', () => {
    const bad: string[] = [];
    for (const family of [...PROCEDURAL_FAMILIES, ...PROCEDURAL_FAMILIES_G2]) {
      for (const text of [family.label, family.blurb]) if (britishIn(text)) bad.push(`${family.id}: ${text}`);
      for (let seed = 0; seed < 50; seed++) {
        const loc = generateBuilding(`${family.id}__furnished_v7`, seed);
        const texts = [loc.name, ...loc.rooms.map((r) => r.label), ...loc.zones.map((z) => z.label), ...loc.notes.map((n) => n.text)];
        for (const text of texts) if (britishIn(text)) bad.push(`${loc.id} seed ${seed}: ${text}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  }, 120_000);
});
