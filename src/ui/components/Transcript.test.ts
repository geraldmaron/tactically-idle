// The depth surfaces render where the writers expect them: spoken lines under the stage prompt, a
// lie marked apart from command's approvals, and nothing at all when a call authors none.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { startGateRun } from '../../gen/incident/gates/engine-driver';
import { NOW } from '../../sim/test-fixtures';
import { DecisionList } from '../screens/DecisionList';
import { liveDecisions } from '../screens/live-model';
import { Transcript } from './Transcript';

const HOSTAGE = 'gen:hostage_crisis:market_row:3035903061:1492309763:1:13';
const real = liveDecisions(startGateRun(HOSTAGE), NOW, 'A');
const noop = () => {};
const LINES = [
  { speaker: 'Desmond', line: 'You don’t get to ask about my last day.' },
  { speaker: 'Desmond', line: 'Six years on that till.' },
  { speaker: 'Negotiator', line: 'Six years. Tell me about the last one.' },
];

describe('Transcript', () => {
  it('lays out each speaker beside the line, with no colons or quotation marks added', () => {
    const html = renderToStaticMarkup(createElement(Transcript, { lines: LINES }));
    expect(html.match(/class="transcript-row/g)).toHaveLength(3);
    expect(html).toContain('transcript-negotiator');
    // A speaker who keeps talking keeps one visible name, and screen readers still hear who it is.
    expect(html).toContain('transcript-repeat');
    expect(html).toContain('<span class="sr-only">Desmond. </span>');
    expect(html).not.toMatch(/Desmond:|“|"You/);
  });

  it('renders nothing when a call authors no spoken lines', () => {
    expect(renderToStaticMarkup(createElement(Transcript, { lines: [] }))).toBe('');
    expect(renderToStaticMarkup(createElement(Transcript, {}))).toBe('');
  });

  it('puts the exchange under the stage prompt and marks a lie apart from command approval', () => {
    const lie = { ...real[0], eligible: true, deceives: true as const };
    const html = renderToStaticMarkup(createElement(DecisionList, { prompt: 'What now?', exchange: LINES, actions: [lie], selectedId: null, expanded: false, onSelect: noop, onExpand: noop }));
    expect(html.indexOf('operation-stage-prompt')).toBeLessThan(html.indexOf('class="transcript"'));
    expect(html.indexOf('class="transcript"')).toBeLessThan(html.indexOf('class="callbtn'));
    expect(html).toContain('callbtn-deceive');
    expect(html).toContain('Command hasn’t approved this');
  });
});
