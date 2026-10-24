// What the map and the district sheet say about a district, worded from the view's fields. Pure.
import { CRIME } from '../../../content/city/tuning';
import type { CrewLadder, DistrictView } from '../../../sim/world/selectors';

export type CrimeBand = 'low' | 'mid' | 'high';

/** Below 50 the map tints cyan, from 50 to 59 amber, from 60 red. */
export const crimeBand = (crime: number): CrimeBand => (crime < 50 ? 'low' : crime < 60 ? 'mid' : 'high');

export const TREND_GLYPH: Readonly<Record<DistrictView['trend'], string>> = { rising: '▲', falling: '▼', steady: '' };
const TREND_WORD: Readonly<Record<DistrictView['trend'], string>> = { rising: 'rising', falling: 'falling', steady: 'steady' };

/** 'CRIME 62 ▲' on the map; a quiet district says so. */
export function crimeLabel(view: Pick<DistrictView, 'crime' | 'trend'>): string {
  const glyph = TREND_GLYPH[view.trend];
  const crime = Math.round(view.crime);
  return `CRIME ${crime}${glyph ? ` ${glyph}` : ''}${crime < 45 && view.trend !== 'rising' ? ' · QUIET' : ''}`;
}

/** The same label as words, for the list and screen readers. */
export const crimeSpoken = (view: Pick<DistrictView, 'crime' | 'trend'>): string => `crime ${Math.round(view.crime)}, ${TREND_WORD[view.trend]}`;

const moodWord = (crime: number): string => (crime < 35 ? 'Quiet' : crime < 50 ? 'Steady' : crime < 60 ? 'Uneasy' : crime < 70 ? 'Tense' : 'Hot');

/** One line under the district's name: how it feels, which way it is heading, who works it. */
export function moodLine(view: Pick<DistrictView, 'crime' | 'trend' | 'crews'>): string {
  const trend = view.trend === 'rising' ? ', and rising' : view.trend === 'falling' ? ', and easing' : '';
  const active = view.crews.filter((crew) => crew.status === 'active');
  const crew = active[0];
  const who = crew ? `${crew.name.startsWith('The ') ? crew.name : `The ${crew.name}`} work these streets.` : 'No crew is working these streets.';
  return `${moodWord(view.crime)}${trend}. ${who}`;
}

/** Where crime goes over the next hours at today's coverage: the engine drifts it a fixed share of the way to
 * its equilibrium each hour (CRIME.driftPerHour). The sheet draws this, labelled as a projection. */
export function projectCrime(view: Pick<DistrictView, 'crime' | 'equilibrium'>, steps = 6): number[] {
  const points = [view.crime];
  for (let i = 0; i < steps; i++) {
    const last = points[points.length - 1];
    points.push(Math.round((last + (view.equilibrium - last) * CRIME.driftPerHour) * 10) / 10);
  }
  return points;
}

/** Polyline points for a sparkline in a w by h box. The vertical span is never narrower than `minSpan`, so a
 * small drift reads as small. */
export function sparklinePoints(values: readonly number[], w: number, h: number, pad = 2, minSpan = 4): string {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(minSpan, hi - lo);
  const mid = (hi + lo) / 2;
  return values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
    const y = h / 2 - ((v - mid) / span) * (h - pad * 2);
    return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
  }).join(' ');
}

export interface CrewSummary {
  id: string;
  name: string;
  /** Two letters for the crest: 'PK' for the Pike Street Kings. */
  initials: string;
  /** 'T1 7/12' for each tier; tier 4 is '?' until someone in it is known. */
  tiers: { tier: 1 | 2 | 3 | 4; text: string; warrant: boolean }[];
  warrantReady: boolean;
}

/** A crew's initials for its crest, skipping a leading 'The'. */
export function crewInitials(name: string): string {
  const words = name.split(/\s+/).filter((word) => word && word.toLowerCase() !== 'the');
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? name).slice(0, 2);
  return letters.toUpperCase();
}

/** The crew card's counts. A tier shows `present of full`; the top tier hides its count until someone in it is
 * known. A known tier 3 or 4 member with an open lead (a sighting, a proactive find, or intel at its need, the
 * leads the world opens) makes the crew warrant ready, the same rule `openWarrant` applies. */
export function crewSummary(ladder: CrewLadder): CrewSummary {
  const tiers = ladder.tiers.map((tier) => {
    const known = tier.members.some((member) => member.known);
    const warrant = tier.members.some((member) => member.known && member.lead !== null && member.lead.status === 'open');
    return {
      tier: tier.tier,
      text: tier.tier === 4 && !known ? 'T4 ?' : `T${tier.tier} ${tier.present}/${tier.full}`,
      warrant: warrant && tier.tier >= 3,
    };
  });
  return { id: ladder.crew.id, name: ladder.crew.name, initials: crewInitials(ladder.crew.name), tiers, warrantReady: tiers.some((tier) => tier.warrant) };
}
