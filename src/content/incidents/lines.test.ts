import { describe, expect, it } from 'vitest';
import { LAST_SEEN_LINES } from './lines';

describe('LAST_SEEN_LINES', () => {
  it('fits the marker and claim budgets and keeps only the two engine tokens', () => {
    expect(LAST_SEEN_LINES.marker.length).toBeLessThanOrEqual(10);
    expect(LAST_SEEN_LINES.marker).toBe(LAST_SEEN_LINES.marker.toUpperCase());
    expect(LAST_SEEN_LINES.claim.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(LAST_SEEN_LINES.claim.match(/\{[^}]+\}/g)).toEqual(['{person}', '{place}']);
    for (const text of Object.values(LAST_SEEN_LINES)) expect(text).not.toMatch(/[–—:]| - /);
    // Bound the way the engine binds it: a first name, and the room as "the" plus its label lowercased.
    const bound = LAST_SEEN_LINES.claim.replace('{person}', 'Agnieszka').replace('{place}', `the ${'Living room'.toLowerCase()}`);
    expect(bound).toBe('Agnieszka was last seen in the living room.');
  });
});
