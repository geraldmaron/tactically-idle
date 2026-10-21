// The live call's pressure pieces (pressure engine, 2026-10-20): who leads each choice and their number
// for it, the decision point's threat on the cards and in the pinned call bar, and the review sheet's lead
// swap. The swap previews what decide would commit, and the commit carries the pick.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { startGateRun } from '../../gen/incident/gates/engine-driver';
import { previewAction } from '../../sim/operation-selectors';
import { apply, NOW } from '../../sim/test-fixtures';
import type { ActionView, GameState } from '../../sim/types';
import { DecisionList, leadLine, threatTag } from './DecisionList';
import { LeadPicker, ThreatPill } from './LiveView';
import { liveDecisions, liveScreen, type LiveUiState } from './live-model';
import { pickLead } from './operation-squads';

const HOSTAGE = 'gen:hostage_crisis:market_row:3035903061:1492309763:1:13';
const hostage = startGateRun(HOSTAGE);
/** A real available choice with more than one officer taking part, so there is someone to swap in. */
const shared = liveDecisions(hostage, NOW, 'A').find((a) => a.eligible && a.officerIds.length > 1)!;
const reviewing = (g: GameState, a: ActionView, lead?: string): LiveUiState => ({
  focusId: 'A', selection: { runId: g.activeRun!.id, stage: g.activeRun!.stage as never, actionId: a.id },
  override: { actionId: a.id, acting: ['A'], support: [], ...(lead ? { lead } : {}) }, floor: 0,
});

describe('pickLead', () => {
  it('takes anyone taking part, clears on the best fit and ignores anyone else', () => {
    expect(pickLead(['a', 'b', 'c'], 'a', undefined, 'b')).toBe('b');
    expect(pickLead(['b', 'a', 'c'], 'a', 'b', 'a')).toBeUndefined();
    expect(pickLead(['a', 'b'], 'a', 'b', 'z')).toBe('b');
  });
});

describe('choice cards', () => {
  it('says too slow when a good result still lets the threat land, and risk when only a worse one does', () => {
    expect(threatTag({ threat: { label: 'The count reaches zero', bands: ['favorable', 'mixed', 'adverse'] } })).toEqual({ kind: 'slow', text: 'Too slow: The count reaches zero' });
    expect(threatTag({ threat: { label: 'The count reaches zero', bands: ['adverse'] } })).toEqual({ kind: 'risk', text: 'Risk: The count reaches zero' });
    expect(threatTag({ threat: { label: 'The count reaches zero', bands: [] } })).toBeNull();
    expect(threatTag({})).toBeNull();
  });

  it('shows the lead and their number for the rating the choice leans on most', () => {
    expect(shared.keyRating).toBeDefined();
    const lead = hostage.officers[shared.officerIds[0]];
    const line = leadLine(shared, hostage.officers)!;
    expect(line.officer.id).toBe(lead.id);
    expect(line.text).toMatch(new RegExp(`^${lead.surname} · \\w+ ${Math.round(lead.ratings[shared.keyRating!])}$`));
    expect(leadLine(shared, undefined)).toBeNull();
  });

  it('renders the lead line on real cards, and colours the minutes instead of tagging the threat', () => {
    const slow = { ...shared, id: 'slow', threat: { label: 'He stops answering', bands: ['favorable', 'mixed', 'adverse'] as const } } as ActionView;
    const risk = { ...shared, id: 'risk', weighing: undefined, threat: { label: 'He stops answering', bands: ['adverse'] as const } } as ActionView;
    const html = renderToStaticMarkup(createElement(DecisionList, { prompt: 'What now?', actions: [slow, risk], selectedId: null, expanded: false, officers: hostage.officers, onSelect: () => {}, onExpand: () => {} }));
    // The strip's bar is the threat's one display (owner, 2026-10-20): no tag repeats it on a card.
    expect(html).not.toContain('callbtn-threat');
    expect(html).toContain('callbtn-time callbtn-time-slow');
    expect(html).toContain('callbtn-time callbtn-time-risk');
    expect(html.match(/class="callbtn-lead"/g)).toHaveLength(2);
    // The face is a span, so it can sit inside the card's button.
    expect(html).not.toMatch(/<button[^>]*class="callbtn[^"]*"[^>]*>(?:(?!<\/button>).)*<div/);
  });

  it('shows the threat as one still line: label and minutes', () => {
    const html = renderToStaticMarkup(createElement(ThreatPill, { label: 'The count reaches zero', minutes: 6 }));
    expect(html.replace(/<[^>]+>/g, '')).toBe('The count reaches zero·\u20076 min');
    expect(html).toContain('aria-label="Threat: The count reaches zero in 6 minutes"');
  });
});

describe('who leads (live-model)', () => {
  it('defaults to the engine best fit with no pick to send', () => {
    const { review } = liveScreen(hostage, NOW, reviewing(hostage, shared))!;
    expect(review.lead).toBe(shared.officerIds[0]);
    expect(review.bestFit).toBe(shared.officerIds[0]);
    expect(review.leadOfficerId).toBeUndefined();
  });

  it('previews a swapped lead as decide would commit it, and the commit carries the pick', () => {
    const pick = shared.officerIds[1];
    const { review } = liveScreen(hostage, NOW, reviewing(hostage, shared, pick))!;
    expect(review.lead).toBe(pick);
    expect(review.leadOfficerId).toBe(pick);
    expect(review.bestFit).toBe(shared.officerIds[0]);
    expect(review.view).toEqual(previewAction(hostage, NOW, shared.id, ['A'], [], pick));
    expect(review.view!.officerIds[0]).toBe(pick);
    expect(review.leadMarks.some((mark) => mark.startsWith('band_'))).toBe(true);
    const done = apply(hostage, { type: 'decide', actionId: shared.id, actingSquadIds: ['A'], supportSquadIds: [], leadOfficerId: review.leadOfficerId });
    expect(done.state.activeRun!.history.at(-1)!.officerIds[0]).toBe(pick);
  });

  it('falls back to the best fit when the pick is not taking part, so the sheet and the commit agree', () => {
    const outsider = Object.keys(hostage.officers).find((id) => !shared.officerIds.includes(id))!;
    const { review } = liveScreen(hostage, NOW, reviewing(hostage, shared, outsider))!;
    expect(review.lead).toBe(shared.officerIds[0]);
    expect(review.leadOfficerId).toBeUndefined();
  });
});

describe('LeadPicker', () => {
  const render = (lead: string, marks: string[] = [], reads?: string[]) => renderToStaticMarkup(createElement(LeadPicker, {
    view: { ...shared, officerIds: lead === shared.officerIds[0] ? shared.officerIds : [lead, ...shared.officerIds.filter((id) => id !== lead)], ...(reads ? { leadReads: reads } : {}) },
    officers: hostage.officers, lead, bestFit: shared.officerIds[0], marks, onPick: () => {},
  }));

  it('offers one face per officer taking part, marks the lead and the best fit, and warns of the strain', () => {
    const pick = shared.officerIds[1];
    const html = render(pick);
    expect(html.match(/role="radio"/g)).toHaveLength(shared.officerIds.length);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toContain('Best fit');
    expect(html.replace(/<[^>]+>/g, '')).toContain(`${hostage.officers[pick].surname} leads: carries more strain.`);
  });

  it('shows which lead traits the results read, and whether this lead brings them', () => {
    const html = render(shared.officerIds[0], ['calm_voice', 'band_seasoned'], ['calm_voice', 'rookie']);
    expect(html).toContain('Results here turn on who leads.');
    expect(html).toMatch(/chip-mint[^>]*>.*Calm voice/);
    expect(html).toMatch(/Rookie/);
    expect(render(shared.officerIds[0])).not.toContain('Results here turn on who leads.');
  });
});
