// The chat on a pressure source (PressureSource.reactions) is read live, a line every few seconds,
// and the strip shows each line at most once a run (ui/screens/live-chat.ts drawChatLine). These
// gates keep every call that uses the pattern stocked so a player sitting on one cue doesn't run the
// pool dry in a minute, and keep the lines inside the game's prose rules
// (.agents/skills/swat-call-prose, "Viewer chat").
import { describe, expect, it } from 'vitest';
import { META_PHRASING, SUICIDE_METHOD, UNSAFE_DETAIL } from '../../gen/incident/gates/prose-lint';
import type { PressureSource } from '../../sim/scenario-types';
import { WORLD_TOKENS } from '../world';
import { INCIDENT_TEMPLATES } from '.';

/** Lines each cue's pool holds at least: about a minute and a half of chat at the strip's pace. */
export const REACTION_FLOOR = 16;
/** Lines the spike pool holds at least: a jump plays three, and a call has several jumps. */
export const SPIKE_FLOOR = 8;
/** A chat line's longest raw length; the strip shows one line under a handle at phone width. */
const LINE_MAX = 60;
/** Pronouns and gendered nouns are drawn per call, so a viewer names people or says "they". */
const GENDERED = /\b(he|she|him|her|his|hers|himself|herself|bro|dude|man|girl|guy|sis)\b/i;

/** Every pressure source a template's situations carry, with its clock id. */
function sources(): [string, string, PressureSource][] {
  return Object.values(INCIDENT_TEMPLATES).flatMap(template => template!.situations.flatMap(situation =>
    (situation.clocks ?? []).flatMap(clock => clock.source?.reactions ? [[template!.type, clock.id, clock.source] as [string, string, PressureSource]] : [])))
    .filter(([type, id], i, all) => all.findIndex(([t, c]) => t === type && c === id) === i);
}

const fourWordRuns = (line: string) => {
  const words = line.toLowerCase().replace(/[^a-z0-9’' {}._]/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, -3).map((_, i) => words.slice(i, i + 4).join(' '));
};

describe('viewer chat on pressure sources', () => {
  const all = sources();

  it('finds the calls that use the pattern', () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it.each(all)('%s %s has a pool for every cue, each deep enough to last', (_, id, source) => {
    const template = Object.values(INCIDENT_TEMPLATES).find(t => t!.situations.some(s => s.clocks?.some(c => c.id === id && c.source === source)))!;
    const clock = template.situations.flatMap(s => s.clocks ?? []).find(c => c.source === source)!;
    const pools = source.reactions!.byCue;
    expect(pools.length, 'one pool before the first cue, then one per cue').toBe(clock.cues.length + 1);
    pools.forEach((pool, i) => expect(pool.length, `pool ${i}`).toBeGreaterThanOrEqual(REACTION_FLOOR));
    expect(source.reactions!.spike?.length ?? 0).toBeGreaterThanOrEqual(SPIKE_FLOOR);
  });

  it.each(all)('%s %s never says a line twice or repeats a 4-word run', (_, __, source) => {
    const lines = [...source.reactions!.byCue.flat(), ...source.reactions!.spike ?? []];
    expect(lines.filter((line, i) => lines.indexOf(line) !== i)).toEqual([]);
    const runs = lines.flatMap(line => [...new Set(fourWordRuns(line))].map(run => [run, line] as const));
    const repeated = runs.filter(([run], i) => runs.findIndex(([other]) => other === run) !== i);
    expect(repeated).toEqual([]);
  });

  it.each(all)('%s %s keeps every line inside the prose rules', (_, __, source) => {
    const roles = /^\{[a-z_]+\.(first|full)\}$/;
    for (const line of [...source.reactions!.byCue.flat(), ...source.reactions!.spike ?? []]) {
      expect(line.length, line).toBeLessThanOrEqual(LINE_MAX);
      expect(line, 'no dashes or colons').not.toMatch(/[—–:]|\s-\s/);
      expect(line, 'gendered word').not.toMatch(GENDERED);
      expect(line).not.toMatch(UNSAFE_DETAIL);
      expect(line).not.toMatch(SUICIDE_METHOD);
      expect(line).not.toMatch(META_PHRASING);
      for (const token of line.match(/\{[^}]+\}/g) ?? []) expect(roles.test(token) || WORLD_TOKENS.includes(token.slice(1, -1)), token).toBe(true);
    }
  });
});
