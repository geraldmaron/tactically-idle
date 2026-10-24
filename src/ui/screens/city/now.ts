// The Now strip under the radio: the one thing waiting on the player, in the order that matters. A live call
// first, then an armed contact that can still be answered live, then a warrant that is ready or on the board,
// then the call closest to lapsing, else nothing. Pure: the screen turns an item into a card.
import { ARCHETYPES } from '../../../content/city/archetypes';
import { DISTRICTS } from '../../../content/city/districts';
import { subjectName } from '../../../sim/world/population';
import { getScenario } from '../../../sim/scenario-registry';
import type { GameState, IncidentCard, Officer } from '../../../sim/types';
import type { Lead } from '../../../sim/world/types';
import { scenarioTitle } from '../helpers';

export type NowItem =
  | { kind: 'live'; title: string; debrief: boolean; minute: number; scenarioId: string }
  | { kind: 'armed'; lead: Lead; title: string; line: string; left: number }
  | { kind: 'warrant'; lead: Lead; title: string; line: string; onBoard: boolean; cardId: string | null }
  | { kind: 'call'; card: IncidentCard; title: string; left: number; waiting: number }
  | { kind: 'quiet'; line: string };

const knownName = (g: GameState, subjectId: string): string => {
  const s = g.world.subjects[subjectId];
  return s && s.known ? subjectName(s) : 'Someone';
};

/** Officers who have the lead's person on the record as a tie. */
function knowingOfficers(g: GameState, subjectId: string): Officer[] {
  return g.people.ties.filter((t) => t.subjectId === subjectId && t.onRecord).map((t) => g.officers[t.officerId]).filter((o): o is Officer => !!o);
}

const pronoun = (g: GameState, subjectId: string): string => {
  const p = g.world.subjects[subjectId]?.pronouns;
  return p === 'she' ? 'her' : p === 'he' ? 'him' : 'them';
};

/** A lead can be answered live while its window is open. */
export const armedLive = (lead: Lead, at: number): boolean => lead.status === 'open' && lead.source === 'armed_contact' && lead.liveUntil !== undefined && lead.liveUntil >= at;

function squadOn(g: GameState, districtId: string): string | null {
  const shift = g.world.shifts.find((s) => s.stoppedAt === undefined && s.districtId === districtId);
  return shift ? g.squads.find((s) => s.id === shift.squadId)?.name ?? `Squad ${shift.squadId}` : null;
}

function tierAndCrew(g: GameState, lead: Lead): string {
  const crew = lead.crewId ? g.world.crews.find((c) => c.id === lead.crewId) : undefined;
  if (!crew) return '';
  return `${ARCHETYPES[crew.archetype].tierNames[lead.tier - 1]} of the ${crew.name.replace(/^The /, '')}`;
}

/** `skip` holds armed contacts the player chose to keep as leads this visit. */
export function nowItem(g: GameState, at: number, skip: ReadonlySet<string> = new Set()): NowItem {
  const t = Math.max(at, g.department.clockHighWater);
  const run = g.activeRun;
  if (run && run.status !== 'closed') {
    return { kind: 'live', title: scenarioTitle(g, run.scenarioId, t), debrief: run.status === 'debrief', minute: Math.floor(run.clock), scenarioId: run.scenarioId };
  }
  const armed = g.world.leads.filter((l) => armedLive(l, t) && !skip.has(l.id)).sort((a, b) => (a.liveUntil ?? 0) - (b.liveUntil ?? 0))[0];
  if (armed) {
    const district = DISTRICTS[armed.districtId].name;
    const name = knownName(g, armed.subjectId);
    const knows = knowingOfficers(g, armed.subjectId)[0];
    const squad = squadOn(g, armed.districtId);
    const line = [
      knows ? `${knows.surname} knows ${pronoun(g, armed.subjectId)}.` : '',
      squad ? `${squad} is on ${district}.` : '',
      'Respond now, or keep it as a lead.',
    ].filter(Boolean).join(' ');
    return { kind: 'armed', lead: armed, title: `${name} was seen armed on ${district}.`, line, left: Math.max(0, (armed.liveUntil ?? t) - t) };
  }
  // A warrant already on the board, then the open leads with the highest tier first.
  const onBoard = g.world.leads.filter((l) => l.status === 'warrant' && l.cardId && g.incidents.some((c) => c.id === l.cardId))[0];
  const ready = onBoard ?? g.world.leads.filter((l) => l.status === 'open').sort((a, b) => b.tier - a.tier || a.foundAt - b.foundAt)[0];
  if (ready) {
    const name = knownName(g, ready.subjectId);
    const knows = knowingOfficers(g, ready.subjectId)[0];
    const district = DISTRICTS[ready.districtId].name;
    const line = [tierAndCrew(g, ready), knows ? `${knows.surname} knows ${pronoun(g, ready.subjectId)}.` : ''].filter(Boolean).join('. ');
    return {
      kind: 'warrant', lead: ready, onBoard: !!onBoard, cardId: ready.cardId ?? null,
      title: onBoard ? `Warrant on ${name}, ${district}` : `Warrant ready on ${name}`,
      line: line ? `${line}.` : `On file in ${district}.`,
    };
  }
  const cards = (g.incidents ?? []).filter((c) => c.expiresAt > t);
  const card = [...cards].sort((a, b) => a.expiresAt - b.expiresAt)[0];
  if (card) return { kind: 'call', card, title: scenarioTitle(g, card.id, t), left: Math.max(0, card.expiresAt - t), waiting: cards.length };
  return { kind: 'quiet', line: 'Nothing is waiting. The city is holding.' };
}

/** The scenario's type for a plate and badge, when the card has one. */
export const cardType = (card: IncidentCard): string => getScenario(card.id)?.incident?.type ?? card.type;
