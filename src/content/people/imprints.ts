// The eight imprint packs (docs/world-redesign.md, "Memory, imprints and settled traits"). An imprint is a
// temporary condition with a named cause and a real duration. It carries no number: stress stays the only
// figure on a roll, so nothing is charged twice. A pack changes lines, which forks appear and what can
// settle. Written under swat-officer-stories (chapters 6 and 8 of SKILL.md):
// - the telegraph is behavior the player saw, 15 words at most once {place} is bound;
// - every fork option names what it costs and what it risks in the same sentence, and none wins on
//   every axis: rest is certain and costs availability, peer support costs a colleague's shift and keeps
//   the note open, pairing keeps the officer deployable, spends the partner's slot and can lock the strain;
// - a strain chip names the condition only, never the place; its origin line is built in code as
//   "Since {place}, {date}." and never says earned, won or gained;
// - every strain has a positive that is earned the same way, and neither runs only through force or entry;
// - nothing here treats restraint, or harm to a civilian, as a cause (the engine guards both, see
//   src/sim/people/triggers.ts).
// Trigger conditions are data, read against what a debrief records (src/sim/people/call-read.ts).
import type { ImprintPackId } from '../../sim/people/types';
import type { TraitId } from '../../sim/types';

/** What a closed call can say about one officer. All derive from fields the debrief and run already hold. */
export type TriggerCond =
  | 'adverse'            // the call's career verdict was adverse
  | 'favorable'          // the call's career verdict was favorable
  | 'shots'              // force or incoming fire was recorded on the call
  | 'rear_adverse'       // a rear cover step this officer was on ended adverse
  | 'contact_adverse'    // a contact step this officer was on ended adverse
  | 'contact_favorable'  // a contact step this officer was on ended favorable
  | 'entry_adverse'      // an entry step this officer was on ended adverse
  | 'known_subject'      // the call served a known subject (a world warrant or armed contact)
  | 'bonded_partner'     // a trusted, close or mentor colleague was on the call
  | 'high_pressure'      // pressure reached 50 or more
  | 'overloaded'         // the officer ended the call at 60 stress or more
  | 'stress_critical'    // the officer ended the call at 80 stress or more
  | 'officer_hurt'       // this officer was injured on the call
  | 'resolved'           // the call's disposition was resolved or care accepted
  | 'no_force';          // no force was used on the call

export interface ForkOption {
  /** Button label, 3 words at most. */
  label: string;
  /** One sentence that names the cost and the risk together. `{partner}` fills from the choice. */
  line: string;
  cost: string;
  risk: string;
}

export interface PackTrait {
  /** An existing TraitId where one fits, otherwise a scoped id. */
  id: string;
  /** Present when `id` is an existing TraitId: it is added to the officer on settling. */
  existing?: TraitId;
  chip: string;
  /** One sentence under 60 characters naming when it applies and what changes. */
  condition: string;
}

export interface ImprintPack {
  id: ImprintPackId;
  /** What the trigger was: a hard moment, or a good one the officer is carrying. */
  origin: 'strain' | 'positive';
  /** Chip text, condition only. */
  label: string;
  /** Every condition must hold for the officer on the call. */
  when: readonly TriggerCond[];
  /** Where the strain can lock: a pairing's adverse result settles it only through a step of this kind
   * (swat-officer-stories rule 4, scope both ways). The positive and the way back are never scoped to
   * force or entry, so they are earned on any favorable call the pair works. */
  scope: 'shots' | 'rear' | 'contact' | 'entry' | 'known_subject' | 'any';
  /** Any one of these makes the first trigger severe, which opens the fork at once (once seen). */
  severe: readonly TriggerCond[];
  /** Real hours the note lasts if nothing else happens. */
  hours: number;
  /** Real hours of the rest stand-down. */
  restHours: number;
  /** Real hours a colleague spends on peer support. */
  peerHours: number;
  /** `{place}` is filled from the call. */
  telegraph: string;
  fork: { rest: ForkOption; peer: ForkOption; pair: ForkOption };
  strain: PackTrait;
  positive: PackTrait;
}

/** `noun` is what the officer is carrying, in the pack's own words ("flinch at doors"). */
const REST = (hours: number, noun: string): ForkOption => ({
  label: 'Stand down',
  line: `Stand them down for ${hours} hours. It costs every call in that time, and the ${noun} clears with no mark.`,
  cost: `Off calls for ${hours} hours.`,
  risk: 'A call that needs them goes without.',
});

const PEER = (hours: number, noun: string): ForkOption => ({
  label: 'Peer support',
  line: `Have a colleague sit with them for ${hours} hours. It costs that colleague a shift, and the ${noun} stays open until their next good call.`,
  cost: `A colleague's shift, ${hours} hours.`,
  risk: 'The note stays until a good call.',
});

const PAIR = (noun: string): ForkOption => ({
  label: 'Pair up',
  line: `Send them out with {partner} on the next call. It spends {partner}'s slot, and a bad result makes the ${noun} stick.`,
  cost: "The partner's slot on the next call.",
  risk: 'A bad result on that call settles the strain.',
});

const forkFor = (noun: string): ImprintPack['fork'] => ({ rest: REST(12, noun), peer: PEER(6, noun), pair: PAIR(noun) });

export const IMPRINT_PACKS: Readonly<Record<ImprintPackId, ImprintPack>> = {
  rattled_by_fire: {
    id: 'rattled_by_fire', origin: 'strain', label: 'Rattled by fire',
    scope: 'shots',
    when: ['adverse', 'shots'], severe: ['officer_hurt', 'overloaded'],
    hours: 36, restHours: 12, peerHours: 6,
    telegraph: 'Stopped at every door after the shots at {place}.',
    fork: forkFor('flinch at doors'),
    strain: { id: 'jumpy_at_doors', chip: 'Jumpy at doors', condition: 'Slower at doors after shots.' },
    positive: { id: 'steady_under_fire', chip: 'Steady under fire', condition: 'Holds position when shots are fired.' },
  },
  doubts_the_rear: {
    id: 'doubts_the_rear', origin: 'strain', label: 'Doubts the rear',
    scope: 'rear',
    when: ['rear_adverse'], severe: ['overloaded'],
    hours: 36, restHours: 12, peerHours: 6,
    telegraph: 'Asked for the rear to be checked again at {place}.',
    fork: forkFor('doubt about the rear'),
    strain: { id: 'second_guesses_rear', chip: 'Doubts the rear', condition: 'Slower on rear cover.' },
    positive: { id: 'sure_on_the_rear', chip: 'Sure on the rear', condition: 'Quicker on rear cover.' },
  },
  carries_the_name: {
    id: 'carries_the_name', origin: 'strain', label: 'Carries a known face',
    scope: 'known_subject',
    when: ['known_subject', 'adverse'], severe: ['overloaded'],
    hours: 48, restHours: 12, peerHours: 6,
    telegraph: 'Asked for the file again before the door at {place}.',
    fork: forkFor('worry over the file'),
    strain: { id: 'slow_on_known_names', chip: 'Slow on known names', condition: 'Slower when the subject is known.' },
    positive: { id: 'observant', existing: 'observant', chip: 'Observant', condition: 'Better at spotting inconsistent information.' },
  },
  short_with_callers: {
    id: 'short_with_callers', origin: 'strain', label: 'Short on the line',
    scope: 'contact',
    when: ['contact_adverse'], severe: ['overloaded'],
    hours: 36, restHours: 12, peerHours: 6,
    telegraph: 'Cut the caller off twice on the line at {place}.',
    fork: forkFor('edge on the line'),
    strain: { id: 'short_on_the_line', chip: 'Short on the line', condition: 'Shorter on contact steps.' },
    positive: { id: 'calm_voice', existing: 'calm_voice', chip: 'Calm voice', condition: 'Helps contact and negotiation tasks.' },
  },
  steadied_by_partner: {
    id: 'steadied_by_partner', origin: 'positive', label: 'Steadied by a partner',
    scope: 'any',
    when: ['favorable', 'bonded_partner'], severe: [],
    hours: 36, restHours: 12, peerHours: 6,
    telegraph: 'Checked the doorway beside them before each move at {place}.',
    fork: forkFor('habit of leaning on a partner'),
    strain: { id: 'leans_on_partner', chip: 'Leans on a partner', condition: 'Slower when working without a partner.' },
    positive: { id: 'steady', existing: 'steady', chip: 'Steady', condition: 'Less strain when uncertainty escalates.' },
  },
  found_the_voice: {
    id: 'found_the_voice', origin: 'positive', label: 'Found a voice',
    scope: 'contact',
    when: ['favorable', 'contact_favorable', 'high_pressure'], severe: [],
    hours: 36, restHours: 12, peerHours: 6,
    telegraph: 'Let the line stay quiet for a full minute at {place}.',
    fork: forkFor('long-silence habit'),
    strain: { id: 'drained_by_long_calls', chip: 'Drained by long calls', condition: 'More strain on calls that run long.' },
    positive: { id: 'keeps_the_line_open', chip: 'Keeps the line open', condition: 'Holds a long silence on contact steps.' },
  },
  counts_exits: {
    id: 'counts_exits', origin: 'strain', label: 'Counts the exits',
    scope: 'entry',
    when: ['entry_adverse'], severe: ['officer_hurt'],
    hours: 36, restHours: 12, peerHours: 6,
    telegraph: 'Counted the exits again before stepping in at {place}.',
    fork: forkFor('habit of counting exits'),
    strain: { id: 'counts_every_exit', chip: 'Counts every exit', condition: 'Slower to commit at entry steps.' },
    positive: { id: 'knows_the_exits', chip: 'Knows the exits', condition: 'Quicker to read exits at entry steps.' },
  },
  hard_night: {
    id: 'hard_night', origin: 'strain', label: 'Hard night',
    scope: 'any',
    when: ['adverse', 'overloaded'], severe: ['stress_critical'],
    hours: 48, restHours: 12, peerHours: 6,
    telegraph: 'Stayed in the van after the call at {place}, radio down.',
    fork: forkFor('weight of the night'),
    strain: { id: 'carries_the_night', chip: 'Carries a hard night', condition: 'Slower to reset after a bad call.' },
    positive: { id: 'steady_after_a_bad_night', chip: 'Steady after a bad night', condition: 'Resets quickly after a bad call.' },
  },
};

export const IMPRINT_PACK_IDS = Object.keys(IMPRINT_PACKS) as ImprintPackId[];

/** Read order for triggers: the first pack whose conditions hold starts the note. A hard night outranks the
 * rest because it is the widest net; a pack for a specific moment comes before it. */
export const IMPRINT_PRIORITY: readonly ImprintPackId[] = [
  'rattled_by_fire', 'doubts_the_rear', 'counts_exits', 'short_with_callers', 'carries_the_name',
  'found_the_voice', 'steadied_by_partner', 'hard_night',
];

/** Scoped strain and positive ids that are not TraitIds, with their chip and condition, by id. */
export function packTraitInfo(id: string): PackTrait | null {
  for (const pack of Object.values(IMPRINT_PACKS)) {
    if (pack.strain.id === id) return pack.strain;
    if (pack.positive.id === id) return pack.positive;
  }
  return null;
}
