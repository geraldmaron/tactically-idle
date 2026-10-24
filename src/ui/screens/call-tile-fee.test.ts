// Review finding 9: the board card shows what the engine will pay (callFee, by the card's investigation), the
// same figure the preparation briefing and settlement use, not the authored reward on the scenario.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SCENARIO_TYPES } from '../../content/scenario-types';
import { incidentId, INCIDENT_CONTENT_VERSION } from '../../gen/incident';
import { addLead, openCase } from '../../sim/world/cases';
import { openWarrant } from '../../sim/world/warrants';
import type { Subject } from '../../sim/world/types';
import { CALL_FEE, callFee } from '../../sim/operation';
import { scenarioCards } from '../../sim/operation-selectors';
import { getScenario } from '../../sim/scenario-registry';
import { makeState, NOW, withCallOnBoard } from '../../sim/test-fixtures';
import type { GameState } from '../../sim/types';
import { money } from '../format';
import { CallTile } from './CallTile';

const family = SCENARIO_TYPES.find((info) => info.type === 'barricaded')!.families[0];
const plainId = () => getScenario(incidentId({ type: 'barricaded', familyId: family, buildingSeed: 3, seed: 5, tier: 1, contentVersion: INCIDENT_CONTENT_VERSION }))!.id;

function withWarrant(): { s: GameState; cardId: string } {
  const s = makeState();
  const w = s.world;
  const subject: Subject = { id: 's1', firstName: 'Al', surname: 'Bo', pronouns: 'he', nameKey: { first: 4, last: 7 }, crewId: null, tier: 3, districtId: 'pike', status: 'free', traits: [], known: true, reservedBy: null, history: [] };
  w.subjects[subject.id] = subject;
  const c = openCase(s, w, { subject, tier: 3, source: 'proactive', at: NOW, status: 'open' });
  const lead = addLead(w, c, 'proactive', NOW);
  expect(openWarrant(s, lead.id).ok).toBe(true);
  return { s, cardId: s.incidents.find((x) => x.world?.leadId === lead.id)!.id };
}

describe('the fee on the board', () => {
  it('is on every card, from the engine: tier table times the funding scale, the investigation tier for a world card', () => {
    const { s, cardId } = withWarrant();
    const card = scenarioCards(s, NOW).find((c) => c.id === cardId)!;
    const scenario = getScenario(cardId)!;
    expect(card.fee).toBe(CALL_FEE[3]);
    expect(card.fee).toBe(callFee(s, { world: s.incidents.find((c) => c.id === cardId)!.world }, scenario));
    // The authored reward is not what is paid.
    expect(scenario.rewards.funding).not.toBe(card.fee);

    const plain = withCallOnBoard(makeState(), plainId());
    plain.department.level = 4;
    const plainCard = scenarioCards(plain, NOW).find((c) => c.id === plainId())!;
    expect(plainCard.fee).toBe(CALL_FEE[1] * 2);
  });

  it('draws the engine figure on both card layouts, not the scenario reward', () => {
    const { s, cardId } = withWarrant();
    const card = scenarioCards(s, NOW).find((c) => c.id === cardId)!;
    const scenario = getScenario(cardId)!;
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(createElement(CallTile, { card, scenario, familyId: scenario.locationFamilyId, type: scenario.incident?.type ?? null, tier: 3, compact }));
      expect(html).toContain(`Pays up to ${card.fee!.toLocaleString('en-US')}`);
      expect(html).toContain(money(card.fee!));
      expect(html).not.toContain(`Pays up to ${scenario.rewards.funding.toLocaleString('en-US')} `);
    }
  });
});
