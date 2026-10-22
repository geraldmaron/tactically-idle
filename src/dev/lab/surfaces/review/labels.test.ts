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
    expect(rowLabel('going_live.prompt', bound, hostage.tree)).toBe('Going live · prompt');
    expect(rowLabel('on_air.promptIf[0]', bound, hostage.tree)).toBe('On air · prompt variant 1');
    expect(rowLabel('going_live.on_stream.preview.adverse', bound, hostage.tree)).toBe(`Going live › ${bound.choice('going_live', 'on_stream')} · preview, goes badly`);
    expect(rowLabel('going_live.on_stream.mixed[0]@s2', bound, hostage.tree)).toBe(`Going live › ${bound.choice('going_live', 'on_stream')} · complications, line 1 (situation 2)`);
    expect(rowLabel('ending.handed_over.task[0]', bound, hostage.tree)).toMatch(/^Ending · .+ · still needed 1$/);
  });

  it('binds titles for the call in focus, and falls back to role nouns', () => {
    expect(bound.choice('going_live', 'on_stream')).not.toMatch(/[{}]/);
    expect(plain.choice('going_live', 'clerk_out')).toMatch(/clerk/i);
    expect(plain.choice('going_live', 'clerk_out')).not.toMatch(/[{}]/);
  });

  it('says what a note is about', () => {
    const deps = dependencyIndex(hostage);
    expect(anchorLabel('call', bound, hostage.tree, deps)).toBe('The whole call');
    expect(anchorLabel('choice:going_live/on_stream', bound, hostage.tree, deps)).toBe(`Going live › ${bound.choice('going_live', 'on_stream')}`);
    expect(anchorLabel('band:going_live/on_stream/mixed', bound, hostage.tree, deps)).toMatch(/· complications$/);
    expect(anchorLabel('key:mark:turned', bound, hostage.tree, deps)).toBe('The delivery courier turned the handgun on the night manager');
    expect(anchorLabel('string:going_live.prompt', bound, hostage.tree, deps)).toBe('Going live · prompt');
  });

  it('quotes what the player reads, with the lead officer marked', () => {
    const sees = anchorSees('choice:going_live/on_stream', bound, hostage.tree);
    expect(sees).toContain(' / ');
    expect(sees).toContain('[lead officer]');
    expect(sees).not.toMatch(/\{/);
    expect(anchorSees('string:going_live.on_stream.preview.mixed', bound, hostage.tree)).toBe(sessionBinder(opened)(hostage.tree.nodes[0].choices[0].preview.mixed));
  });
});
