// The officer tile (station rebuild, people first): a portrait with the surname and role, a status flag only when
// not ready, and one personal line that turns over with turnedLine and holds still under reduced motion.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PERSONAS } from '../../content/personas';
import { makeState, NOW } from '../../sim/test-fixtures';
import type { Officer } from '../../sim/types';
import { rotation, STORY_TURN_MS } from '../people/story-line';
import { officerFaceStatus } from './face-status';
import { OfficerTile } from './OfficerTile';

let reduced = false;
vi.mock('../motion', () => ({ useReducedMotion: () => reduced, reducedMotion: () => reduced, REDUCED_MOTION_QUERY: '(prefers-reduced-motion: reduce)' }));

const setup = () => {
  const g = makeState();
  const officer: Officer = Object.values(g.officers)[0];
  officer.identityId = PERSONAS[3].id; officer.traits = []; officer.promotions = []; officer.injury = null; officer.assignment = null; officer.stress = 0; officer.career.operations = 7;
  return { g, officer };
};
const tile = (officer: Officer, g: ReturnType<typeof makeState>, now = NOW) =>
  renderToStaticMarkup(createElement(OfficerTile, { officer, now, faceStatus: officerFaceStatus(g, officer.id, now) }));
const lineOf = (html: string) => /class="otile-line-text">([^<]*)</.exec(html)?.[1] ?? '';

afterEach(() => { reduced = false; vi.useRealTimers(); });

describe('OfficerTile personal line', () => {
  // The tile is compact (canvas Team, 2026-10-24): it draws no personal line. The highest-priority recorded line is
  // spoken in its label and the full set is in the officer's sheet; the turn-over lives in story-line.test.ts.
  it.each([true, false])('draws no line on the tile and speaks the first recorded line in its label, still over time (reduced motion %s)', (still) => {
    reduced = still;
    vi.useFakeTimers();
    const { g, officer } = setup();
    const lines = rotation({ kind: 'officer', officer, status: officerFaceStatus(g, officer.id, NOW) }, NOW);
    expect(lines.length).toBeGreaterThan(1);
    const labels = new Set<string>();
    for (let turn = 0; turn < 6; turn++) {
      vi.setSystemTime(NOW + turn * STORY_TURN_MS);
      const html = tile(officer, g, Date.now());
      expect(lineOf(html)).toBe('');
      expect(html).not.toContain('otile-line');
      labels.add(/aria-label="([^"]*)"/.exec(html)![1]);
    }
    expect(labels.size).toBe(1);
    expect([...labels][0]).toContain(lines[0].text.replace(/'/g, '&#x27;'));
  });
});

describe('OfficerTile spoken name', () => {
  it('carries the fixed first line and does not change as the visible line turns over', () => {
    vi.useFakeTimers();
    const { g, officer } = setup();
    const labels = new Set<string>();
    for (let turn = 0; turn < 4; turn++) {
      vi.setSystemTime(NOW + turn * STORY_TURN_MS);
      labels.add(/aria-label="([^"]*)"/.exec(tile(officer, g, Date.now()))![1]);
    }
    expect(labels.size).toBe(1);
    const first = rotation({ kind: 'officer', officer, status: officerFaceStatus(g, officer.id, NOW) }, NOW)[0].text;
    expect([...labels][0]).toContain(first.replace(/'/g, '&#x27;'));
  });
});

describe('OfficerTile status', () => {
  it('has no status flag for a ready officer, and flags a strained or injured one', () => {
    const { g, officer } = setup();
    expect(tile(officer, g)).not.toContain('otile-flag');
    officer.stress = 40;
    expect(tile(officer, g)).toContain('otile-flag');
    expect(tile(officer, g)).toContain('Strained');
    officer.stress = 0; officer.injury = { label: 'Sprain', until: NOW + 3_600_000 };
    expect(tile(officer, g)).toContain('Injured');
  });

  it('says the officer’s condition, rank and qualifications aloud, and marks a squad leader', () => {
    const { g, officer } = setup();
    officer.certs = ['entry_team'];
    const html = renderToStaticMarkup(createElement(OfficerTile, { officer, now: NOW, leader: true, faceStatus: null }));
    expect(html).toContain(`aria-label="${officer.firstName} ${officer.surname}`);
    expect(html).toContain('squad leader');
    expect(html).toContain('Entry team');
    expect(html).toContain('otile-lead');
    expect(html).toContain('% to ');
    void g;
  });
});
