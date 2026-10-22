// The depth register's optional fields (call-depth): a weighed choice's card is its title and cost,
// one tap to review; the cold open and "Who they are" render only when authored, and a
// call without them renders exactly as before.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { startGateRun } from '../../gen/incident/gates/engine-driver';
import { NOW } from '../../sim/test-fixtures';
import type { ActionView } from '../../sim/types';
import { DecisionList } from './DecisionList';
import { liveDecisions } from './live-model';
import { ColdOpen, WhoTheyAre } from '../components/DepthBrief';

const HOSTAGE = 'gen:hostage_crisis:market_row:3035903061:1492309763:1:13';
const plain = liveDecisions(startGateRun(HOSTAGE), NOW, 'A').map((a) => { const { weighing: _w, ...rest } = a; return rest as ActionView; });
const weighed: ActionView = { ...plain[0], id: 'weighed', eligible: true, summary: 'The full summary of the choice.',
  weighing: { pull: 'One person is out in two minutes.', cost: 'The owner stays alone with him.' } };
const noop = () => {};
const render = (actions: ActionView[]) => renderToStaticMarkup(createElement(DecisionList, { prompt: 'What now?', actions, selectedId: null, expanded: false, onSelect: noop, onExpand: noop }));

describe('weighed choices (choice-weighing)', () => {
  it('shows the title and the cost, keeps harm in view, and reviews from the one card button', () => {
    const html = render([weighed, ...plain.slice(1)]);
    expect(html).toContain('data-action-id="weighed"');
    expect(html).toContain('<span class="callbtn-cost">The owner stays alone with him.</span>');
    expect(html).not.toContain('The full summary of the choice.');
    expect(html).not.toContain('The pull:');
    expect(html).not.toContain('callbtn-expand');
    expect(html).not.toContain('callbtn-review');
    expect(html).toMatch(/<button type="button" class="callbtn callbtn-weighed" data-action-id="weighed" aria-pressed="false" aria-label="Review [^"]+"/);
    expect(html).toMatch(/callbtn-harm callbtn-harm-\w+">Harm \w+/);
  });

  it('leaves a choice without a pull and cost exactly as it was', () => {
    const before = render(plain);
    expect(before).not.toContain('callbtn-weighed');
    expect(before).not.toContain('callbtn-review');
    expect(before).toMatch(/<button type="button" class="callbtn[^"]*" data-action-id=/);
  });
});

describe('cold open and who they are (call-depth)', () => {
  it('sets the cold open as unclamped prose, and nothing without one', () => {
    const long = 'The corner store opens at seven. '.repeat(25).trim();
    const html = renderToStaticMarkup(createElement(ColdOpen, { text: long }));
    expect(html).toContain('aria-label="Before the call"');
    expect(html).toContain(long);
    expect(renderToStaticMarkup(createElement(ColdOpen, { text: undefined }))).toBe('');
  });

  it('lists each person by bound name with their history, and nothing without people', () => {
    const html = renderToStaticMarkup(createElement(WhoTheyAre, { people: [{ personId: 'owner', name: 'Kwame Yamaguchi', text: 'Bought the store eleven years ago.' }] }));
    expect(html).toContain('Who they are');
    expect(html).toContain('<strong>Kwame Yamaguchi</strong>');
    expect(html).toContain('Bought the store eleven years ago.');
    expect(renderToStaticMarkup(createElement(WhoTheyAre, { people: undefined }))).toBe('');
  });
});
