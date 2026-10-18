// What the Scenario Lab's Tuning surface knows about each tunable field: a plain label, help, a
// group, how the game reads it (the read-mode badge), a range, and the test files that pin its
// value. One entry per leaf of every registered table (a list is one leaf: the tuning file writes
// lists whole); tuning-tables.test.ts checks that no leaf is missing and every path resolves.
//
// Read modes (spec 7.4): live (read at call time), new-entities (stored when a card, recruit or unit
// is made), department (economy, roster and careers: no call-level preview), display (labels only),
// generation and structural (read-only, with why), dead (read nowhere in play: the lab hides it
// behind "Show unused", with why).
import type { TuningPath } from './tuning';
import { LOCATION_TUNING } from './location';
import { COVER_REACH } from './cover';
import { STRESS_BANDS } from './officer';
import { COMMAND_STAFF } from './command-staff';
import { EQUIPMENT_MANAGER } from './equipment-manager-policy';
import { TIER_REWARD_MULTIPLIERS } from '../content/incidents/rewards';
import { IDENTITY_DEFAULT } from '../content/incidents/types';

export type ReadMode = 'live' | 'new-entities' | 'department' | 'display' | 'generation' | 'structural' | 'dead';
export type TuningGroup = 'odds' | 'pressure' | 'subjects' | 'harm' | 'time' | 'debrief' | 'strain' | 'economy' | 'flow';
/** `items` names each value of a list field in order (a list is tuned whole). */
export interface FieldMeta { path: TuningPath; label: string; help: string; group: TuningGroup; mode: ReadMode;
  min?: number; max?: number; step?: number; unit?: string; why?: string; pinnedBy: readonly string[]; items?: readonly string[] }

/** Test files whose assertions hard-code a table's values or fail when they move, found by grep for
 * the table's name and by nudging each table about 3% and running the sim, content, ui and gen
 * suites (2026-10-09). Read these before changing a table. call-tree-balance.test.ts plays real
 * calls through the gate bands, so it is listed for every table a call reads while it runs. */
const BALANCE = 'src/gen/incident/trees-v13/call-tree-balance.test.ts';
const sim = (...names: string[]) => names.map(name => `src/sim/${name}.test.ts`);
export const PINNED_BY: Readonly<Record<string, readonly string[]>> = {
  RESOLUTION_TUNING: [...sim('resolution', 'consolidation', 'incident-factors', 'meters', 'pending-completion', 'spatial-factors', 'story-people', 'story-route-outcomes', 'story-squad-routes'), BALANCE],
  EXPERIENCE_TUNING: [...sim('spatial-factors'), BALANCE],
  SPATIAL_TUNING: [...sim('spatial-factors'), BALANCE],
  ROSTER_TUNING: sim('department', 'career'),
  INCIDENT_TUNING: sim('incidents'),
  CLOCK_RULES_V1: [...sim('clocks'), BALANCE],
  FORCE_RISK_V1: [...sim('force-risk'), BALANCE],
  CAREER_TUNING: [...sim('career', 'consolidation', 'economy', 'external-support'), 'src/ui/components/OfficerProgress.test.ts'],
  LEARNING_MULTIPLIER: [...sim('career'), 'src/ui/components/OfficerProgress.test.ts'],
  DEVELOP_TUNING: sim('catalog-capabilities'),
  THREAT_TUNING: [...sim('incident-factors', 'outcome-score'), BALANCE],
  ENV_TUNING: [...sim('catalog-capabilities'), BALANCE],
  OUTCOME_SCORE_V1: [...sim('outcome-score', 'consolidation'), BALANCE],
  AUTHORIZATION_V1: [...sim('authorization', 'drawn-effects'), BALANCE],
  INCIDENT_CLASS_V1: [...sim('incident-factors'), BALANCE],
  INCOMING_FIRE_V1: [...sim('drawn-effects'), BALANCE],
  TEAM_FORCE_V1: [...sim('drawn-effects'), BALANCE],
  CASCADE_V1: [...sim('drawn-effects'), BALANCE],
  METERS_V1: [...sim('meters', 'commitments', 'consolidation'), BALANCE],
  ECONOMY_TUNING: sim('economy', 'career', 'command-staff', 'department', 'equipment-manager', 'squad-optimizer'),
  EQUIPMENT_TUNING: sim('equipment', 'save'),
  RECRUIT_TUNING: [...sim('department', 'campaign-selection', 'personnel'), 'src/ui/screens/Recruit.test.ts'],
};

type Spec = { label: string; help: string; group?: TuningGroup; mode?: ReadMode; min?: number; max?: number; step?: number; unit?: string; why?: string; items?: readonly string[] };

/** Entries for one table: `fields` keyed by path inside the table, with the table's usual group and mode. */
function table(name: string, base: { group: TuningGroup; mode: ReadMode }, fields: Record<string, Spec>): FieldMeta[] {
  const pinnedBy = PINNED_BY[name] ?? [];
  return Object.entries(fields).map(([path, spec]) => ({ path: `${name}.${path}`, group: base.group, mode: base.mode, ...spec, pinnedBy }));
}

/** One entry per key of a record field, e.g. a value per weapon. */
function each(prefix: string, keys: Record<string, string>, make: (name: string, key: string) => Spec): Record<string, Spec> {
  return Object.fromEntries(Object.entries(keys).map(([key, name]) => [prefix ? `${prefix}.${key}` : key, make(name, key)]));
}

const unused = (why: string, label: string, group?: TuningGroup): Spec => ({ label, help: 'Not used by the game.', mode: 'dead', why, ...(group ? { group } : {}) });

const BANDS = { favorable: 'goes well', mixed: 'partly works', adverse: 'goes badly' };
const CHECKS = { contact: 'talking', observation: 'watching', execution: 'entries and force', pressure: 'holding the line', medical: 'medical work', coordination: 'coordination' };
const WEAPONS = { handgun: 'handgun', long_gun: 'rifle', shotgun: 'shotgun', edged: 'blade', blunt: 'blunt weapon', improvised: 'improvised weapon', unknown: 'unknown weapon' };
const PROFILES = { firearm: 'Firearm', less_lethal_device: 'Less-lethal device', less_lethal_impact: 'Impact launcher', hands: 'By hand' };
const EVENTS = { heard: 'heard out', contact: 'contact', honest: 'told plainly', provoked: 'provoked', team_seen: 'sees the team close', shots: 'shots', released: 'lets someone go', promise_kept: 'promise kept', promise_broken: 'promise broken' };
const PAIR = ['trust', 'strain'] as const;
const pair = (label: string, help: string): Spec => ({ label, help: `${help} Trust for the department, strain the deployed officers carry home.`, items: PAIR, min: -10, max: 10, step: 0.25, unit: 'points' });

const THREAT_DEAD_CALLER = 'Read only by civilianRiskLoss and pressureDynamics (threat.ts), which nothing calls.';
const ENV_NO_CALLER = (fn: string) => `Read only by ${fn} (environment.ts or threat.ts), which nothing calls.`;
const ENV_NOWHERE = 'Read nowhere.';

export const TUNING_META: readonly FieldMeta[] = [
  ...table('RESOLUTION_TUNING', { group: 'odds', mode: 'live' }, {
    ratingScale: { label: 'Officer quality', help: 'Score points per rating point for the lead seat (a rating of 80 gives 44 points at 0.55). Later seats count less (seat weights).', min: 0.3, max: 0.9, step: 0.01 },
    seats: { label: 'Seat weights', help: 'Share of each officer\'s rating that counts, best officer first. Later seats add little.', items: ['1st', '2nd', '3rd', '4th', '5th'], min: 0, max: 1, step: 0.05, unit: 'share' },
    span: { label: 'Skill vs luck', help: 'Spread of the dice around the expected margin, in score points. Lower: the squad matters more. Higher: luck matters more.', min: 30, max: 120, step: 5, unit: 'points' },
    favorableAt: { label: 'Goes well at', help: 'A result (margin plus dice) at or above this goes well. Each point moves the chance of going well by about 1.55 points for choices in the sloped region; choices at the floor or ceiling don\'t move.', min: -10, max: 30, step: 0.5, unit: 'points' },
    adverseAt: { label: 'Goes badly below', help: 'A result below this goes badly. Must stay below "Goes well at".', min: -40, max: 10, step: 0.5, unit: 'points' },
    setbackChance: { label: 'Setback chance', help: 'Chance any choice goes badly, however strong the squad. Never below 0.005: forced bands aim inside it, and no style may guarantee a clean call.', min: 0.005, max: 0.12, step: 0.005, unit: 'chance' },
    luckChance: { label: 'Lucky-break chance', help: 'Chance any choice goes well, however weak the squad. Never below 0.005.', min: 0.005, max: 0.12, step: 0.005, unit: 'chance' },
    conditionMax: { label: 'Stress cost to ratings', help: 'Share of an officer\'s rating contribution lost at stress 100, rising linearly from "Stress cost starts at".', group: 'pressure', min: 0, max: 0.9, step: 0.05, unit: 'share' },
    conditionFrom: { label: 'Stress cost starts at', help: 'Stress level where ratings start to suffer.', group: 'pressure', min: 0, max: 60, step: 1, unit: 'stress' },
    pressureMax: { label: 'Scene pressure', help: 'Score points the lead seat loses at full scene pressure with no composure. Composure takes off up to "Composure shield" of it.', group: 'pressure', min: 0, max: 40, step: 1, unit: 'points' },
    pressureFrom: { label: 'Pressure bites from', help: 'Scene pressure (0 to 100) where the pressure penalty starts.', group: 'pressure', min: 0, max: 80, step: 1, unit: 'pressure' },
    composureShield: { label: 'Composure shield', help: 'Share of the pressure penalty that composure 100 removes.', group: 'pressure', min: 0, max: 1, step: 0.05, unit: 'share' },
    workloadScore: { label: 'Work-area cost', help: 'Score points lost per extra minute of work in a large area.', min: 0, max: 2, step: 0.05, unit: 'points/min' },
    travelScore: { label: 'Travel cost', help: 'Score points lost per minute of travel to the work.', min: 0, max: 2, step: 0.05, unit: 'points/min' },
    ...each('bandTime', BANDS, name => ({ label: `Time when it ${name}`, help: 'Multiple of the choice\'s base minutes. The commit, the preview\'s expected time and range, and the clock lookahead all read this.', group: 'time', min: 0.5, max: 3, step: 0.05, unit: '×' })),
    ...each('bandStress', BANDS, name => ({ label: `Strain when it ${name}`, help: 'Multiple of the choice\'s base strain.', group: 'strain', min: 0, max: 3, step: 0.05, unit: '×' })),
    ...each('pressureSensitivity', CHECKS, name => ({ label: `Pressure on ${name}`, help: 'How much scene pressure degrades this kind of check (1 = the full penalty).', group: 'pressure', min: 0, max: 2.5, step: 0.1, unit: '×' })),
    supportRank: { label: 'Extra support squads', help: 'Each further support squad\'s coordination counts this share of the one before.', min: 0, max: 1, step: 0.05, unit: 'share' },
    'riskBands.lowAt': { label: 'Low-risk label from', help: 'A choice reads "low risk" at this chance of going well or more. Labels only: the odds don\'t change.', mode: 'display', min: 0, max: 1, step: 0.01, unit: 'chance' },
    'riskBands.moderateAt': { label: 'Moderate-risk label from', help: 'A choice reads "moderate risk" at this chance of going well or more. Labels only.', mode: 'display', min: 0, max: 1, step: 0.01, unit: 'chance' },
    'riskBands.highAt': { label: 'High-risk label from', help: 'A choice reads "high risk" at this chance of going well or more, and "severe" below. Labels only.', mode: 'display', min: 0, max: 1, step: 0.01, unit: 'chance' },
    'strain.participant': { label: 'Strain: taking part', help: 'Share of a decision\'s strain an officer taking part carries.', group: 'strain', min: 0, max: 2, step: 0.05, unit: 'share' },
    'strain.actingSquad': { label: 'Strain: acting squad, standing by', help: 'Share an officer in the acting squad carries when not taking part.', group: 'strain', min: 0, max: 2, step: 0.05, unit: 'share' },
    'strain.supportSquad': { label: 'Strain: support squad', help: 'Share an officer in a support squad carries.', group: 'strain', min: 0, max: 2, step: 0.05, unit: 'share' },
    'strain.bystander': { label: 'Strain: deployed, not involved', help: 'Share a deployed officer carries whose squad neither acts nor supports.', group: 'strain', min: 0, max: 2, step: 0.05, unit: 'share' },
    'strain.pressureComposure': { label: 'Pressure strain', help: 'Extra strain at full scene pressure for an officer with no composure: strain × (1 + this × pressure × (1 − composure)).', group: 'strain', min: 0, max: 3, step: 0.05, unit: '×' },
    'strain.steadyTrait': { label: 'Steady officer, facts unresolved', help: 'Strain multiple for an officer with the steady trait while facts are still unresolved.', group: 'strain', min: 0.3, max: 1.2, step: 0.05, unit: '×' },
    'strain.rookieWithMentor': { label: 'Rookie with a mentor', help: 'Strain multiple for a rookie with a mentor in the squad.', group: 'strain', min: 0.3, max: 1.2, step: 0.05, unit: '×' },
  }),
  ...table('EXPERIENCE_TUNING', { group: 'odds', mode: 'live' }, {
    pressureOn: { label: 'Experience counts from', help: 'Scene pressure at which experience bonuses and penalties apply. Holding-the-line checks always count.', group: 'pressure', min: 0, max: 100, step: 5, unit: 'pressure' },
    rookiePenalty: { label: 'Rookie under pressure', help: 'Score points a rookie adds under pressure (negative: a penalty).', min: -8, max: 0, step: 0.5, unit: 'points' },
    rookieStrain: { label: 'Rookie strain under pressure', help: 'Strain multiple for a rookie under pressure.', group: 'strain', min: 1, max: 1.6, step: 0.05, unit: '×' },
    seasonedBonus: { label: 'Seasoned under pressure', help: 'Score points a seasoned officer adds under pressure.', min: 0, max: 8, step: 0.5, unit: 'points' },
    veteranBonus: { label: 'Veteran under pressure', help: 'Score points a veteran adds under pressure.', min: 0, max: 10, step: 0.5, unit: 'points' },
    mentoring: { label: 'Mentoring', help: 'Score points when a mentor works beside a rookie. The squad builder reads it too.', min: 0, max: 6, step: 0.5, unit: 'points' },
    ageStrainFrom: { label: 'Age strain from', help: 'Age past which strain rises.', group: 'strain', min: 40, max: 60, step: 1, unit: 'years' },
    ageStrainPer5: { label: 'Age strain per 5 years', help: 'Extra strain share for each 5 years past "Age strain from".', group: 'strain', min: 0, max: 0.2, step: 0.01, unit: 'share' },
    malfunctionShare: { label: 'Unreliable kit penalty', help: 'Share of an unreliable unit\'s lost effect charged as its own negative line. The auto-equip ranking reads it too.', min: 0, max: 1, step: 0.05, unit: 'share' },
    radioShare: { label: 'Radio share of coordination', help: 'Share of a support squad\'s coordination carried by the radio link.', min: 0, max: 1, step: 0.05, unit: 'share' },
  }),
  ...table('SPATIAL_TUNING', { group: 'odds', mode: 'live' }, {
    clearFull: { label: 'Signal clear at', help: 'Transmission that counts as a fully clear signal; weaker signals help less.', min: 0.2, max: 1, step: 0.05, unit: 'transmission' },
    toneClear: { label: 'Map: clear line from', help: 'Transmission at which a sight or sound line draws as clear on the map. Map tone only.', mode: 'display', min: 0, max: 1, step: 0.05, unit: 'transmission' },
    tonePartial: { label: 'Partial line from', help: 'Transmission at which a line draws as partial on the map. It also decides which subjects count as near the work.', min: 0, max: 1, step: 0.05, unit: 'transmission' },
    rangeFloor: { label: 'Value at maximum range', help: 'Share of an item\'s value left at its maximum range (full at its effective range).', min: 0, max: 1, step: 0.05, unit: 'share' },
    entryScorePerFt: { label: 'Entry distance cost', help: 'Score points lost per foot the subject stands from the nearest door of their room.', min: 0, max: 1, step: 0.05, unit: 'points/ft' },
    entryStrainPerFt: { label: 'Entry distance strain', help: 'Extra strain share per foot into the room, up to "Entry strain cap".', group: 'strain', min: 0, max: 0.05, step: 0.005, unit: 'share/ft' },
    entryStrainCap: { label: 'Entry strain cap', help: 'Most extra strain share the distance into a room adds.', group: 'strain', min: 0, max: 1, step: 0.05, unit: 'share' },
    voiceLinkFt: { label: 'Voice carries', help: 'Feet over which squads without radios can still talk.', min: 0, max: 80, step: 5, unit: 'ft' },
    coverHard: { label: 'Hard cover', help: 'Difficulty an entry gains when an armed person has hard cover (a counter, an appliance) between them and the door.', group: 'subjects', min: 0, max: 15, step: 0.5, unit: 'points' },
    coverConcealment: { label: 'Concealment', help: 'Difficulty an entry gains when an armed person is behind something that only hides them (a sofa, a desk).', group: 'subjects', min: 0, max: 10, step: 0.5, unit: 'points' },
  }),
  ...table('ROSTER_TUNING', { group: 'economy', mode: 'department' }, {
    maxSquads: { label: 'Squads', help: 'How many squads the department has.', mode: 'structural', why: 'The squad slots are SQUAD_IDS (types.ts); this only counts them.' },
    squadSize: { label: 'Squad size', help: 'Officers per squad.', min: 2, max: 6, step: 1, unit: 'officers' },
    nameMax: { label: 'Squad name length', help: 'Longest squad name the player can type.', mode: 'display', min: 5, max: 40, step: 1, unit: 'characters' },
    severanceHours: { label: 'Severance', help: 'Hours of wage paid when an officer is let go.', min: 0, max: 40, step: 1, unit: 'hours' },
  }),
  ...table('INCIDENT_TUNING', { group: 'flow', mode: 'department' }, {
    minIntervalMs: { label: 'Shortest gap between calls', help: 'Arrivals come a random gap apart, between the shortest and longest. The next arrival time is stored when drawn.', mode: 'new-entities', min: 300_000, max: 14_400_000, step: 60_000, unit: 'ms' },
    maxIntervalMs: { label: 'Longest gap between calls', help: 'See "Shortest gap between calls".', mode: 'new-entities', min: 300_000, max: 14_400_000, step: 60_000, unit: 'ms' },
    minLifetimeMs: { label: 'Shortest card lifetime', help: 'How long a call card stays on the board, drawn when it arrives and stored on the card.', mode: 'new-entities', min: 3_600_000, max: 86_400_000, step: 600_000, unit: 'ms' },
    maxLifetimeMs: { label: 'Longest card lifetime', help: 'See "Shortest card lifetime".', mode: 'new-entities', min: 3_600_000, max: 86_400_000, step: 600_000, unit: 'ms' },
    boardMax: { label: 'Board size', help: 'Most cards on the board. An arrival on a full board is lost.', min: 1, max: 10, step: 1, unit: 'cards' },
    initialCount: { label: 'Cards at the start', help: 'Cards a new campaign starts with.', min: 0, max: 5, step: 1, unit: 'cards' },
    expiringSoonMs: { label: 'Expiring soon within', help: 'The board summary counts a card as expiring soon inside this window. Labels only.', mode: 'display', min: 600_000, max: 21_600_000, step: 600_000, unit: 'ms' },
  }),
  ...table('CLOCK_RULES_V1', { group: 'time', mode: 'live' }, {
    floor: { label: 'Clock stops short at', help: 'Where a clock stops in a decision that would run it out before any of its cues was heard, so a warning always comes first.', min: 0.1, max: 10, step: 0.1, unit: 'clock points' },
  }),
  ...table('FORCE_RISK_V1', { group: 'harm', mode: 'live' }, Object.fromEntries(Object.entries(PROFILES).flatMap(([key, name]) => [
    [`${key}.fatal`, key === 'hands'
      ? { label: `${name}: killed below`, help: 'Taking someone by hand is never fatal in this model.', mode: 'structural' as const, why: 'The call trees carry no fatal result for force by hand; a value above 0 would leave a drawn result with nowhere to go.' }
      : { label: `${name}: killed below`, help: 'Cumulative thresholds on one sample: below "killed" the person dies, below "badly hurt" they are badly hurt, below "hurt" hurt, else unhurt. Each chance is the gap between thresholds. Stays above 0.', min: 0.001, max: 0.5, step: 0.001, unit: 'threshold' }],
    [`${key}.serious`, { label: `${name}: badly hurt below`, help: 'Second cumulative threshold: must stay above "killed below" and below "hurt below".', min: 0.01, max: 0.9, step: 0.005, unit: 'threshold' }],
    [`${key}.wounded`, { label: `${name}: hurt below`, help: 'Third cumulative threshold: above it the person is unhurt. At most 1.', min: 0.05, max: 1, step: 0.01, unit: 'threshold' }],
  ]))),
  ...table('CAREER_TUNING', { group: 'strain', mode: 'department' }, {
    retireAge: { label: 'Retirement age', help: 'Age at which officers must retire.', min: 50, max: 70, step: 1, unit: 'years' },
    noticeDays: { label: 'Retirement notice', help: 'Game days between announcing a retirement and leaving.', min: 0, max: 90, step: 1, unit: 'days' },
    serviceEligibleYears: { label: 'May retire after', help: 'Service years from which an officer may choose to retire.', min: 15, max: 35, step: 1, unit: 'years' },
    serviceRetireBase: { label: 'Retire chance at first chance', help: 'Chance of choosing to retire at the first eligible service anniversary.', min: 0, max: 1, step: 0.01, unit: 'chance' },
    serviceRetireStep: { label: 'Retire chance per year after', help: 'Added to the retire chance at each later anniversary.', min: 0, max: 0.3, step: 0.01, unit: 'chance' },
    serviceRetireCap: { label: 'Retire chance cap', help: 'Highest the retire chance gets.', min: 0, max: 1, step: 0.01, unit: 'chance' },
    retentionRaise: { label: 'Retention raise', help: 'Wage raise share of a retention offer.', group: 'economy', min: 0, max: 0.5, step: 0.01, unit: 'share' },
    retentionDays: { label: 'Retention delay', help: 'Game days a retention offer moves the retirement day.', min: 0, max: 730, step: 5, unit: 'days' },
    burnoutStress: { label: 'Burnout stress', help: 'Stress above which, held for "Burnout after", an officer burns out.', min: 40, max: 100, step: 1, unit: 'stress' },
    burnoutSustainDays: { label: 'Burnout after', help: 'Game days above burnout stress before burnout.', min: 1, max: 60, step: 1, unit: 'days' },
    burnoutAdverse: { label: 'Burnout: bad calls', help: 'Calls gone badly within the recent window that also burn an officer out.', min: 1, max: 10, step: 1, unit: 'calls' },
    burnoutWindow: { label: 'Burnout: recent calls', help: 'How many recent calls the bad-call count looks at.', min: 1, max: 20, step: 1, unit: 'calls' },
    wageStep: { label: 'Wage step per service year', help: 'Added to the hourly wage for each full service year.', group: 'economy', min: 0, max: 5, step: 0.5, unit: 'per hour' },
    wageCap: { label: 'Wage cap', help: 'Highest hourly wage service raises reach.', group: 'economy', min: 20, max: 150, step: 1, unit: 'per hour' },
    ageRecoveryStart: { label: 'Slower recovery from', help: 'Age past which stress recovery slows.', min: 30, max: 60, step: 1, unit: 'years' },
    ageRecoveryPerYear: { label: 'Recovery lost per year', help: 'Share of recovery lost per year past "Slower recovery from".', min: 0, max: 0.05, step: 0.005, unit: 'share' },
    ageRecoveryFloor: { label: 'Recovery floor', help: 'Recovery never slows below this share of the base rate.', min: 0.3, max: 1, step: 0.05, unit: 'share' },
    ageBands: { label: 'Birthdays reported at', help: 'Ages at which a birthday shows in the shift report (where its effect band changes). Report only.', mode: 'display', items: ['1st', '2nd', '3rd'], min: 30, max: 70, step: 1, unit: 'years' },
    xpPerPoint: { label: 'XP per rating point', help: 'Experience needed for +1 to an officer\'s main rating, before the learning rate.', min: 25, max: 400, step: 5, unit: 'xp' },
    xpRatingCeiling: { label: 'XP growth ceiling', help: 'Experience stops raising a rating at this level.', min: 60, max: 100, step: 1, unit: 'rating' },
    favorableAt: { label: 'Career: good call at', help: 'Outcome factor at or above which a call counts as favorable for careers and department service.', group: 'debrief', min: 0, max: 1, step: 0.01, unit: 'factor' },
    adverseBelow: { label: 'Career: bad call below', help: 'Outcome factor below which a call counts as adverse for careers (burnout counts these).', group: 'debrief', min: 0, max: 1, step: 0.01, unit: 'factor' },
    'debriefWeights.objective': { label: 'Outcome blend: objective', help: 'Weight of the objective in the outcome factor of calls before v13 and in each debrief\'s band in officer histories. v13 calls score their factor from what happened (Debrief group).', group: 'debrief', min: 0, max: 1, step: 0.05, unit: 'weight' },
    'debriefWeights.civilianSafety': { label: 'Outcome blend: civilian safety', help: 'Weight of civilian safety in the same blend.', group: 'debrief', min: 0, max: 1, step: 0.05, unit: 'weight' },
  }),
  ...table('LEARNING_MULTIPLIER', { group: 'strain', mode: 'department' }, each('', { rookie: 'rookie', developing: 'developing officer', seasoned: 'seasoned officer', veteran: 'veteran' },
    name => ({ label: `Learning rate: ${name}`, help: 'How fast experience turns into rating growth at this experience band.', min: 0.3, max: 2, step: 0.05, unit: '×' }))),
  ...table('DEVELOP_TUNING', { group: 'economy', mode: 'department' }, {
    maxPurchase: { label: 'Most units per purchase', help: 'Largest quantity one store purchase accepts.', min: 1, max: 999, step: 1, unit: 'units' },
  }),
  ...table('THREAT_TUNING', { group: 'subjects', mode: 'live' }, {
    ...each('armament', { none: 'unarmed', blunt: 'blunt weapon', edged: 'blade', handgun: 'handgun', long_gun: 'rifle', unknown: 'unknown arms' },
      name => ({ label: `Threat: ${name}`, help: 'Weight of this armament in a subject\'s threat (0 to 1), times readiness.', min: 0, max: 1, step: 0.05, unit: 'weight' })),
    ...each('readiness', { concealed: 'concealed', carried: 'carried', brandished: 'in hand' },
      name => ({ label: `Readiness: ${name}`, help: 'Multiple on the armament weight for how ready the weapon is.', min: 0, max: 1.5, step: 0.05, unit: '×' })),
    ...each('difficulty', CHECKS, name => ({ label: `Armed subject: ${name}`, help: 'Difficulty points at full threat for this kind of check.', min: 0, max: 30, step: 0.5, unit: 'points' })),
    seats: { label: 'Subject seats', help: 'Share counted for the 1st, 2nd, 3rd and later subject near the work.', items: ['1st', '2nd', '3rd', '4th and later'], min: 0, max: 1, step: 0.05, unit: 'share' },
    strainExecution: { label: 'Threat strain on entries', help: 'Extra strain share per point of armed threat near an entry, for the officers taking part.', group: 'strain', min: 0, max: 1, step: 0.05, unit: 'share' },
    strainOther: { label: 'Threat strain on other work', help: 'Extra strain share per point of armed threat near any other work, for the officers taking part.', group: 'strain', min: 0, max: 1, step: 0.05, unit: 'share' },
    strainCap: { label: 'Threat strain cap', help: 'Most the armed threat can multiply the strain of the officers taking part.', group: 'strain', min: 1, max: 3, step: 0.05, unit: '×' },
    ...each('civilian', CHECKS, name => unused(THREAT_DEAD_CALLER, `Civilian cost: ${name}`)),
    mixedShare: unused(THREAT_DEAD_CALLER, 'Civilian cost when it partly works'),
    distantShare: unused(THREAT_DEAD_CALLER, 'Civilian cost at a distance'),
    noCivilianShare: unused(THREAT_DEAD_CALLER, 'Civilian cost with nobody else inside'),
    ...each('contact', { cooperative: 'cooperative', distressed: 'distressed', intoxicated: 'intoxicated', agitated: 'agitated', hostile: 'hostile', in_crisis: 'in crisis' },
      name => ({ label: `Talking to someone ${name}`, help: 'Score points on talking once the subject\'s temper is known.', min: -15, max: 10, step: 0.5, unit: 'points' })),
    pressureKindShare: { label: 'Temper on holding checks', help: 'Share of the temper effect that carries onto holding-the-line checks.', min: 0, max: 1, step: 0.05, unit: 'share' },
    crisisCalm: { label: 'Calm voice, person in crisis', help: 'Score points an officer with a calm voice or negotiation training adds with a person in crisis.', min: 0, max: 15, step: 0.5, unit: 'points' },
    crisisUrgent: { label: 'Rushing a person in crisis', help: 'Score points an urgent choice adds with a person in crisis (negative: a penalty).', min: -15, max: 0, step: 0.5, unit: 'points' },
    ...each('awareness', { unaware: 'unaware of police', suspicious: 'suspicious', aware: 'knows police are here' },
      name => ({ label: `Surprise: ${name}`, help: 'Score points on watching and entries from how aware the subject is.', min: -10, max: 10, step: 0.5, unit: 'points' })),
    barricadeWait: { label: 'Waiting on a barricade', help: 'Score points waiting gets when the subject is barricaded and means no harm.', min: 0, max: 10, step: 0.5, unit: 'points' },
    barricadeSlow: { label: 'Barricade slows waiting', help: 'How much longer waiting takes when the subject is barricaded in and means no harm.', group: 'time', min: 1, max: 2, step: 0.05, unit: '×' },
    harmWait: { label: 'Waiting while someone may get hurt', help: 'Score points waiting gets per subject who may harm themselves or others (negative: a penalty).', min: -15, max: 0, step: 0.5, unit: 'points' },
    escapeWait: { label: 'Waiting while someone may slip away', help: 'Score points waiting gets when a subject means to escape.', min: -10, max: 0, step: 0.5, unit: 'points' },
    harmRate: unused(THREAT_DEAD_CALLER, 'Pressure from harm intent'),
    ...each('harmWaitCivilian', { harm_self: 'self-harm', harm_others: 'harm to others' }, name => unused(THREAT_DEAD_CALLER, `Civilian cost of waiting: ${name}`)),
    barricadeRate: unused(THREAT_DEAD_CALLER, 'Pressure from a barricade'),
  }),
  ...table('ENV_TUNING', { group: 'pressure', mode: 'dead' }, {
    ...each('light', { dusk: 'dusk', night: 'night', powerOff: 'power off' }, name => unused(ENV_NO_CALLER('lightFactor'), `Sightlines at ${name}`)),
    ...each('observationDifficulty', { dusk: 'dusk', night: 'night', powerOff: 'power off' },
      name => ({ label: `Watching in the dark: ${name}`, help: 'Difficulty points watching gains, for squads that can\'t read heat.', mode: 'live', min: 0, max: 8, step: 0.5, unit: 'points' })),
    ...each('strain', { powerOff: 'power off', gas: 'gas', biohazard: 'biohazard' }, name => unused(ENV_NO_CALLER('environmentStrain'), `Strain: ${name}`)),
    ...each('weatherSound', { clear: 'clear', rain: 'rain', wind: 'wind', fog: 'fog', snow: 'snow' }, name => unused(ENV_NOWHERE, `Sound carry: ${name}`)),
    ...each('weatherVisual', { clear: 'clear', rain: 'rain', wind: 'wind', fog: 'fog', snow: 'snow' }, name => unused(ENV_NOWHERE, `Visual carry: ${name}`)),
    ...each('clutter', { min: 'threshold', capacity: 'capacity loss', travel: 'extra travel' }, name => unused(ENV_NO_CALLER('clutterEffects'), `Clutter: ${name}`)),
    'fire.rateMult': unused(ENV_NO_CALLER('pressureDynamics'), 'Fire: pressure rate'),
    'fire.score': unused(ENV_NOWHERE, 'Fire: score'),
    'structural.difficulty': unused(ENV_NOWHERE, 'Structural damage: difficulty'),
    'biohazard.medicalDifficulty': unused(ENV_NOWHERE, 'Biohazard: medical difficulty'),
    ...each('communication', { language_barrier: 'language barrier', hearing_impaired: 'hearing impaired' }, name => unused(ENV_NO_CALLER('communicationPenalty'), `Talking: ${name}`)),
    calmVoiceShare: unused(ENV_NO_CALLER('communicationPenalty'), 'Calm voice share of a barrier'),
    'crowd.rate': unused(ENV_NO_CALLER('pressureDynamics'), 'Crowd: pressure rate'),
    'crowd.civilian': unused(ENV_NO_CALLER('pressureDynamics'), 'Crowd: civilian cost'),
    'crowd.outside': unused(ENV_NO_CALLER('crowdScore'), 'Crowd: work outside'),
    keyholderScore: unused(ENV_NOWHERE, 'Keyholder on scene'),
  }),
  ...table('OUTCOME_SCORE_V1', { group: 'debrief', mode: 'live' }, {
    everyoneOut: pair('Everyone out safe', 'Shared by the civilians who come out safe or are let go.'),
    ...Object.fromEntries((['held', 'trapped', 'bystander'] as const).flatMap(group => Object.entries({ inside: 'still inside', wounded: 'hurt', serious: 'badly hurt', killed: 'killed' })
      .map(([state, name]) => [`civilian.${group}.${state}`, pair(`${group === 'held' ? 'Held person' : group === 'trapped' ? 'Trapped person' : 'Bystander'} ${name}`, 'Scored per person, on top of losing their share of "Everyone out safe".')]))),
    'officer.wounded': pair('Officer hurt', 'Per officer hurt on the call.'),
    'officer.serious': pair('Officer badly hurt', 'Per officer badly hurt on the call.'),
    ...each('subject', { in_hand: 'in hand', inside: 'still inside', fled: 'fled', wounded: 'hurt', serious: 'badly hurt', killed: 'killed' }, name => pair(`Subject ${name}`, 'Per subject in this state at the end.')),
    'force.entry': pair('Entry on command\'s authority', 'Once per call when the team went in: the entry goes to review.'),
    'force.firearm': pair('Firearm used', 'Per firearm use, hit or miss: it goes to review.'),
    'force.lessLethal': pair('Less-lethal used', 'Per less-lethal use.'),
    'force.hands': pair('Taken by hand', 'Per person the team took by hand: no review, a struggle the team carries home.'),
    'commitments.kept': pair('Promise kept', 'Per promise command kept.'),
    'commitments.broken': pair('Promise broken', 'Per promise the team went back on.'),
    'time.longAt': { label: 'Long call from', help: 'Operation minutes from which a call counts as long.', group: 'time', min: 15, max: 120, step: 5, unit: 'min' },
    'time.long': pair('Long call', 'Once for a long call.'),
    'factor.base': { label: 'Reward baseline', help: 'The rewards factor (funding, experience, development points, trust) before the call\'s trust points and progress.', min: 0.5, max: 0.9, step: 0.01, unit: 'factor' },
    'factor.perPoint': { label: 'Reward per trust point', help: 'Added to the rewards factor per trust point the score lines add up to.', min: 0, max: 0.1, step: 0.005, unit: 'factor' },
    'factor.objective': { label: 'Reward for progress', help: 'Added to the rewards factor for how far the call got, against the middle.', min: 0, max: 0.5, step: 0.01, unit: 'factor' },
    'factor.unfinishedMax': { label: 'Unfinished cap', help: 'Most a call that isn\'t resolved can pay. Calls before v13 use the same cap.', min: 0, max: 1, step: 0.01, unit: 'factor' },
  }),
  ...table('AUTHORIZATION_V1', { group: 'harm', mode: 'structural' }, {
    believed: { label: 'Believed statuses', help: 'Knowledge statuses the team acts on.', why: 'Knowledge statuses the rules act on, not a number.' },
    'entry.rules': unused('authorize() hard-codes the rule order; this list is never read.', 'Entry rules'),
    'concessions.allowed': { label: 'Concessions allowed', help: 'What command lets the team give a subject.', why: 'Concession kinds are content (ConcessionKind and the command lines for each).' },
    'deadlyForce.guns': { label: 'Guns', help: 'Weapon kinds that count as a gun in hand.', why: 'A list of weapon kinds, not a number.' },
    'deadlyForce.inReach': { label: 'Weapons that need reach', help: 'Weapon kinds that count as a threat to life only within reach.', why: 'A list of weapon kinds, not a number.' },
    'deadlyForce.reachFt': { label: 'Within reach', help: 'Feet within which a blade or blunt weapon in hand counts as a threat to life, measured to the team\'s door and to anyone held or nearby.', mode: 'live', min: 0, max: 30, step: 1, unit: 'ft' },
  }),
  ...table('INCIDENT_CLASS_V1', { group: 'subjects', mode: 'live' }, {
    'hostage.waiting': { label: 'Hostage call: waiting', help: 'Score points on holding and waiting choices while someone is held as leverage. 0 leaves the threat rules alone.', min: -10, max: 5, step: 0.5, unit: 'points' },
    'hostage.agitation': { label: 'Hostage call: provoking the holder', help: 'Scale on the "more worked up" line when talking to the holder. 1 leaves it alone.', min: 0.5, max: 3, step: 0.05, unit: '×' },
    'victim.waiting': { label: 'Grievance hold: waiting', help: 'Score points on holding and waiting choices while someone is held over the subject\'s grievance (negative: time is no ally).', min: -10, max: 5, step: 0.5, unit: 'points' },
    'victim.agitation': { label: 'Grievance hold: provoking the holder', help: 'Scale on the "more worked up" line when talking to someone holding a person over a grievance.', min: 0.5, max: 3, step: 0.05, unit: '×' },
  }),
  ...table('INCOMING_FIRE_V1', { group: 'harm', mode: 'live' }, {
    ...each('hit', WEAPONS, name => ({ label: `Officer hit: ${name}`, help: 'Chance someone on the team is hit when a subject with this weapon attacks, for an ordinary hand at mid range. The engine clamps the final chance to floor and ceiling.', min: 0, max: 1, step: 0.01, unit: 'chance' })),
    ...each('proficiency', { untrained: 'untrained', some: 'some training', trained: 'trained' }, name => ({ label: `Shooter: ${name}`, help: 'Multiple on the hit chance for how practiced the attacker is.', min: 0.3, max: 2, step: 0.05, unit: '×' })),
    closeFt: { label: 'Close range', help: 'Feet from the team\'s door within which the hit chance rises.', min: 0, max: 20, step: 1, unit: 'ft' },
    closeMult: { label: 'Close-range multiple', help: 'Multiple on the hit chance at close range.', min: 1, max: 2, step: 0.05, unit: '×' },
    farFt: { label: 'Far range', help: 'Feet from the team\'s door beyond which the hit chance falls.', min: 10, max: 60, step: 1, unit: 'ft' },
    farMult: { label: 'Far-range multiple', help: 'Multiple on the hit chance at far range.', min: 0.3, max: 1, step: 0.05, unit: '×' },
    ...each('fromCover', { hard: 'hard cover', concealment: 'concealment' }, name => ({ label: `Firing from ${name}`, help: 'Multiple on the hit chance when the attacker is behind this.', min: 1, max: 2, step: 0.05, unit: '×' })),
    ...each('serious', WEAPONS, name => ({ label: `Badly hurt share: ${name}`, help: 'Of the hits with this weapon, the share that badly hurt the officer.', min: 0, max: 1, step: 0.01, unit: 'share' })),
    floor: { label: 'Hit chance floor', help: 'Lowest hit chance for a real weapon after every multiple.', min: 0, max: 0.5, step: 0.01, unit: 'chance' },
    ceiling: { label: 'Hit chance ceiling', help: 'Highest hit chance after every multiple.', min: 0.5, max: 1, step: 0.01, unit: 'chance' },
  }),
  ...table('TEAM_FORCE_V1', { group: 'harm', mode: 'live' }, {
    'rangeFt.less_lethal_device': { label: 'Less-lethal device range', help: 'Feet from the team\'s door within which the device works.', min: 0, max: 40, step: 1, unit: 'ft' },
    'rangeFt.less_lethal_impact': { label: 'Impact launcher range', help: 'Feet from the team\'s door within which the launcher works.', min: 0, max: 120, step: 5, unit: 'ft' },
    bystanderFt: { label: 'Too close for less-lethal', help: 'Feet within which someone held, a hostage or a child near the person rules less-lethal out (the team uses hands).', min: 0, max: 20, step: 1, unit: 'ft' },
  }),
  ...table('CASCADE_V1', { group: 'subjects', mode: 'live' }, {
    base: { label: 'Groups follow a surrender', help: 'Base chance a group member follows a leader who gives up, before influence, rapport and agitation.', min: 0.05, max: 0.6, step: 0.01, unit: 'chance' },
    influence: { label: 'Per unit of influence', help: 'Added per unit of how strongly the leader holds the member (0 to 1).', min: 0, max: 1, step: 0.05, unit: 'chance' },
    rapport: { label: 'Per point of rapport', help: 'Added per point of the member\'s rapport with the team.', min: 0, max: 0.02, step: 0.001, unit: 'chance' },
    agitation: { label: 'Per point of agitation', help: 'Taken off per point of agitation above the pivot (added below it).', min: 0, max: 0.02, step: 0.001, unit: 'chance' },
    agitationPivot: { label: 'Agitation pivot', help: 'Agitation at which agitation neither helps nor hurts.', min: 0, max: 100, step: 5, unit: 'agitation' },
    influenceDefault: { label: 'Influence with no group drawn', help: 'Influence for a member with no group drawn.', min: 0, max: 1, step: 0.05, unit: 'influence' },
    floor: { label: 'Follow chance floor', help: 'Lowest follow chance.', min: 0, max: 0.5, step: 0.01, unit: 'chance' },
    ceiling: { label: 'Follow chance ceiling', help: 'Highest follow chance.', min: 0.5, max: 1, step: 0.01, unit: 'chance' },
  }),
  ...table('METERS_V1', { group: 'subjects', mode: 'live' }, {
    ...Object.fromEntries(Object.entries(EVENTS).flatMap(([event, name]) => [
      [`events.${event}.agitation`, { label: `${name[0].toUpperCase()}${name.slice(1)}: agitation`, help: 'Agitation this event moves a shifting subject by (volatility scales it).', min: -30, max: 30, step: 1, unit: 'points' }],
      [`events.${event}.rapport`, { label: `${name[0].toUpperCase()}${name.slice(1)}: rapport`, help: 'Rapport this event moves a shifting subject by (volatility scales it).', min: -30, max: 30, step: 1, unit: 'points' }],
    ])),
    ...each('volatility', { steady: 'steady', shifting: 'shifting', volatile: 'volatile' }, name => ({ label: `Volatility: ${name}`, help: 'Multiple on every event\'s move for a subject drawn this volatile.', min: 0, max: 3, step: 0.05, unit: '×' })),
    'odds.rapport': { label: 'Talk pays: rapport', help: 'Score points per point of rapport gained since the call began, on talking to the subject.', min: 0, max: 1, step: 0.01, unit: 'points' },
    'odds.agitation': { label: 'Talk pays: agitation', help: 'Score points per point of agitation shed since the call began (lost per point gained).', min: 0, max: 1, step: 0.01, unit: 'points' },
    minContribution: { label: 'Smallest meter line', help: 'A meter change worth less than this many points adds no line to the odds.', min: 0, max: 5, step: 0.5, unit: 'points' },
    'stance.breakingAgitation': { label: 'Breaking at agitation', help: 'A moved subject sounds like they are breaking at this agitation or more.', min: 0, max: 100, step: 1, unit: 'agitation' },
    'stance.yieldingRapport': { label: 'Yielding at rapport', help: 'A moved subject sounds like they are yielding at this rapport or more, with agitation below "Yielding below agitation".', min: 0, max: 100, step: 1, unit: 'rapport' },
    'stance.yieldingAgitationBelow': { label: 'Yielding below agitation', help: 'Agitation a yielding subject stays below.', min: 0, max: 100, step: 1, unit: 'agitation' },
    'stance.volatileAgitation': { label: 'Volatile at agitation', help: 'A moved subject sounds volatile at this agitation or more.', min: 0, max: 100, step: 1, unit: 'agitation' },
    'stance.tenseAgitation': { label: 'Tense at agitation', help: 'A moved subject sounds tense at this agitation or more; below it, calm.', min: 0, max: 100, step: 1, unit: 'agitation' },
  }),
  ...table('ECONOMY_TUNING', { group: 'economy', mode: 'department' }, {
    capMs: { label: 'Accrual stops after', help: 'Income and costs stop accruing this long after the player\'s last command.', min: 3_600_000, max: 172_800_000, step: 3_600_000, unit: 'ms' },
    baseAllocation: { label: 'Allocation', help: 'Funding the department gets per hour.', min: 0, max: 2000, step: 10, unit: 'per hour' },
    patrolPerOfficer: { label: 'Patrol income', help: 'Funding per available officer in a squad on patrol, per hour.', min: 0, max: 500, step: 5, unit: 'per hour' },
    facilities: { label: 'Facilities cost', help: 'Funding spent on facilities per hour.', min: 0, max: 500, step: 5, unit: 'per hour' },
    supplies: { label: 'Supplies cost', help: 'Funding spent on routine supplies per hour.', min: 0, max: 500, step: 5, unit: 'per hour' },
    devPointsPerHour: { label: 'Development points', help: 'Development points per hour; most come from calls.', min: 0, max: 2, step: 0.05, unit: 'per hour' },
    ...each('recoveryPerHour', { rest: 'resting', standby: 'on standby', patrol: 'on patrol' }, name => ({ label: `Stress recovery ${name}`, help: 'Stress an officer sheds per hour on this duty.', group: 'strain', min: 0, max: 15, step: 0.5, unit: 'per hour' })),
    reportMinMs: { label: 'Shift report from', help: 'A settlement shorter than this makes no shift report unless something notable happened.', mode: 'display', min: 60_000, max: 3_600_000, step: 60_000, unit: 'ms' },
    restockIntervalMs: { label: 'Restock interval', help: 'Restock rules run on this grid of the clock.', min: 600_000, max: 14_400_000, step: 600_000, unit: 'ms' },
  }),
  ...table('EQUIPMENT_TUNING', { group: 'economy', mode: 'department' }, {
    wearRateMin: { label: 'Slowest wear rate', help: 'Each unit\'s wear rate is drawn between the slowest and fastest when it is made, and stored.', mode: 'new-entities', min: 0.3, max: 1.5, step: 0.05, unit: '×' },
    wearRateMax: { label: 'Fastest wear rate', help: 'See "Slowest wear rate".', mode: 'new-entities', min: 0.5, max: 2, step: 0.05, unit: '×' },
    salvageRate: { label: 'Salvage return', help: 'Share of the purchase price scrapping a unit returns.', min: 0, max: 0.5, step: 0.01, unit: 'share' },
    goodAtOrAbove: { label: 'Reads "Good" from', help: 'Condition at or above which a working unit reads "Good"; below, "Worn". Labels only.', mode: 'display', min: 50, max: 100, step: 1, unit: 'condition' },
  }),
  ...table('RECRUIT_TUNING', { group: 'economy', mode: 'new-entities' }, {
    basePool: { label: 'Candidates in the pool', help: 'Candidates on offer before development adds more.', mode: 'department', min: 1, max: 8, step: 1, unit: 'candidates' },
    lifetimeMs: { label: 'Candidate stays', help: 'How long an unshortlisted candidate stays available, set when drawn.', min: 3_600_000, max: 604_800_000, step: 3_600_000, unit: 'ms' },
    signingHours: { label: 'Signing cost', help: 'Signing cost in hours of the candidate\'s wage, set when drawn.', min: 0, max: 96, step: 1, unit: 'hours' },
    refreshCooldownMs: { label: 'Free search cooldown', help: 'Time between free candidate searches.', mode: 'department', min: 600_000, max: 86_400_000, step: 600_000, unit: 'ms' },
    rookiePenalty: { label: 'Rookie rating penalty', help: 'Rating points taken off a rookie candidate\'s ratings, set when drawn.', min: 0, max: 20, step: 1, unit: 'rating' },
    rookieService: unused('Read nowhere: prior service is rolled separately.', 'Rookie prior service', 'economy'),
    wagePerThreeYears: { label: 'Wage per 3 service years', help: 'Hourly wage added per 3 years of prior service, set when drawn.', min: 0, max: 5, step: 0.5, unit: 'per hour' },
    wageExperienceCap: { label: 'Experience wage cap', help: 'Most hourly wage prior service adds.', min: 0, max: 20, step: 1, unit: 'per hour' },
    signingPerServiceYear: { label: 'Signing fee per service year', help: 'Signing cost added per year of prior service, set when drawn.', min: 0, max: 100, step: 5, unit: 'funding' },
  }),
];

/** Tables the lab lists read-only, with why. They aren't wrapped with tunable() in v1. */
export const READONLY_TABLES: readonly { name: string; values: unknown; mode: 'generation' | 'cached' | 'load-time'; why: string }[] = [
  { name: 'LOCATION_TUNING', values: LOCATION_TUNING, mode: 'cached', why: 'Baked into the building cache, which has no clear function.' },
  { name: 'STRESS_BANDS', values: STRESS_BANDS, mode: 'load-time', why: 'Copied at load time into COMMAND_STAFF, so a change would leave the two apart.' },
  { name: 'COMMAND_STAFF', values: COMMAND_STAFF, mode: 'load-time', why: 'Copied at load time from STRESS_BANDS and EQUIPMENT_MANAGER.' },
  { name: 'EQUIPMENT_MANAGER', values: EQUIPMENT_MANAGER, mode: 'load-time', why: 'Its node id is copied at load time into COMMAND_STAFF, and its benefit numbers come from the development tree (DEV_NODES), not this table.' },
  { name: 'TIER_REWARD_MULTIPLIERS', values: TIER_REWARD_MULTIPLIERS, mode: 'generation', why: 'Changes generated calls. Edit the content and deliberately recapture current fingerprints.' },
  { name: 'IDENTITY_DEFAULT', values: IDENTITY_DEFAULT, mode: 'generation', why: 'Changes generated calls. Edit the content and deliberately recapture current fingerprints.' },
  { name: 'COVER_REACH', values: COVER_REACH, mode: 'generation', why: 'Cover is found when a call is generated and baked into it. Edit sim/cover.ts and deliberately recapture current fingerprints.' },
];
