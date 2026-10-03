import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SquadArrangementPreview } from '../../sim/squad-optimizer';
import type { HandlerResult } from '../../sim/types';
import { makeState } from '../../sim/test-fixtures';
import { SquadArrangementReview, SquadOptimizer } from './SquadOptimizer';

let state = makeState();
const calls = vi.hoisted(() => ({ act: vi.fn(), plan: vi.fn(), getState: vi.fn() }));
let saved: { officerLocks: string[]; squadLocks: string[]; undo?: unknown };
let undoResult: HandlerResult;
let campaign = { campaignId: 'campaign-one', session: 1 };
vi.mock('../store', () => ({ useGame: () => state, getState: calls.getState, useCampaigns: () => campaign, getCampaignSnapshot: () => campaign }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: calls.act }) }));
vi.mock('../../sim/squad-optimizer', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../sim/squad-optimizer')>(),
  planSquadArrangement: calls.plan,
  squadArrangementState: () => saved,
  squadArrangementToken: () => 'current-roster',
  undoSquadArrangementCheck: () => undoResult,
}));
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children, footer) : null }));

function preview(): SquadArrangementPreview {
  const before = state.squads.map((squad) => ({
    squadId: squad.id, officerIds: [...squad.officerIds], leaderId: squad.leaderId,
    fresh: 4, deployable: 4, unavailable: 0, coverage: ['Medical response', 'Entry team'], gaps: ['Crisis negotiation'], mentoring: ['Mentor supports a rookie'],
  }));
  const after = structuredClone(before);
  after[0].officerIds = before[0].officerIds.map((id) => id === 'off_vale' ? 'off_lindqvist' : id);
  after[1].officerIds = before[1].officerIds.map((id) => id === 'off_lindqvist' ? 'off_vale' : id);
  after[1].fresh = 3;
  after[1].deployable = 3;
  after[1].unavailable = 1;
  return {
    proposal: { token: 'current-roster', options: { squadIds: ['A', 'B'], includeUnassigned: false, preserveLeaders: true }, before: { squads: before, unassignedIds: [] }, after: { squads: after, unassignedIds: [] } },
    reason: null, before, after, scoreBefore: 10, scoreAfter: 12,
    moves: [
      { officerId: 'off_vale', from: 'A', to: 'B', reasons: ['Adds surveillance coverage'], dutyImpact: 'Patrol to rest; routine funding and recovery change.' },
      { officerId: 'off_lindqvist', from: 'B', to: 'A', reasons: ['Adds drone operator certification'], dutyImpact: null },
    ],
    protected: [{ officerId: 'off_chen', reason: 'Current leader is preserved' }],
  };
}

beforeEach(() => {
  state = makeState();
  saved = { officerLocks: [], squadLocks: [] };
  undoResult = { ok: true };
  campaign = { campaignId: 'campaign-one', session: 1 };
  vi.clearAllMocks();
});

describe('squad arrangement review', () => {
  it('shows explicit controls without automatically planning or changing the roster', () => {
    const html = renderToStaticMarkup(createElement(SquadOptimizer, { open: true, onClose: () => {} }));
    expect(html).toContain('Arrange squads');
    expect(html).toContain('Preserve current leaders');
    expect(html).toContain('Include unassigned officers');
    expect(html).toContain('Preview arrangement');
    expect(html).toMatch(/disabled="">Apply arrangement/);
    expect(html).toContain('Previewing does not change the roster');
    expect(calls.plan).not.toHaveBeenCalled();
    expect(calls.act).not.toHaveBeenCalled();
    expect(calls.getState).not.toHaveBeenCalled();
  });

  it('reads locks and the undo point from saved state on each reopened sheet', () => {
    saved = { officerLocks: ['off_vale'], squadLocks: ['B'], undo: preview().proposal };
    const first = renderToStaticMarkup(createElement(SquadOptimizer, { open: true, onClose: () => {} }));
    expect(first).toContain('aria-label="Unlock Noor Vale" aria-pressed="true"');
    expect(first).toContain('aria-label="Unlock squad B, Bravo" aria-pressed="true"');
    expect(first).toContain('1 saved');
    expect(first).not.toContain('disabled="">Undo last arrangement');
    const second = renderToStaticMarkup(createElement(SquadOptimizer, { open: true, onClose: () => {} }));
    expect(second).toEqual(first);
  });

  it('excludes the whole squad when a member has an operation assignment without an active run', () => {
    state.activeRun = null;
    state.officers.off_vale.assignment = { kind: 'operation', runId: 'away-run' };
    const html = renderToStaticMarkup(createElement(SquadOptimizer, { open: true, onClose: () => {} }));
    const alpha = html.match(/<input[^>]*aria-label="Include squad A, Alpha"[^>]*>/)?.[0];
    const bravo = html.match(/<input[^>]*aria-label="Include squad B, Bravo"[^>]*>/)?.[0];
    expect(alpha).toContain('disabled=""');
    expect(alpha).not.toContain('checked=""');
    expect(bravo).not.toContain('disabled=""');
    expect(bravo).toContain('checked=""');
    expect(html).toContain('Deployed, stays fixed');
  });

  it('keeps the undo control visible with the current reason when restoring would be unsafe', () => {
    saved.undo = preview().proposal;
    undoResult = { ok: false, reason: 'A moved officer is now deployed' };
    const html = renderToStaticMarkup(createElement(SquadOptimizer, { open: true, onClose: () => {} }));
    expect(html).toContain('disabled="">Undo last arrangement');
    expect(html).toContain('A moved officer is now deployed');
  });

  it('renders names, leadership, readiness, coverage, mentoring, exclusions and duty consequences without mutation', () => {
    const result = preview();
    const beforeState = structuredClone(state);
    const beforeResult = structuredClone(result);
    const html = renderToStaticMarkup(createElement(SquadArrangementReview, { state, preview: result }));
    for (const text of ['Before', 'After', 'Mara Chen', 'Noor Vale', 'Eli Lindqvist', 'Leader:', 'fresh', 'deployable', 'unavailable', 'Coverage:', 'Gaps:', 'Mentoring:', 'Crisis negotiation', 'Adds surveillance coverage', 'Patrol to rest', 'Current leader is preserved', 'Unassigned officers', 'No change to this officer']) expect(html).toContain(text);
    expect(state).toEqual(beforeState);
    expect(result).toEqual(beforeResult);
    expect(calls.act).not.toHaveBeenCalled();
  });

  it('marks stale results and empty proposals clearly', () => {
    const result = preview();
    result.proposal = null;
    result.moves = [];
    result.reason = 'No useful arrangement found within these locks';
    const html = renderToStaticMarkup(createElement(SquadArrangementReview, { state, preview: result, stale: true }));
    expect(html).toContain('Needs a new preview');
    expect(html).toContain('No useful arrangement found within these locks');
    expect(html).toContain('No officer moves are proposed');
  });

  it('calls out leadership changes even when no officer changes squads', () => {
    const result = preview();
    result.moves = [];
    result.after = structuredClone(result.before);
    result.after[0].leaderId = 'off_brooks';
    const html = renderToStaticMarkup(createElement(SquadArrangementReview, { state, preview: result }));
    expect(html).toContain('0 proposed officer moves · 1 leader change');
    expect(html).toContain('Proposed leader changes');
    expect(html).toContain('Mara Chen → Dale Brooks');
  });
});
