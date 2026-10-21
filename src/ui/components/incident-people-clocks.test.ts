import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { generateIncident } from '../../gen/incident';
import { specForSituation } from '../../gen/incident/gates/catalog';
import { applyMove, startGateRun } from '../../gen/incident/gates/engine-driver';
import { choiceActionId } from '../../gen/incident/trees-v13/compile';
import { getScenario } from '../../sim/scenario-registry';
import type { GameState } from '../../sim/types';
import { IncidentPeopleStatus } from './IncidentPeople';

// The player sees a subject's stance and a clock only once the team has heard from them: nothing
// on the panel tells the player what the team can't know yet (sim/meters.ts, sim/clocks.ts).
const render = (state: GameState) => renderToStaticMarkup(createElement(IncidentPeopleStatus, { scenario: getScenario(state.activeRun!.scenarioId)!, run: state.activeRun!, state }));

describe('People at this call: subjects and clocks', () => {
  const s = generateIncident(specForSituation('hostage_crisis', 'market_row', 1));
  const start = startGateRun(s.id, 719);

  it('shows neither before the team has heard anything', () => {
    const html = render(start);
    expect(html).not.toContain('data-subject-stance');
    expect(html).not.toContain('data-clock');
  });

  // Going Live has no running-down clock (its stream fills), so the clock tile has no call to show
  // it on; the subject half still runs.
  it('shows the subject once the team has heard them', () => {
    const after = applyMove(start, { kind: 'decide', actionId: choiceActionId('hostage_crisis', 'going_live', 'on_stream'), band: 'favorable' })!;
    const html = render(after);
    expect(html).toContain('data-subject-stance');
  });
});
