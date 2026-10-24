import { describe, expect, it } from 'vitest';
import { COURSES } from '../../../content/courses';
import { DEV_NODES } from '../../../content/dev-tree';
import { createInitialState } from '../../../sim/department';
import { budget, courseOptions, nodeOptions } from '../../../sim/department-selectors';
import { DEVELOP_HANDLERS } from '../../../sim/develop';
import { candidatePoolSize, recoveryRate } from '../../../sim/economy';
import type { GameState } from '../../../sim/types';
import { MANAGERS } from '../../../sim/command-staff';
import { garageView, nextDevelopment, nextForStation, nodeSummary, roomFaces, roomLines, roomViews, stepHelp, stepState, viewOfNode } from './room-model';
import { ROOMS } from './rooms';

const NOW = Date.UTC(2026, 9, 3, 12);
const fresh = (funding = 100_000): GameState => { const s = createInitialState(NOW, 1); s.department.funding = funding; return s; };
const buy = (s: GameState, id: string, tier = 1) => expect(DEVELOP_HANDLERS.unlockNode(s, id, tier)).toEqual({ ok: true });
const option = (s: GameState, id: string) => nodeOptions(s).find((o) => o.node.id === id)!;
const rate = (n: number) => `${Math.round(n * 10) / 10}/h`;

describe('rooms and their state', () => {
  it('gives every development branch exactly one room, and the garage none', () => {
    const branches = Object.values(DEV_NODES).map((n) => n.branch);
    for (const branch of new Set(branches)) expect(ROOMS.filter((r) => r.branch === branch)).toHaveLength(1);
    expect(ROOMS.filter((r) => !r.branch).map((r) => r.id)).toEqual(['garage']);
    const views = roomViews(fresh());
    expect(views.reduce((sum, v) => sum + v.total, 0)).toBe(Object.keys(DEV_NODES).length);
  });

  it('starts dark, goes ready when the next step is affordable and lit once something is built', () => {
    const rich = fresh();
    const views = roomViews(rich);
    expect(views.every((v) => !v.open)).toBe(true);
    expect(views.filter((v) => v.state === 'ready').length).toBeGreaterThan(0);
    const broke = fresh(0);
    expect(roomViews(broke).every((v) => v.state === 'dark')).toBe(true);
    expect(nextForStation(roomViews(broke))).toBeNull();
    buy(rich, 'wellbeing_peer_support');
    const after = roomViews(rich).find((v) => v.room.id === 'recovery')!;
    expect(after.open).toBe(true);
    expect(after.tiers).toBe(1);
    expect(after.tierTotal).toBe(3 + 1);
    rich.department.funding = 0;
    expect(roomViews(rich).find((v) => v.room.id === 'recovery')!.state).toBe('lit');
  });

  it('suggests the cheapest affordable first step, preferring a room that is still dark', () => {
    const s = fresh();
    const pick = nextForStation(roomViews(s))!;
    expect(pick.open).toBe(false);
    for (const v of roomViews(s).filter((x) => x.state === 'ready' && !x.open)) expect(pick.next!.quote.cost!.funding).toBeLessThanOrEqual(v.next!.quote.cost!.funding);
  });

  it('finds the room that owns a node, for links from Training, Armory and Command', () => {
    const views = roomViews(fresh());
    expect(viewOfNode(views, 'intel_drone')!.room.id).toBe('information');
    expect(viewOfNode(views, 'personnel_academy')!.room.id).toBe('personnel');
    expect(viewOfNode(views, 'nope')).toBeUndefined();
  });

  it('reads the garage from the patrol workforce and the level', () => {
    const g = garageView(fresh());
    expect(g.capacity).toBe(6);
    expect(g.next).toEqual({ level: 3, positions: 8 });
  });

  it('points at the cheapest open step and keeps the summary line short', () => {
    const s = fresh();
    const next = nextDevelopment(nodeOptions(s))!;
    expect(next.quote.ok).toBe(true);
    expect(nodeSummary(option(s, 'intel_drone'))).toMatch(/^Unlocks Camera drone/);
    expect(stepState(option(s, 'intel_drone'))).toBe('locked');
  });
});

describe('who a step helps, checked against what the purchase delivers', () => {
  it('recovery: the rate promised to each officer is the rate they get', () => {
    const s = fresh();
    Object.values(s.officers).forEach((o, i) => { o.stress = 20 + i * 9; });
    const help = stepHelp(s, option(s, 'wellbeing_peer_support'));
    expect(help.rows.length).toBe(3);
    const stressed = Object.values(s.officers).sort((a, b) => b.stress - a.stress).slice(0, 3).map((o) => o.id);
    expect(help.rows.map((r) => r.officerIds[0])).toEqual(stressed);
    buy(s, 'wellbeing_peer_support');
    for (const row of help.rows) expect(row.to).toBe(rate(recoveryRate(s, s.officers[row.officerIds[0]])));
    for (const row of help.rows) expect(row.from).not.toBe(row.to);
  });

  it('recovery: a later tier is judged against the tier already owned', () => {
    const s = fresh();
    buy(s, 'wellbeing_peer_support');
    Object.values(s.officers).forEach((o) => { o.stress = 55; });
    const help = stepHelp(s, option(s, 'wellbeing_peer_support'));
    const before = Object.fromEntries(help.rows.map((r) => [r.officerIds[0], rate(recoveryRate(s, s.officers[r.officerIds[0]]))]));
    for (const row of help.rows) expect(row.from).toBe(before[row.officerIds[0]]);
    buy(s, 'wellbeing_peer_support', 2);
    for (const row of help.rows) expect(row.to).toBe(rate(recoveryRate(s, s.officers[row.officerIds[0]])));
  });

  it('recovery: names the time back to Ready from the same rate, shorter after', () => {
    const s = fresh();
    Object.values(s.officers).forEach((o) => { o.stress = 66; });
    const row = stepHelp(s, option(s, 'wellbeing_peer_support')).rows[0];
    expect(row.note).toMatch(/^Back to Ready in .+, not .+$/);
  });

  it('training places: the places promised are the places bought, tier by tier', () => {
    const s = fresh();
    const first = stepHelp(s, option(s, 'personnel_academy')).rows[0];
    expect([first.from, first.to]).toEqual(['1', '2']);
    buy(s, 'personnel_academy');
    expect(String(s.department.trainingSlots)).toBe(first.to);
    const second = stepHelp(s, option(s, 'personnel_academy')).rows[0];
    expect([second.from, second.to]).toEqual(['2', '3']);
    buy(s, 'personnel_academy', 2);
    expect(String(s.department.trainingSlots)).toBe(second.to);
  });

  it('roster places and candidates: the free places and the pool match the purchase', () => {
    const s = fresh();
    const rows = stepHelp(s, option(s, 'personnel_recruiting')).rows;
    const places = rows.find((r) => r.key === 'roster-places')!;
    const pool = rows.find((r) => r.key === 'candidate-pool')!;
    buy(s, 'personnel_recruiting');
    expect(String(s.department.rosterCap - Object.keys(s.officers).length)).toBe(places.to);
    expect(String(candidatePoolSize(s))).toBe(pool.to);
  });

  it('records fees: the hourly figure is the node income the budget reports', () => {
    const s = fresh();
    const before = budget(s).nodeIncome;
    const row = stepHelp(s, option(s, 'intel_records')).rows[0];
    expect(row.from).toBe(`${before}/h`);
    buy(s, 'intel_records');
    expect(row.to).toBe(`${budget(s).nodeIncome}/h`);
  });

  it('courses: counts the officers the course check lets enrol, and shows their faces', () => {
    const t = fresh();
    const rows = stepHelp(t, option(t, 'personnel_negotiation')).rows;
    expect(rows).toHaveLength(2);
    buy(t, 'personnel_negotiation');
    for (const row of rows) {
      const course = Object.values(COURSES).find((c) => c.name === row.label)!;
      const eligible = Object.values(t.officers).filter((o) => courseOptions(t, o.id, NOW).find((c) => c.course.id === course.id)!.available);
      expect(row.to).toBe(`${eligible.length} ${eligible.length === 1 ? 'officer' : 'officers'} can enrol`);
      expect(row.officerIds.length).toBe(Math.min(3, eligible.length));
    }
  });

  it('kit: says plainly when nobody is qualified yet instead of inventing a face', () => {
    const s = fresh();
    Object.values(s.officers).forEach((o) => { o.certs = []; });
    const row = stepHelp(s, option(s, 'field_contact_kit')).rows[0];
    expect(row.to).toBe('0 officers qualified');
    expect(row.officerIds).toEqual([]);
    expect(row.reaction).toMatch(/^Nobody holds the qualification/);
  });

  it('every step in the tree describes itself, and a bought step has no rows', () => {
    const s = fresh();
    for (const o of nodeOptions(s)) {
      const help = stepHelp(s, o);
      expect(help.effect.length).toBeGreaterThan(0);
      expect(help.rows.length).toBeGreaterThan(0);
      for (const row of help.rows) { expect(row.reaction).not.toMatch(/undefined|NaN|—|–/); expect(row.from).not.toMatch(/NaN|undefined/); expect(row.to).not.toMatch(/NaN|undefined/); }
    }
    buy(s, 'field_contact_kit');
    expect(stepHelp(s, option(s, 'field_contact_kit')).rows).toEqual([]);
  });

  it('room faces come from the next step, and are real officers or candidates in the save', () => {
    const s = fresh();
    const views = roomViews(s);
    const known = new Set([...Object.keys(s.officers), ...s.candidates.map((c) => c.officer.id)]);
    for (const v of views) for (const id of roomFaces(s, v)) expect(known.has(id)).toBe(true);
  });
});

describe('saying a post once', () => {
  it('names a command post only in its step title, not in the effect or the who-it-helps row', () => {
    const s = fresh();
    for (const o of nodeOptions(s)) {
      const post = (o.node.tiers?.flatMap((t) => t.effects) ?? o.node.effects).find((e) => e.kind === 'commandStaff');
      if (!post || post.kind !== 'commandStaff') continue;
      const title = MANAGERS[post.managerId].title.toLowerCase();
      const help = stepHelp(s, o);
      expect(help.effect.toLowerCase()).not.toContain(title);
      for (const row of help.rows) expect(`${row.label} ${row.note ?? ''}`.toLowerCase()).not.toContain(title);
    }
  });
});

describe('room card lines', () => {
  it('opens on what the room is for, then one recorded fact per person it helps, each short enough for two lines', () => {
    const s = fresh();
    for (const view of roomViews(s)) {
      const lines = roomLines(s, view, NOW);
      expect(lines[0]).toBe(view.room.line);
      const faces = roomFaces(s, view);
      expect(lines.length).toBeLessThanOrEqual(1 + faces.length);
      for (const line of lines.slice(1)) {
        expect(line.length).toBeLessThanOrEqual(62);
        expect(faces.some((id) => line.startsWith(`${s.officers[id].surname}. `))).toBe(true);
        expect(line).not.toMatch(/[—–]| - /);
      }
    }
  });
});
