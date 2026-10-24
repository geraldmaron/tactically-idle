// Team's pure selectors (station rebuild): squad crest mapping, the scene's count line, tile status only when
// not ready, the qualification legend, a candidate's one standout, the officer's last recorded call,
// promotions that arrive while the screen is open, and what an empty command seat would do.
import { describe, expect, it } from 'vitest';
import { COMMAND_STAFF, MANAGERS } from '../../sim/command-staff';
import { makeState, NOW } from '../../sim/test-fixtures';
import type { DebriefResult, Officer } from '../../sim/types';
import { SQUAD_IDS } from '../../sim/types';
import {
  SQUAD_CREST, certLegend, hireTerms, lastActionLine, lastCallLine, lastCallOf, newPromotions, promotionLedger, promotionLine,
  rosterCounts, rosterLine, seatPreview, squadCrest, squadDetail, standoutLine, standoutRating, tileStatus,
} from './team-model';

const officers = (g = makeState()): Officer[] => Object.values(g.officers);

describe('squad crests', () => {
  it('maps each squad letter to its own crest file, one each', () => {
    expect(SQUAD_IDS.map(squadCrest)).toEqual(['art/crests/alpha.webp', 'art/crests/bravo.webp', 'art/crests/charlie.webp', 'art/crests/delta.webp']);
    expect(new Set(Object.values(SQUAD_CREST)).size).toBe(SQUAD_IDS.length);
  });
});

describe('the scene count line', () => {
  it('counts officers, ready, strained, away and the bench, and leaves zero counts out', () => {
    const g = makeState();
    const list = officers(g);
    list.forEach((o) => { o.stress = 0; o.injury = null; o.assignment = null; });
    expect(rosterLine(rosterCounts(list, NOW))).toBe(`${list.length} officers · ${list.length} ready`);
    list[0].stress = 40;
    list[1].assignment = { kind: 'training', courseId: 'composure_workshop', startedAt: NOW, endsAt: NOW + 1000 };
    list[2].squadId = null;
    const counts = rosterCounts(list, NOW);
    expect(counts).toMatchObject({ officers: list.length, strained: 1, away: 1, bench: 1 });
    expect(counts.ready).toBe(list.length - 2);
    expect(rosterLine(counts)).toBe(`${list.length} officers · ${list.length - 2} ready · 1 strained · 1 away · 1 on the bench`);
  });

  it('says one officer in the singular', () => {
    expect(rosterLine({ officers: 1, ready: 1, strained: 0, away: 0, bench: 0 })).toBe('1 officer · 1 ready');
  });
});

describe('tile status', () => {
  it('is null for a ready officer and names every other state', () => {
    const o = officers()[0];
    o.stress = 0; o.injury = null; o.assignment = null;
    expect(tileStatus(o, NOW)).toBeNull();
    o.stress = 40;
    expect(tileStatus(o, NOW)).toBe('strained');
    o.stress = 0; o.assignment = { kind: 'training', courseId: 'composure_workshop', startedAt: NOW, endsAt: NOW + 1000 };
    expect(tileStatus(o, NOW)).toBe('training');
    o.assignment = null; o.injury = { label: 'Sprain', until: NOW + 1000 };
    expect(tileStatus(o, NOW)).toBe('injured');
  });
});

describe('squad detail line', () => {
  it('says who is ready, who leads and how many places are open, or that the squad is on a call', () => {
    expect(squadDetail({ deployed: false, ready: 4, total: 4, members: 4, leader: 'Vale' })).toBe('All 4 ready · Vale leads');
    expect(squadDetail({ deployed: false, ready: 2, total: 3, members: 3, leader: null })).toBe('2 of 3 ready · 1 open place');
    expect(squadDetail({ deployed: false, ready: 0, total: 0, members: 0, leader: null })).toBe('0 of 0 ready · 4 open places');
    expect(squadDetail({ deployed: true, ready: 4, total: 4, members: 4, leader: 'Vale' })).toBe('On a call · Vale leads');
  });
});

describe('the qualification legend', () => {
  it('lists each certification held by anyone shown, once, by name', () => {
    const legend = certLegend([{ certs: ['entry_team', 'advanced_first_aid'] }, { certs: ['entry_team'] }, { certs: [] }]);
    expect(legend.map((entry) => entry.id).sort()).toEqual(['advanced_first_aid', 'entry_team']);
    expect(legend.every((entry) => entry.name.length > 0 && entry.icon)).toBe(true);
    expect(certLegend([{ certs: [] }])).toEqual([]);
  });
});

describe('a candidate dossier', () => {
  it('names the single strongest rating, then the first certification', () => {
    const o = officers()[0];
    o.ratings = { shooting: 40, composure: 50, communication: 78, awareness: 60, medical: 30, coordination: 55 };
    o.certs = [];
    expect(standoutRating(o)).toEqual({ key: 'communication', label: 'Communication', value: 78 });
    expect(standoutLine(o)).toBe('Communication 78');
    o.certs = ['crisis_negotiation'];
    expect(standoutLine(o)).toBe('Communication 78 · Crisis negotiation');
  });

  it('prints the wage and the signing cost as the terms', () => {
    expect(hireTerms({ signingCost: 1280, officer: { wage: 48 } })).toBe('48 funding an hour · 1,280 funding to sign');
  });
});

describe('the last recorded call', () => {
  const debrief = (officerId: string, extra: Partial<DebriefResult> = {}): DebriefResult => ({
    runId: 'run_1', scenarioId: 'barricade_wren_court', endingId: 'e', endingTitle: 'Everyone Safe',
    officerCondition: [{ officerId, stressBefore: 12, stressAfter: 21, xpGained: 40 }], ...extra,
  } as DebriefResult);

  it('finds the newest kept debrief this officer worked, with the stress and XP the game recorded', () => {
    const g = makeState();
    const [a, b] = officers(g);
    g.debriefs = [debrief(b.id, { runId: 'run_3' }), debrief(a.id, { runId: 'run_2', endingTitle: 'Partial Close' }), debrief(a.id, { runId: 'run_1' })];
    const call = lastCallOf(g, a.id, NOW)!;
    expect(call.runId).toBe('run_2');
    expect(call).toMatchObject({ ending: 'Partial Close', stressBefore: 12, stressAfter: 21, xpGained: 40 });
    expect(lastCallLine(call)).toBe(`Last call: ${call.title}, Partial Close. Stress 12 to 21. 40 XP.`);
  });

  it('is null when no kept debrief names the officer, and leaves out an unchanged stress or no XP', () => {
    const g = makeState();
    const [a] = officers(g);
    g.debriefs = [];
    expect(lastCallOf(g, a.id, NOW)).toBeNull();
    expect(lastCallLine({ runId: 'r', title: 'Wren Court', ending: 'Everyone Safe', stressBefore: 20, stressAfter: 20, xpGained: 0 })).toBe('Last call: Wren Court, Everyone Safe.');
  });
});

describe('promotions that land while Team is open', () => {
  const promo = (rank: 'officer' | 'corporal', cause = 'after Wren Court') => ({ rank, day: 5, cause });

  it('reports only promotions beyond what was seen, and never a new hire', () => {
    const before = promotionLedger({ a: { surname: 'Vale', promotions: [promo('officer')] }, b: { surname: 'Park', promotions: [] } });
    const after = promotionLedger({
      a: { surname: 'Vale', promotions: [promo('officer'), promo('corporal', 'after Barricade on Wren Court')] },
      b: { surname: 'Park', promotions: [] },
      c: { surname: 'Newhire', promotions: [promo('officer')] },
    });
    expect(newPromotions(before, after)).toEqual([{ officerId: 'a', surname: 'Vale', rank: 'corporal', cause: 'after Barricade on Wren Court' }]);
    expect(newPromotions(after, after)).toEqual([]);
  });

  it('says the rank and the cause the game recorded', () => {
    expect(promotionLine('corporal', 'after Barricade on Wren Court')).toBe('Corporal, after Barricade on Wren Court');
    expect(promotionLine('corporal', '  ')).toBe('Corporal');
  });
});

describe('an empty command seat', () => {
  it('says what the post would do now, from real state', () => {
    const g = makeState();
    const squad = g.squads[0];
    g.officers[squad.officerIds[0]].stress = COMMAND_STAFF.watchCommander.defaultRestAt + 1;
    expect(seatPreview(g, 'watch_commander', MANAGERS.watch_commander.duty)).toBe(`Would rest ${squad.name} now.`);
    g.department.trainingSlots = 2;
    expect(seatPreview(g, 'training_sergeant', MANAGERS.training_sergeant.duty)).toBe('Would fill 2 free training places.');
    g.department.rosterCap = Object.keys(g.officers).length + 1;
    expect(seatPreview(g, 'recruiter', MANAGERS.recruiter.duty)).toBe('Would sign for 1 open place on the roster.');
  });

  it('falls back to the first sentence of the post’s own duty text when nothing is waiting', () => {
    const g = makeState();
    officers(g).forEach((o) => { o.stress = 0; });
    const duty = MANAGERS.watch_commander.duty;
    expect(seatPreview(g, 'watch_commander', duty)).toBe(`${duty.split('. ')[0].replace(/\.$/, '')}.`);
    expect(seatPreview(g, 'quartermaster', MANAGERS.quartermaster.duty)).toBe(`${MANAGERS.quartermaster.duty.split('. ')[0]}.`);
  });

  it('shows a seated manager’s last logged action, or the line the game keeps', () => {
    expect(lastActionLine([{ at: NOW, text: 'Rested Bravo' }, { at: NOW - 1, text: 'Switched on' }], 'Waiting')).toBe('Rested Bravo');
    expect(lastActionLine([], 'Waiting for the next clock hour')).toBe('Waiting for the next clock hour');
  });
});
