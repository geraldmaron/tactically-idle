// Names a reader recognizes: string rows by where the player meets them, anchors in words, and what
// the player reads at an anchor, bound for the call in focus.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import { dependencyIndex } from '../../../../gen/incident/trees-v13/dependencies';
import { openSession, sessionBinder } from '../../model/session';
import { parseLabUrl } from '../../url';
import { anchorLabel, anchorSees, callNames, rowLabel } from './labels';

const hostage = INCIDENT_TEMPLATES.hostage_crisis as IncidentTemplate;
const opened = openSession(parseLabUrl('?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1').url, null);
if (!('frames' in opened)) throw new Error(opened.message);
const bound = callNames(hostage, sessionBinder(opened));
const plain = callNames(hostage, null);

describe('labels', () => {
  it('names string rows by where the player meets them', () => {
    expect(rowLabel('card.summary', bound, hostage.tree)).toBe('Call card · hook');
    expect(rowLabel('briefing.known[1]', bound, hostage.tree)).toBe('Briefing · known 2');
    expect(rowLabel('offer.prompt', bound, hostage.tree)).toBe('Offer · prompt');
    expect(rowLabel('talking.promptIf[0]', bound, hostage.tree)).toBe('Talking · prompt variant 1');
    expect(rowLabel('offer.take_courier.preview.adverse', bound, hostage.tree)).toBe(`Offer › ${bound.choice('offer', 'take_courier')} · preview, goes badly`);
    expect(rowLabel('offer.take_courier.mixed[0]@s2', bound, hostage.tree)).toBe(`Offer › ${bound.choice('offer', 'take_courier')} · complications, line 1 (situation 2)`);
    expect(rowLabel('ending.handed_over.task[0]', bound, hostage.tree)).toMatch(/^Ending · .+ · still needed 1$/);
  });

  it('binds titles for the call in focus, and falls back to role nouns', () => {
    expect(bound.choice('offer', 'take_courier')).not.toMatch(/[{}]/);
    expect(plain.choice('offer', 'take_courier')).toMatch(/courier/i);
    expect(plain.choice('offer', 'take_courier')).not.toMatch(/[{}]/);
  });

  it('says what a note is about', () => {
    const deps = dependencyIndex(hostage);
    expect(anchorLabel('call', bound, hostage.tree, deps)).toBe('The whole call');
    expect(anchorLabel('choice:offer/take_courier', bound, hostage.tree, deps)).toBe(`Offer › ${bound.choice('offer', 'take_courier')}`);
    expect(anchorLabel('band:offer/take_courier/mixed', bound, hostage.tree, deps)).toMatch(/· complications$/);
    expect(anchorLabel('key:mark:turned', bound, hostage.tree, deps)).toBe('The former employee turned the handgun on the owner');
    expect(anchorLabel('string:offer.prompt', bound, hostage.tree, deps)).toBe('Offer · prompt');
  });

  it('quotes what the player reads, with the lead officer marked', () => {
    const sees = anchorSees('choice:offer/take_courier', bound, hostage.tree);
    expect(sees).toContain(' / ');
    expect(sees).toContain('[lead officer]');
    expect(sees).not.toMatch(/\{/);
    expect(anchorSees('string:offer.take_courier.preview.mixed', bound, hostage.tree)).toBe(sessionBinder(opened)(hostage.tree.nodes[0].choices[0].preview.mixed));
  });
});
