import { describe, expect, it } from 'vitest';
import { CONTENT_DESCRIPTORS } from '../content-descriptors';
import { CONTROLS, controlsFor, gaps, type Surface } from './controls';
import { blocking, checkText, surfaceOfPath, TEXT_CHECKS } from './checks';
import { editorialBrief } from './brief';
import { ratingProfile, reviewNotes, type SituationFacts } from './rating';
import { POLICY_SOURCES } from './sources';

// Which files exist, read through Vite so the test needs no node types. Keys are project-rooted paths.
const FILES = new Set(Object.keys(import.meta.glob(['/src/**/*.{ts,tsx}', '/docs/*.md', '/.agents/skills/**/*.md'], { query: '?raw', import: 'default' })));
const exists = (ref: string) => FILES.has('/' + ref);
const BACKLOG = Object.values(import.meta.glob('/docs/backlog.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0] ?? '';
const SURFACES: Surface[] = ['call_text', 'threat_text', 'ending_text', 'chat', 'world_text', 'handle', 'art', 'store_metadata', 'generation', 'ui', 'review'];

describe('the control registry', () => {
  it('has unique ids, known sources and at least one source each', () => {
    const ids = CONTROLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sources = new Set<string>(POLICY_SOURCES.map((s) => s.id));
    for (const c of CONTROLS) {
      expect(c.sources.length, c.id).toBeGreaterThan(0);
      for (const source of c.sources) expect(sources.has(source), `${c.id} cites ${source}`).toBe(true);
    }
  });

  it('points every enforcement at something that exists', () => {
    for (const c of CONTROLS) for (const e of c.enforcedBy) {
      if (e.kind === 'text') expect(TEXT_CHECKS[e.check].control, `${c.id} text check ${e.check}`).toBe(c.id);
      else if (e.kind !== 'gap') expect(exists(e.ref), `${c.id} -> ${e.ref}`).toBe(true);
    }
  });

  it('holds every blocking control with a check, a gate, a screen, a derivation or an owned gap', () => {
    for (const c of CONTROLS.filter((x) => x.severity === 'block')) {
      expect(c.enforcedBy.length, `${c.id} has no enforcement`).toBeGreaterThan(0);
    }
    // A gap must name a backlog item that exists.
    for (const { control, gap } of gaps()) expect(BACKLOG.includes(`### ${gap.backlog}:`), `${control.id} names backlog item ${gap.backlog}`).toBe(true);
  });

  it('gives every text check a surface and every surface a brief', () => {
    for (const check of Object.values(TEXT_CHECKS)) expect(CONTROLS.find((c) => c.id === check.control)!.surfaces.length).toBeGreaterThan(0);
    for (const surface of SURFACES) expect(editorialBrief(surface)).toContain('## Limits');
    expect(controlsFor('threat_text').map((c) => c.id)).toEqual(expect.arrayContaining(['V1', 'V4', 'V5', 'Q4']));
  });
});

describe('the text checks', () => {
  const ids = (text: string, surface: Surface = 'call_text') => checkText(text, surface).map((f) => f.control);

  it('lets plain, grounded harm through', () => {
    expect(ids('Brandon is hurt and needs an ambulance. Destiny stays with him on the curb.', 'ending_text')).toEqual([]);
    expect(ids('The handgun comes up, and Brandon stops asking to sit.', 'threat_text')).toEqual([]);
  });
  it('blocks graphic harm, real firearms, self-harm method and real brands', () => {
    expect(blocking(checkText('Blood on the tile.', 'call_text')).map((f) => f.control)).toEqual(['V1']);
    expect(ids('He was screaming in pain and writhing on the tile.')).toContain('V1');
    expect(ids('A Glock in his waistband, and a 9mm in the drawer.')).toContain('V5');
    expect(ids('She says she took the lethal dose.')).toContain('S1');
    expect(ids('The stream was on Twitch.')).toContain('R1');
  });
  it('does not mistake ordinary words for brands', () => {
    expect(ids('Kick the door. The Fox on Ninth is closed.')).toEqual([]);
  });
  it('flags a named method of harm and a typed address for a person to read', () => {
    expect(checkText('He threatens to strangle him.', 'threat_text').map((f) => [f.control, f.severity])).toEqual([['V4', 'fix']]);
    expect(ids('The comment gives 214 Ninth Street.', 'chat')).toContain('H1');
  });
  it('wants AM or PM on a clock time, and leaves speaker formats alone', () => {
    expect(ids('Logged at 11:40.')).toEqual(['Q2']);
    expect(ids('Logged at 11:40 PM, then 12:10 AM.')).toEqual([]);
    expect(ids('Radio: Window. Handgun on the manager. Holding.')).toEqual([]);
  });
  it('reads chat and handles only through the controls that list them', () => {
    expect(ids('Logged at 11:40.', 'chat')).toEqual([]);
  });
  it('maps string paths to surfaces', () => {
    expect(surfaceOfPath('ending.manager_killed.summary')).toBe('ending_text');
    expect(surfaceOfPath('going_live.on_stream.adverse[1]')).toBe('threat_text');
    expect(surfaceOfPath('going_live.prompt')).toBe('call_text');
  });
});

describe('the rating profile', () => {
  const facts = (...lists: (typeof CONTENT_DESCRIPTORS[number][])[]): SituationFacts[] => lists.map((descriptors, situation) => ({ call: 'x', situation, descriptors }));
  it('answers none, infrequent and frequent from the share of situations', () => {
    expect(ratingProfile(facts([], [], [], []).slice(0, 4)).apple.realisticViolence).toBe('none');
    expect(ratingProfile(facts(['injury'], [], [], [], [], [], [], [], [])).apple.realisticViolence).toBe('infrequent');
    expect(ratingProfile(facts(['injury'], [], [], [])).apple.realisticViolence).toBe('frequent');
  });
  it('implies 18+ when realistic violence is frequent, and never lets a filter lower it', () => {
    const profile = ratingProfile(facts(['death', 'injury'], ['injury'], []));
    expect(profile.apple.impliedMinimumAge).toBe(18);
    expect(profile.apple.prolongedGraphicViolence).toBe('none');
  });
  it('writes review notes from the profile', () => {
    const notes = reviewNotes(ratingProfile(facts(['death', 'injury', 'suicide_self_harm'], ['injury']))).join(' ');
    expect(notes).toContain('invented');
    expect(notes).toContain('support line');
    expect(notes).toContain('no user-generated content');
  });
});
