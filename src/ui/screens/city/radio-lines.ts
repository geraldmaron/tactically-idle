// The radio log as lines a dispatcher would say. The world stores events as fields and no prose
// (sim/world/types.ts WorldEvent); the words are made here. Names appear only for people the player has met,
// and no line carries a colon or a dash.
import { radioLines, type RadioLine } from '../../../sim/world/selectors';
import type { GameState } from '../../../sim/types';
import { clockStamp } from './clock';

export interface RadioItem {
  id: string;
  at: number;
  /** '9:38 PM' on the game clock. */
  time: string;
  who: string;
  place: string;
  text: string;
  /** Funding a closed case paid, shown as the coin glyph and a number after the text. */
  amount?: number;
  /** Intel lines (sightings, leads) read in cyan. */
  tone: 'plain' | 'intel';
}

const lower = (text: string | null): string | null => (text ? text.toLowerCase() : null);
const join = (parts: (string | null | undefined)[]): string => parts.filter(Boolean).join(', ');

function who(line: RadioLine): string {
  const event = line.event;
  if (event.squadId) return `Squad ${event.squadId}`;
  if (event.unit) return `Unit ${event.unit}`;
  return 'Dispatch';
}

/** One event as a radio line, or null for the events the radio skips (the case opened with its contact). */
export function radioItem(g: Pick<GameState, 'department'>, line: RadioLine): RadioItem | null {
  const event = line.event;
  const base = { id: event.id, at: event.at, time: clockStamp(g, event.at).time, who: who(line), place: line.districtName ?? 'The city' };
  const tier = lower(line.tierName);
  switch (event.kind) {
    case 'case_opened': return null;
    case 'contact': {
      const high = (event.tier ?? 1) >= 3;
      return { ...base, tone: high ? 'intel' : 'plain', text: high ? join(['sighting', line.subjectName, tier, line.crewName]) : `stopped ${join([line.subjectName ?? 'one', line.crewName, tier])}` };
    }
    case 'lead': return { ...base, tone: 'intel', text: join([`lead opened on ${line.subjectName ?? 'someone'}`, tier, line.crewName]) };
    case 'case_closed': return { ...base, who: 'Dispatch', tone: 'plain', text: `case closed on ${line.subjectName ?? 'one'}`, ...(event.amount ? { amount: event.amount } : {}) };
    case 'crew_collapsed': return { ...base, who: 'Dispatch', tone: 'intel', text: `${line.crewName ?? 'A crew'} has fallen apart` };
    case 'crew_formed': return { ...base, who: 'Dispatch', tone: 'intel', text: `a new crew, ${line.crewName ?? 'unnamed'}, is working the blocks` };
    case 'district_opened': return { ...base, who: 'Dispatch', tone: 'plain', text: 'district opened for patrol' };
    case 'shift_started': return { ...base, tone: 'plain', text: 'proactive shift started' };
    case 'shift_ended': {
      const stops = event.amount ?? 0;
      return { ...base, tone: 'plain', text: `proactive shift over, ${stops === 1 ? '1 stop' : `${stops} stops`}` };
    }
  }
}

/** The newest `n` radio lines, newest first. */
export function radioItems(g: GameState, n: number): RadioItem[] {
  const out: RadioItem[] = [];
  for (const line of radioLines(g, Math.max(n * 4, 12))) {
    const item = radioItem(g, line);
    if (item) out.push(item);
    if (out.length >= n) break;
  }
  return out;
}

/** The whole line as plain text, for tests and screen readers. */
export const radioSpoken = (item: RadioItem): string => `${item.time}. ${item.who}, ${item.place}, ${item.text}`;
