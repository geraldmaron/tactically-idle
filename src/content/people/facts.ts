import { DISTRICTS } from '../city/districts';
// Memory facts: the detail shapes, and the short words the people selectors use (docs/world-redesign.md,
// "Memory"; swat-officer-stories references/ledger-and-callbacks.md, chapter 2).
//
// A detail is one specific, past tense, 80 characters at most, frozen when recorded. It names the call by its
// place and never by a civilian's bound name. Each kind has three shapes, no two sharing a three word phrase,
// and an officer's next entry of a kind rotates to the next shape so two entries never share a frame.
// Slots fill only from what the debrief recorded: the place, minutes on the clock, steps taken, the
// ending's title, the injury label, a colleague present. A shape whose slots are missing, whose result runs
// past 80 characters, or whose words contain a name on the call is skipped.
import type { BondState, FactKind, TieKind } from '../../sim/people/types';
import type { DistrictId } from '../../sim/world/types';

export interface FactSlots {
  place: string;
  /** Operation minutes on the clock when the call closed. */
  minutes?: number;
  steps?: number;
  /** The ending's title as the debrief shows it. */
  ending?: string;
  /** An officer injury label from the debrief. */
  label?: string;
  /** Surname of the colleague, where the shape needs one. */
  colleague?: string;
  /** The person's place in their crew, lower case ('runner', 'corner hand'). */
  role?: string;
  /** A case resolution phrase (see CASE_END). */
  caseEnd?: string;
  hours?: number;
  /** Game days an injury keeps the officer off duty. */
  days?: number;
}

export const FACT_DETAIL_MAX = 80;

/** Three shapes per kind. `{x}` fills from FactSlots. Colons and dashes never appear. */
export const FACT_SHAPES: Readonly<Record<FactKind, readonly string[]>> = {
  first_call: [
    'First call here was {place}, closed as "{ending}".',
    'First call here was {place}, {minutes} minutes on the clock.',
    'First call here was {place}.',
  ],
  rescue: [
    'Stayed on {place} for {minutes} minutes until the last resident was safe.',
    'Took {steps} steps at {place} and every resident ended safe.',
    'Was on the call at {place} when the last resident came out safe.',
  ],
  injured: [
    '{label}.',
    'Hurt during the call at {place}.',
    'Hurt at {place}. Back on duty {days} days later.',
  ],
  person_lost: [
    'Was on the call at {place} for {minutes} minutes.',
    'Was on the call at {place}.',
    'Worked {place} with {colleague} beside them.',
  ],
  negotiated: [
    'Talked at {place} for {minutes} minutes until the call closed.',
    'Held the talking steps at {place}, {steps} steps in all.',
    'Kept the line open at {place} until the call closed.',
  ],
  mentored: [
    'Worked {place} beside {colleague}.',
    'Ran {steps} steps at {place} with {colleague} next to them.',
    'Learned the order of work at {place} from {colleague}.',
  ],
  favorable_under_pressure: [
    'Held at {place} for {minutes} minutes with the clock running high.',
    'Worked {place} with the clock high and the call closed well.',
    'Took {steps} steps at {place} while pressure stayed high.',
  ],
  arrest: [
    'Closed the case on a {role} in {place}. It ended {caseEnd}.',
    'Worked the case on a {role} in {place} to its close.',
    'Was on the case in {place} that closed {caseEnd}.',
  ],
  shift: [
    'Rode a {hours} hour shift in {place} with {colleague}.',
    'Rode {hours} hours in {place}.',
    'Covered {place} for {hours} hours.',
  ],
};

/** How a case resolution reads at the end of an arrest fact ("It ended in a charge."). */
export const CASE_END: Readonly<Record<string, string>> = {
  charged: 'in a charge',
  diverted: 'in a diversion',
  care: 'in a handover into care',
  released: 'in a release',
  cleared: 'with the allegation cleared',
};

/** District names for places on facts from the world. The world lane's district definitions own the
 * display names; this table keeps the people layer self-contained until they are merged. */
export const DISTRICT_PLACE: Readonly<Record<DistrictId, string>> = Object.fromEntries(
  Object.values(DISTRICTS).map((district) => [district.id, district.name]),
) as Record<DistrictId, string>;

export const BOND_STATE_LABEL: Readonly<Record<BondState, string>> = {
  acquainted: 'Acquainted',
  trusted: 'Trusted',
  close: 'Close',
  mentor: 'Mentor',
  tense: 'Tense',
  strained: 'Strained',
};

/** One short line per way an officer can know a person. The UI adds the name. */
export const TIE_LINE: Readonly<Record<TieKind, string>> = {
  gym: 'Trains at the same gym',
  neighbor: 'Lives on the same block',
  school: 'Went to the same school',
  family_friend: 'Knows the family',
  church: 'Knows them from the congregation',
  prior_arrest: 'Made an earlier arrest involving them',
  old_job: 'Worked the same job once',
};

/** What a bond change reads as, one line each, surnames filled by the selector. */
export const BOND_CHANGE_LINE: Readonly<Record<BondState, string>> = {
  acquainted: '{a} and {b} have started working well together.',
  trusted: '{a} and {b} trust each other on a call now.',
  close: '{a} and {b} are close.',
  mentor: '{a} is mentoring {b}.',
  tense: '{a} and {b} are tense with each other.',
  strained: '{a} and {b} are strained, and one may ask for a transfer.',
};

/** Words for the cause on a bond, for the jacket. */
export const BOND_CAUSE_LINE: Readonly<Record<string, string>> = {
  shared_call: 'Good calls worked together.',
  shared_shift: 'Shifts ridden together.',
  mentoring: 'One shows the other the work.',
  rear_left_open: 'A rear was left open on a call.',
  promotion: 'One was promoted over the other.',
  breakup: 'A close tie ended.',
  repair: 'Calls worked together since.',
};
