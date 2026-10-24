import { describe, expect, it } from 'vitest';
import { JACKETS, authoredPages, jacketFor, templateJacket, type NoticesFirst, type VoiceHabit } from './jackets';
import { IMPRINT_PACKS, IMPRINT_PACK_IDS, IMPRINT_PRIORITY, packTraitInfo } from './imprints';
import { BOND_CAUSE_LINE, BOND_CHANGE_LINE, BOND_STATE_LABEL, FACT_SHAPES, TIE_LINE, DISTRICT_PLACE, CASE_END } from './facts';
import { PERSONAS, PERSONA_BY_ID } from '../personas';
import { bindTelegraph } from '../../sim/people/selectors';
import { DISTRICT_IDS } from '../../sim/world/types';
import { METHOD_REVIEW, META_PHRASING, SUICIDE_METHOD, UNSAFE_DETAIL } from '../../gen/incident/gates/prose-lint';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const wc = (s: string) => words(s).length;

/** Every authored string a player reads, with where it came from. */
function allStrings(): { where: string; text: string; clock?: boolean }[] {
  const out: { where: string; text: string; clock?: boolean }[] = [];
  for (const j of Object.values(JACKETS)) {
    const p = j.page1;
    out.push({ where: `${j.personaId} pressure`, text: p.pressureLine }, { where: `${j.personaId} contradiction`, text: p.contradiction ?? '' });
    for (const [k, v] of Object.entries(p.radio ?? {})) out.push({ where: `${j.personaId} radio ${k}`, text: v, clock: true });
    out.push({ where: `${j.personaId} page2`, text: j.page2?.line ?? '' }, { where: `${j.personaId} page3`, text: j.page3?.line ?? '' });
  }
  for (const pack of Object.values(IMPRINT_PACKS)) {
    out.push({ where: `${pack.id} label`, text: pack.label }, { where: `${pack.id} telegraph`, text: pack.telegraph });
    for (const [k, o] of Object.entries(pack.fork)) out.push({ where: `${pack.id} ${k} label`, text: o.label }, { where: `${pack.id} ${k} line`, text: o.line }, { where: `${pack.id} ${k} cost`, text: o.cost }, { where: `${pack.id} ${k} risk`, text: o.risk });
    for (const t of [pack.strain, pack.positive]) out.push({ where: `${t.id} chip`, text: t.chip }, { where: `${t.id} condition`, text: t.condition });
  }
  for (const [kind, shapes] of Object.entries(FACT_SHAPES)) shapes.forEach((s, i) => out.push({ where: `fact ${kind} ${i}`, text: s }));
  for (const [k, v] of Object.entries({ ...TIE_LINE, ...BOND_CHANGE_LINE, ...BOND_CAUSE_LINE, ...BOND_STATE_LABEL, ...DISTRICT_PLACE, ...CASE_END })) out.push({ where: `label ${k}`, text: v });
  return out.filter((s) => s.text);
}

describe('authored people text follows the prose rules', () => {
  it('has no em dash, en dash or spaced hyphen, and no colon except a clock time in a radio sample', () => {
    const all = allStrings();
    expect(all.length).toBeGreaterThan(150);
    for (const s of all) {
      expect(s.text, s.where).not.toMatch(/[–—]/);
      expect(s.text, s.where).not.toMatch(/ - | -$|^- /);
      const rest = s.clock ? s.text.replace(/\d{1,2}:\d{2}/g, '') : s.text;
      expect(rest, s.where).not.toContain(':');
    }
  });

  it('uses no stock hype or virtue words, no trauma labels and no stock cop-show lines', () => {
    const banned = /\b(brave|fearless|dedicated|tireless|hardworking|heroic|selfless|hothead|haunted|broken|damaged|cracked|veteran|seasoned|green)\b|by the book|natural leader|born medic|short fuse|ice in|lost their nerve|couldn'?t hack|not going anywhere|let me do the talking|delve|seamless|robust|tapestry/i;
    for (const s of allStrings()) expect(s.text, s.where).not.toMatch(banned);
  });

  it('passes the repo prose lint\'s injury, method and meta-phrasing word lists', () => {
    for (const s of allStrings()) {
      for (const [name, re] of [['unsafe detail', UNSAFE_DETAIL], ['suicide method', SUICIDE_METHOD], ['method review', METHOD_REVIEW], ['meta phrasing', META_PHRASING]] as const) {
        expect(s.text, `${s.where} ${name}`).not.toMatch(re);
      }
    }
  });

  it('never says earned, won or gained about a strain, and has no because clause on a jacket line', () => {
    for (const pack of Object.values(IMPRINT_PACKS)) {
      expect(`${pack.strain.chip} ${pack.strain.condition}`, pack.id).not.toMatch(/\b(earned|won|gained)\b/i);
    }
    for (const j of Object.values(JACKETS)) {
      for (const text of [j.page2?.line, j.page3?.line]) expect(text, j.personaId).not.toMatch(/\b(because|so that|which means)\b/i);
    }
  });
});

describe('the authored jackets', () => {
  const persona = (id: string) => PERSONA_BY_ID[id];
  const jackets = Object.values(JACKETS);

  it('cover every persona, once, so any squad a campaign draws has authored jackets', () => {
    expect(jackets.map((j) => j.personaId).sort()).toEqual(PERSONAS.map((p) => p.id).sort());
  });

  it('keep each pressure line to the skill\'s rules', () => {
    for (const j of jackets) {
      const p = persona(j.personaId);
      const line = j.page1.pressureLine;
      expect(line, j.personaId).toMatch(/^(She|He|They)\b/);
      expect(line.startsWith(p.pronouns === 'she' ? 'She' : p.pronouns === 'he' ? 'He' : 'They'), `${j.personaId} pronoun`).toBe(true);
      expect(wc(line), j.personaId).toBeLessThanOrEqual(18);
      expect(wc(j.page1.contradiction!), `${j.personaId} contradiction`).toBeLessThanOrEqual(12);
      expect(line, `${j.personaId} no years or rank`).not.toMatch(/\b\d+ years?\b|\b(rank|sergeant|corporal|lieutenant|probationary|on the job)\b/i);
    }
  });

  it('keep the hobby the catalog already has', () => {
    const stems: Record<string, RegExp> = {
      person_001: /shopfront/i, person_002: /radio/i, person_003: /cuttings/i, person_004: /clock/i,
      person_005: /recipes/i, person_006: /gardens/i, person_007: /paperback/i, person_008: /paper buildings/i,
    };
    for (const j of jackets) expect(j.page1.pressureLine, j.personaId).toMatch(stems[j.personaId]);
  });

  it('read true on every role and trait: no role, trait word, rank or service claim in an identity line', () => {
    const roleOrTrait = /\b(comms|breach|medic|recon|negotiat\w*|entry team|steady|observant|mentor|impatient|calm|patient|rookie|leader|squad leader)\b/i;
    for (const j of jackets) {
      for (const text of [j.page1.pressureLine, j.page1.contradiction, j.page2?.line]) expect(text, j.personaId).not.toMatch(roleOrTrait);
    }
  });

  it('use the pronouns of the persona and no others', () => {
    for (const j of jackets) {
      const p = persona(j.personaId);
      const text = [j.page1.pressureLine, j.page1.contradiction, j.page2?.line, j.page3?.line].join(' ');
      if (p.pronouns === 'she') expect(text, j.personaId).not.toMatch(/\b(he|him|his)\b/i);
      if (p.pronouns === 'he') expect(text, j.personaId).not.toMatch(/\b(she|her|hers|herself)\b/i);
    }
  });

  it('give each officer different markers, a different contradiction pattern and a different radio voice', () => {
    // Nine or ten values each cannot be unique across 100 officers: spread them, no value over a fifth.
    const capped = (values: readonly unknown[]) => {
      const counts = new Map<unknown, number>();
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
      return Math.max(...counts.values());
    };
    expect(capped(jackets.map((j) => j.page1.markers!.noticesFirst))).toBeLessThanOrEqual(Math.ceil(jackets.length / 5));
    expect(capped(jackets.map((j) => j.page1.pattern))).toBeLessThanOrEqual(Math.ceil(jackets.length / 5));
    expect(capped(jackets.map((j) => j.page1.markers!.habit))).toBeLessThanOrEqual(Math.ceil(jackets.length / 5));
    expect(new Set(jackets.map((j) => j.page1.radio!.ready)).size).toBe(jackets.length);
  });

  it('keep radio grammar: ready under ten words, strained shorter, overloaded under five, and the ready line shows each marker', () => {
    const habitShown: Record<VoiceHabit, (s: string) => boolean> = {
      'names the street': (s) => /\b(Street|Road|Avenue)\b/.test(s),
      'reports gear before people': (s) => /\b(handset|handsets|shield|bag)\b/i.test(s.split('.')[1] ?? ''),
      'gives the clock time': (s) => /\d{1,2}:\d{2}/.test(s),
      'counts out loud': (s) => /\b(one|two|three|four|five)\b/i.test(s),
      'ends on a question': (s) => /\?$/.test(s),
      'repeats the last thing said': (s) => { const m = s.match(/'([^']+?)\.?'/); return !!m && s.toLowerCase().split(m[1].toLowerCase()).length >= 3; },
      'says copy and nothing else': (s) => /Copy\.$/.test(s),
      'names the next step': (s) => /next\.$/i.test(s),
      'names the person': () => true,
      'describes hands first': () => true,
    };
    const noticed: Record<NoticesFirst, RegExp> = {
      exits: /\b(door|gate|window|stairs|exit)\b/i, hands: /\bhands?\b/i, sound: /\b(running|noise|sound|quiet|fan)\b/i, time: /\d{1,2}:\d{2}/,
      gear: /\b(handset|shield|bag|radio)s?\b/i, words: /\b(says|said|caller)\b/i, faces: /\b(man|woman|face|watching)\b/i, light: /\b(lit|light|dark|lamp)\b/i, count: /\b(one|two|three|four)\b/i,
    };
    for (const j of jackets) {
      const r = j.page1.radio!, m = j.page1.markers!;
      expect(wc(r.ready), `${j.personaId} ready`).toBeLessThanOrEqual(10);
      expect(wc(r.strained), `${j.personaId} strained`).toBeLessThanOrEqual(wc(r.ready));
      expect(wc(r.overloaded), `${j.personaId} overloaded`).toBeLessThanOrEqual(4);
      expect(habitShown[m.habit](r.ready), `${j.personaId} habit ${m.habit}`).toBe(true);
      expect(r.ready, `${j.personaId} noticed ${m.noticesFirst}`).toMatch(noticed[m.noticesFirst]);
      // The habit drops first under strain.
      expect(r.strained).not.toEqual(r.ready);
      // "clear" is for an empty space and is never followed by occupants; "counting N" is a coinage.
      expect(r.ready).not.toMatch(/\bcounting \w+|\bclear\b.*\b(two|three|inside)\b/i);
      // Length marker: short is up to seven words, medium eight to ten.
      expect(wc(r.ready) <= 7, `${j.personaId} length ${m.length}`).toBe(m.length === 'short');
    }
  });

  it('give every starter a second and third page, each with a home district; page 3 carries a place slot', () => {
    for (const j of jackets) {
      expect(authoredPages(j)).toBe(3);
      expect(DISTRICT_IDS).toContain(j.page2!.district);
      expect(j.page3!.line).toContain('{place}');
    }
    // Every district has a home officer, and the opening district has three.
    const counts = DISTRICT_IDS.map((id) => jackets.filter((j) => j.page2!.district === id).length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(10);
  });

  it('keep openness a stated choice, off by default, and tie kinds free of faith unless stated', () => {
    expect(jackets.filter((j) => j.openToRelationship).length).toBeGreaterThanOrEqual(2);
    expect(templateJacket('person_999').openToRelationship).toBe(false);
    for (const j of jackets) expect(j.tieKinds).not.toContain('church');
  });

  it('every other persona gets the template path: the persona\'s own note, nothing invented, one page', () => {
    for (const p of PERSONAS.filter((x) => !JACKETS[x.id])) {
      const t = jacketFor(p.id);
      expect(t.page1.pressureLine).toBe(p.personalNote);
      expect(t.page1.markers).toBeNull();
      expect(t.page1.radio).toBeNull();
      expect(t.page2).toBeNull();
      expect(authoredPages(t)).toBe(1);
      expect(t.openToRelationship).toBe(false);
    }
    expect(jacketFor(undefined).page1.pressureLine).toBe('');
  });
});

describe('the imprint packs', () => {
  it('are the eight packs, each readable in the trigger order', () => {
    expect(IMPRINT_PACK_IDS.sort()).toEqual(['carries_the_name', 'counts_exits', 'doubts_the_rear', 'found_the_voice', 'hard_night', 'rattled_by_fire', 'short_with_callers', 'steadied_by_partner']);
    expect([...IMPRINT_PRIORITY].sort()).toEqual([...IMPRINT_PACK_IDS].sort());
    expect(Object.values(IMPRINT_PACKS).filter((p) => p.origin === 'positive').map((p) => p.id).sort()).toEqual(['found_the_voice', 'steadied_by_partner']);
  });

  it('give a telegraph of behavior in fifteen words or fewer, with a place, even for a long address', () => {
    for (const pack of Object.values(IMPRINT_PACKS)) {
      expect(pack.telegraph, pack.id).toContain('{place}');
      for (const place of ['Cedar Close', 'Blue Heron Grill', '214 Alder Street Annex Building']) {
        expect(wc(bindTelegraph(pack.telegraph, place)), `${pack.id} at ${place}`).toBeLessThanOrEqual(15);
      }
      expect(pack.telegraph, pack.id).not.toMatch(/\b(feels|felt|nervous|afraid|scared|traumat\w*)\b/i);
    }
  });

  it('give three fork options that each state a cost and a risk, none free on both and none alike', () => {
    for (const pack of Object.values(IMPRINT_PACKS)) {
      const options = Object.values(pack.fork);
      expect(options.map((o) => o.label)).toEqual(['Stand down', 'Peer support', 'Pair up']);
      for (const o of options) {
        expect(o.cost.length, `${pack.id} ${o.label} cost`).toBeGreaterThan(8);
        expect(o.risk.length, `${pack.id} ${o.label} risk`).toBeGreaterThan(8);
        expect(o.line, `${pack.id} ${o.label}`).toMatch(/costs|spends/);
        expect(wc(o.label)).toBeLessThanOrEqual(3);
      }
      expect(new Set(options.map((o) => o.cost)).size).toBe(3);
      expect(new Set(options.map((o) => o.risk)).size).toBe(3);
      // Rest is the only certain answer and the only one that costs the officer's own calls.
      expect(pack.fork.rest.cost).toMatch(/Off calls/);
      expect(pack.fork.pair.line).toContain('{partner}');
    }
  });

  it('pair every strain with a positive earned the same way, in condition lines under 60 characters', () => {
    for (const pack of Object.values(IMPRINT_PACKS)) {
      expect(pack.strain.id).not.toBe(pack.positive.id);
      for (const t of [pack.strain, pack.positive]) {
        expect(t.condition.length, t.id).toBeLessThanOrEqual(60);
        expect(t.condition, t.id).toMatch(/\.$/);
        expect(packTraitInfo(t.id)).toBe(t);
      }
      expect(pack.restHours).toBeLessThan(pack.hours);
      expect(pack.when.length).toBeGreaterThan(0);
    }
    // No pack's positive runs only through force or entry: the triggers for the road back never require them.
    const existing = Object.values(IMPRINT_PACKS).flatMap((p) => (p.positive.existing ? [p.positive.existing] : []));
    expect(existing.sort()).toEqual(['calm_voice', 'observant', 'steady']);
  });

  it('carry no number: nothing on a pack is a modifier', () => {
    for (const pack of Object.values(IMPRINT_PACKS)) {
      const keys = Object.keys(pack).sort();
      expect(keys).toEqual(['fork', 'hours', 'id', 'label', 'origin', 'peerHours', 'positive', 'restHours', 'scope', 'severe', 'strain', 'telegraph', 'when']);
    }
  });
});
