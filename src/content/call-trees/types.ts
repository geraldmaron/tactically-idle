import type { ActionDefinition, ActionRequirements, CheckKind, ConcessionKind, IncidentType, MeterStance, PressureModel, RatingWeight } from '../../sim/scenario-types';
import type { CompletionDisposition, OutcomeBand, RoomType, StageId } from '../../sim/types';
import type { ContentDescriptor } from '../content-descriptors';

/** Call trees (content v13, docs/call-trees-v13.md).
 *
 * A call is a tree of decision nodes. Each node offers two or three choices that exclude each
 * other: taking one leaves the node, so its siblings are gone. Each outcome band of a choice
 * names where the call goes next, so the dice and the hidden truth change the path, not only a
 * number. A `turn` group draws one of several authored nodes per call, so the same call plays
 * differently from one game to the next.
 *
 * People are roles, never names. Prose writes `{courier}` (full name), `{courier.first}` or
 * `{courier.last}`, and the compiler binds a drawn identity to each role per call. Engine keys
 * (people, facts, flags) use the role id, so nothing in the data is named after a character.
 * `{place}` is the building's name, `{scene}` the scene room ("back office"), `{role.room}` the
 * room a person starts in. `{lead}` is left for the engine (the lead officer's surname, in choice
 * summaries only).
 *
 * Groups (docs/incident-domain-model.md, M2 slice 5). A counted role (`CallTree.groups`, for
 * example `others`) names everyone a template slot draws past its key roles. Its size is fixed per
 * call, from 0 up. Prose writes `{others}` (first names: "Sol", "Sol and Ines", "Sol, Ines and
 * Rae"), `{others.first}` and `{others.last}` (the first member), `{others.n}` (the count in words),
 * the pronoun forms `{others.he}`, `{others.him}` and the rest (the one member's pronoun, or plural
 * they), and two kinds of verb agreement: after the names, `{others#stands|stand}` (one name takes
 * the first form, whoever it is: "Sol stands", "Sol and Ines stand"); after a pronoun,
 * `{others~stands|stand}` (the first form only for one member drawn he or she: "she stands", "they
 * stand"). `{others^man|woman|person}` binds only with one member. Text that names a group sits
 * behind a count condition, so a lone call never binds it: a group token in a call with no members
 * is an authoring error.
 */

/** Public state an outcome line or prompt can depend on: earlier marks, and who is already out.
 * `safe` and `notSafe` can name a group: every member is safe, or none is. */
export interface TreeState {
  marks?: string[];
  notMarks?: string[];
  /** Who the team brought (sim/crew.ts): a trait ('observant', 'calm_voice', 'impatient', 'rookie',
   * 'mentor', 'steady') or an experience band ('band_veteran') some deployed officer has. Settled
   * when the call starts, so a choice behind it is simply there or not for this team. */
  crew?: string[];
  notCrew?: string[];
  /** Who leads the decision being resolved (sim/crew.ts leadFlags): the same trait and band names,
   * for the one officer the player sent. Read in outcome `when` only, so a result can be written for
   * the rookie who got seen at the glass or the calm voice who bought a minute. */
  lead?: string[];
  notLead?: string[];
  safe?: string[];
  notSafe?: string[];
  /** The size of a counted group, which is fixed per call: the compiler keeps this outcome, prompt
   * variant or choice only in calls where `role` (a key of `CallTree.groups`) has at least `min`
   * and at most `max` members. Write every line that names the group behind one. */
  count?: { role: string; min?: number; max?: number };
  /** How many of a counted group's members hold a weapon a look would see, fixed per call like
   * `count` (R-G1): the compiler keeps this outcome, prompt variant or choice only in calls where
   * at least `min` (default 1) of `role`'s members do. It reads the drawn cast, which the team
   * doesn't know, so the same state must list in `marks` a mark set only on favorable results of
   * choices that look into the group's room, the results on which the team sees what they hold. */
  armed?: { role: string; min?: number };
  /** Roles whose starting room is above the ground floor in this call (R-B1), settled when it
   * compiles from the building, like `count`: text that says "upstairs" goes behind it.
   * `notUpstairs`: roles whose room is on the ground floor. A group means its leader's room. */
  upstairs?: string[];
  notUpstairs?: string[];
  /** Holds where `role` has that way out of their starting room in this call (R-B2, R-R5), settled
   * when it compiles from the building like `count`: 'window' needs an exterior window of their
   * ground-floor room wide enough to climb. A `walksVia` choice carries it. */
  exitVia?: { role: string; via: 'window' | 'front' | 'back' };
}

/** A counted role: the people a template slot draws past its key roles (content/incidents/types.ts
 * CastSlot), each a full engine person with the id `<group>_<n>`. Members are numbered by distance
 * from the door the team comes through, nearest first, so `{others.first}` is always the one
 * nearest the team. */
export interface TreeGroup {
  /** The template cast slot the members come from. */
  slot: string;
  /** The slot's first key role, who leads the group. Members start in this role's room. */
  leader: string;
  /** Plain role noun for one member ("friend"), for the map inspector, the debrief and the lab. */
  label: string;
}

export type TreePronouns = 'he' | 'she' | 'they';
export type TreeSetting = 'business' | 'residential' | 'apartment';

export interface TreeRole {
  /** Engine key and token name, lower snake case: a role ('courier'), never a name. */
  id: string;
  /** Plain role noun for the map inspector, debrief and Scenario Lab ('shop owner'). */
  label: string;
  /** Fallback pronouns when no incident template draws an identity. Prose never relies on them: it
   * writes pronoun, agreement and gendered-noun tokens ({role.he}, {role~keeps|keep},
   * {role^man|woman|person}), because identity is drawn per call (content/incidents/types.ts). */
  pronouns: TreePronouns;
  /** civilian: someone the team must get out safely. subject: the person the team was called about.
   * bystander: someone already outside with patrol (family at the tape); never a go-between. */
  kind: 'civilian' | 'subject' | 'bystander';
  /** Where the person starts: the scene room (default), another room by type preference, or
   * outside with patrol. A bystander is always outside. 'offsite': outside the building altogether
   * (the shooter across the street): named in prose, never placed on the map. */
  place?: 'scene' | 'outside' | 'offsite' | { rooms: RoomType[];
    /** Which floor that room may be on (R-B1): 'ground' (default), 'upper' (above the ground
     * floor only: a building without one can't host the call), or 'any'. The route out walks the
     * stairs. Text that says where they are goes behind TreeState.upstairs or notUpstairs. */
    floor?: 'ground' | 'upper' | 'any' };
  /** Roles in one group share a drawn surname (a couple, a parent and child). */
  surnameGroup?: string;
  /** Who they are before today (the briefing's "Who they are", depth gate D10): one to three
   * sentences of past the player can see, never the private logic and never a hidden truth. */
  profile?: string;
  /** 'chair': this person leaves only along a step-free route wide enough for a wheelchair. */
  mobility?: 'walking' | 'chair';
  /** A carried prop shown on the map once the named public fact is reported. */
  carries?: { label: string; glyph: 'phone' | 'document' | 'keys' | 'weapon' | 'item'; knownFrom: string };
}

export interface TreeFact {
  /** Debrief and facts-panel label. */
  label: string;
  /** The unsettled claim, as a plain sentence. */
  claim: string;
  confirmed: string;
  disproved: string;
  /** Public facts are on the card from the start as reported; hidden facts stay off it until a choice settles them. */
  public?: boolean;
  /** Who reported a public fact ('Responding patrol'). */
  source?: string;
  /** A fixed truth for every situation. Otherwise every situation sets it, or the building does
   * (`sightline`). */
  truth?: boolean;
  /** The building settles this truth, not the situation: whether `from` (an offsite role, placed
   * by the template's `vantage`) can see the door `to`'s way out leaves the building by (compile.ts,
   * sim/spatial-factors.ts sightToOpening). Situations leave it out; it holds on one building and
   * not the next. */
  sightline?: { from: string; to: string };
  /** Once the team believes this claim (reported or confirmed), it is a threat to life the team
   * has seen (sim/authorization.ts). The phrase completes "Command approves it because …". */
  threat?: string;
}

/** One coherent situation: the hidden answers for this call. Drawn per call (recipe variant 0 to 2). */
export interface TreeSituation {
  /** Authoring note, never shown. */
  note: string;
  truth: Record<string, boolean>;
  /** What a player can meet in this situation (docs/content-rating.md), from the closed list. The
   * board leaves out a situation carrying a descriptor the player turned off. The list holds every
   * descriptor the tree derives here (`death`, `injury`, `police_gunfire`; gates/content-descriptors.ts
   * fails when one is missing) plus the themes the data can't see, declared by the designer through
   * the swat-call-design ethics screen (`suicide_self_harm`, `child_at_risk`, `domestic_violence`). */
  descriptors?: ContentDescriptor[];
  /** Why an adult subject this situation spares with `noFatal` force is not at risk of harming
   * themselves, when `descriptors` leaves out `suicide_self_harm` (the E4 screen's "screened,
   * <reason>"). Authoring record, never shown. */
  selfHarmScreened?: string;
}

/** Where an outcome sends the call: a node, an ending, or one node of a turn group drawn per call. */
export type TreeNext = { node: string } | { ending: string } | { turn: string };

/** An engine-only branch: a hidden fact, or a clock (content/incidents/types.ts) read at the end
 * of this choice's own minutes. `low`: its first cue has fired. `out`: it has run out (the door
 * gives, the tank is empty, the owner collapses). A clock never runs out before the team heard one
 * of its cues in an earlier decision, and a clock this call doesn't have is never low or out.
 *
 * Or a subject's meters (sim/meters.ts) as they stand at the start of the decision: `meter` is the
 * subject's role, and the test holds when their stance is one of `stance` and their agitation is at
 * least `agitationAtLeast` (each when given, at least one). `is: false` negates it. Someone with no
 * meters never matches. Conditions in one `if` all hold together, so escalation that either the
 * hidden truth or a subject past breaking point sets off is two routed outcomes, plus the calm one
 * that needs both to be false:
 *
 *   { if: { fact: 'raised', is: true }, text: escalation, next },
 *   { if: [{ fact: 'raised', is: false }, { meter: 'taker', stance: 'breaking' }], text: escalation anyway, next },
 *   { if: [{ fact: 'raised', is: false }, { meter: 'taker', stance: 'breaking', is: false }], text: calm, next },
 */
export type TreeIf = { fact: string; is: boolean } | { clock: string; low: boolean } | { clock: string; out: boolean }
  | { meter: string; stance?: MeterStance | MeterStance[]; agitationAtLeast?: number; is?: boolean };

/** One spoken line of a transcript (call-surfaces): who says it and the words, with no quotation
 * marks and no speaker tag in the line. `by` is a role (or a group, meaning its first member), or
 * one of the voices the call always has: 'negotiator', 'radio' or 'dispatch'. The UI prints the
 * speaker's name beside the line. Two to four lines make an exchange. */
export interface TreeLine { by: string; line: string }
// The negotiator is the lead officer on the line: the engine fills {lead} with their surname.
export const TREE_VOICES = { negotiator: '{lead}', radio: 'Radio', dispatch: 'Dispatch' } as const;

/** Standard events that move a subject's agitation and rapport (sim/meters.ts). */
export type TreeMove = 'heard' | 'contact' | 'honest' | 'provoked' | 'team_seen' | 'shots' | 'released';

export interface TreeOutcome {
  /** Engine-only branch on hidden truth or a clock, read when the decision commits. Never
   * previewed. Several conditions must all hold. */
  if?: TreeIf | TreeIf[];
  /** Applies only in this public state (for example, only while someone is still inside). */
  when?: TreeState;
  /** Result line the player reads, present tense. */
  text: string;
  /** Where the call goes. An outcome without `next` is an addendum: extra text and effects
   * beside the one routed outcome that applies on this band, truth and state. */
  next?: TreeNext;
  /** Settle these facts against the hidden truth: the player learns the answer. */
  reveal?: string[];
  /** Tracked state that later prompts, choices and modifiers read. Every mark needs a reader. */
  mark?: string[];
  /** Command commits to something a person asked for (sim/commitments.ts): kept or broken by what
   * the team does to them afterwards. `id` is unique in the call; `to` is the role. */
  promise?: { id: string; to: string; kind?: ConcessionKind | 'promise' | 'lie' };
  /** Commitments this outcome breaks (deception-commitments): the person learns the promise was
   * empty. Write the discovery in `text`, so the break is never silent. A `lie` promise needs at
   * least one reachable outcome that breaks it. */
  breaks?: string[];
  /** Lines spoken in this result, shown under it as a transcript. */
  exchange?: TreeLine[];
  /** What this outcome does to a subject's agitation and rapport: the subject's role, and the
   * event. The engine scales it by the subject's volatility, and every later conversation with
   * them shows it on the card. Replaces mood marks like "stung" and "heard". A group moves every
   * member. */
  moves?: Record<string, TreeMove | TreeMove[]>;
  /** Civilian roles who are now outside and safe. A group is every member. */
  safe?: string[];
  /** Any role who walks out of the building on this path (a subject coming out to the team). A
   * group is every member. */
  out?: string[];
  /** People hurt or killed on this path, recorded in the debrief. Only on an outcome that ends the
   * call: after harm the engine refuses ordinary choices involving that person. A group is every
   * member. */
  harm?: Record<string, 'wounded' | 'serious' | 'fatal'>;
  /** An officer taking part is injured and out of action for hours after the call: for injuries
   * nobody fires (a fall, a struggle). For gunfire use `fire`. */
  officer?: 'wounded' | 'serious';
  /** The subject fires at the team. Whether an officer is hit, and how badly, is drawn when the
   * decision commits (sim/drawn-effects.ts) from the subject's weapon, hand, distance and cover, and
   * a standard line says so (content/incidents/lines.ts). The outcome's own text never narrates the
   * hit. `mark` is set when an officer is hit, for choices that need someone down. `from` a group is
   * its first member, the one nearest the door the team comes through (`{others.first}`). */
  fire?: { from: string; mark?: string };
  /** The team uses force on someone: less-lethal or firearm by gear, range and who is close, then a
   * drawn severity decides where the call goes, so the outcome carries no `next` of its own.
   * `noFatal` for a subject the self-harm screen covers (E4.5); minors are never killed anyway.
   * `on` a group is its first member (`{others.first}`). */
  force?: { on: string; next: { fatal?: TreeNext; hurt: TreeNext; none: TreeNext }; noFatal?: boolean };
  /** The leader gives up, and the group decides whether to follow (sim/drawn-effects.ts
   * CASCADE_V1). Each member still inside follows by a chance from how strongly the leader holds
   * them (influence), and their own rapport and agitation; followers come out (`out:`) and a
   * standard line names who followed and who stayed (content/incidents/lines.ts). The result routes
   * the call, so the outcome carries no `next`: `all` when everyone still inside followed (and in a
   * call with no members), `some`, or `none`. `leader` is the group's leader. */
  cascade?: { leader: string; group: string; next: { all: TreeNext; some: TreeNext; none: TreeNext } };
  objective?: number;
  civilian?: number;
  pressure?: number;
  /** Clocks this result holds steady (a template clock id, 'owner_condition'): a medic or a hand on
   * the person stops the clock where it stands, so it never runs out on this call. */
  stabilize?: string[];
  /** Extra operation minutes on top of the choice's own minutes. */
  minutes?: number;
  /** The team falls back: on this path the squad ends the choice where it started it, not where
   * the choice's `team` was taking it. Write it on every outcome whose text sends the team back. */
  back?: true;
  /** Moves people on the building (R-B3), after this outcome. A role moved anywhere in the call
   * can't be read by upstairs, notUpstairs or exitVia (those are about where they started), and
   * can't be a walker (`walks` leaves from where they started). */
  moveTo?: TreeMoveTo;
}

export interface TreeChoice {
  /** Unique within its node. The engine action id is `t13_<type>_<node>_<id>`. */
  id: string;
  title: string;
  summary: string;
  preview: Record<OutcomeBand, string>;
  icon: ActionDefinition['icon'];
  check: { kind: CheckKind; ratings: RatingWeight[]; difficulty?: number };
  /** Operation minutes the choice takes on the clean path. */
  minutes: number;
  stress?: number;
  /** Role spoken to. With the `deliberate_answers` pacing, talking to that role takes two extra
   * minutes. A group is its first member (`{others.first}`): put the choice behind a count. */
  talksTo?: string;
  /** Role who walks out along the exit route; the engine checks the doors on the way. A key role
   * only, never a group. Without `team: { to: 'escort' }` they come out on their own and the squad
   * stays where it is. */
  walks?: string;
  /** Which way out the walker goes (R-B2, shared with rescue's R-R5): 'window', their own room's
   * exterior window on the ground floor; 'front' or 'back', an exterior door (rescue builds these;
   * until then they are a compile error). Without it, the shortest way out. The choice must carry
   * `onlyIf: { exitVia: { role: walks, via } }`, so it is offered only where that way exists. */
  walksVia?: 'window' | 'front' | 'back';
  /** Where the team physically goes for this choice, on the generated building. Without it the
   * squad acts from where it stands (a phone call, a wait, a word over the hailer from the cars). */
  team?: TreeTeam;
  /** A second deployed squad supports the acting one from a named point (R-B4). It goes there on
   * the map and its coordination adds to the acting squad's check, less the farther it has to go.
   * The choice still works with one squad: support makes it better, never possible.
   * - `at: { vantage }`: the spot outside with an opening onto that room, as `team.to` vantage.
   * - `at: 'exit'`: just outside the door the scene room's way out leaves the building by.
   * `label` is the squad's task as the summary and the breakdown name it ("holding the front
   * window"); `max` is the most it adds, in score points. */
  support?: { at: { vantage: 'scene' | string } | 'exit'; label: string; max?: number };
  /** Offered only in this public state. */
  onlyIf?: TreeState;
  requires?: Pick<ActionRequirements, 'certs' | 'anyTags' | 'allTags' | 'minSquads'>;
  /** What draws a player to this choice, and what it costs, each one plain line shown with the
   * choice (the depth register, owner 2026-10-19). Both or neither. */
  pull?: string;
  cost?: string;
  /** The choice is a lie, or a promise command never approved (dilemma pattern 15, E12.6). The
   * card says command hasn't approved it. Its outcomes carry the `lie` promise they make. */
  deceives?: true;
  /** A certificate that makes this choice go better when an officer taking part holds it (resolution
   * credits the first holder): 'crisis_negotiation' on a talk, 'advanced_first_aid' on care.
   * `label` names it in the odds breakdown. Assets change how a call goes, not only whether. */
  certBonus?: ActionDefinition['certBonus'];
  /** What this choice asks command for (sim/authorization.ts): an entry, or a concession. The
   * engine locks it with the generated reason until the rule allows it, and the card carries the
   * generated command line, so the summary never says "Command approves it because …" itself. */
  authority?: 'entry' | { concede: ConcessionKind };
  equipment?: ActionDefinition['equipment'];
  capabilities?: ActionDefinition['capabilities'];
  consequenceLevel?: ActionDefinition['consequenceLevel'];
  tempo?: ActionDefinition['tempo'];
  /** A long hold that the results measure in hours: the card says this instead of minutes. */
  span?: 'Hours' | 'All night';
  /** Earlier choices that make this one more or less likely to go well (negative values hurt). */
  modifiers?: { label: string; mark: string; value: number }[];
  /** Per band, the outcomes that may apply. With `if`, exactly one applies on every truth. */
  outcomes: Record<OutcomeBand, TreeOutcome[]>;
}

/** A choice's physical intent (compile.ts turns it into the engine's approach). The squad moves
 * through the generated building, so every door on its route counts: a locked one costs time to
 * force or the entry tool, a blocked one refuses the move. Where it ends is where it stands for the
 * next decision, so a choice that narrates the team inside leaves it inside.
 *
 * - `to: 'scene'` or `{ room: role }`: into that room (the role's starting room), by the walking
 *   route from wherever the squad stands. Clearing the room takes longer the bigger it is.
 * - `to: { vantage: 'scene' | role }`: to a spot outside with an opening onto that room (the front
 *   glass, the back step).
 * - `to: 'escort'`: with `walks` only. The squad goes in to the person and comes out with them, and
 *   ends outside where they do.
 *
 * `entry`: the role the team moves in on. How far that person stands from the nearest door of their
 * room adds time, strain and risk to the entry.
 * `signal`: the squad works on someone from where it stands, by voice through the walls and
 * openings or by sight through them (`to` the role). The building decides how well it carries, and
 * the light and the weather decide how well a sightline reads. */
/** A place on the generated building a person can move to and the team can go to or watch (R-B3).
 * - `'scene'`: the scene room. `{ room: role }`: that role's starting room.
 * - `{ doorOf: role }`: just outside that role's room, at the door their way out leaves it by.
 * - `{ route: role; step; is }`: the `step`-th room along that role's way out (1: the first room
 *   past their own). The room changes with the building, so `is` declares what it must be: a
 *   building where it is another kind can't host the call. Text names it by the room token, never
 *   by a kind the building might not have. */
export type TreePlace = 'scene' | { room: string } | { doorOf: string } | { route: string; step: number; is: RoomType | RoomType[] };

/** Where an outcome or a clock cue moves a person (R-B3). Hidden unless `seen` (the line itself says
 * where they went): the team keeps where it last saw them until a look into the room they went to. */
export type TreeMoveTo = Record<string, TreePlace | { to: TreePlace; seen: true }>;

export interface TreeTeam {
  /** Absent: the squad stays where it stands and works from there (a hailer from the cars). A route
   * step or a door (TreePlace) can be entered like a role's room; `{ watch: step }` watches a route
   * step from outside, as `vantage` watches a role's room. */
  to?: 'scene' | 'escort' | { room: string } | { doorOf: string } | { route: string; step: number; is: RoomType | RoomType[] }
    | { vantage: 'scene' | string } | { watch: { route: string; step: number; is: RoomType | RoomType[] } };
  entry?: string;
  signal?: { channel: 'voice' | 'visual'; to: string };
}

export interface TreeNode {
  id: string;
  stage: StageId;
  /** The situation the player faces at this node. */
  prompt: string;
  /** Lines spoken as the player reaches this decision, shown with the prompt as a transcript. */
  exchange?: TreeLine[];
  /** Replaces `prompt` in that public state; the first match wins. Its `exchange` replaces the
   * node's when given (`[]` for none); without one the node's exchange shows. */
  promptIf?: { when: TreeState; prompt: string; exchange?: TreeLine[] }[];
  /** What gets worse while the player decides here (owner 2026-10-20: every decision point has one).
   * A choice whose time reaches `minutes`, travel and its band's delay included, lets it happen: the
   * line and its costs are added to that result. It raises costs and urgency; it never harms anyone,
   * fires, or sets a threat-to-life mark (E12.4), and it never routes. */
  threat?: TreeThreat;
  choices: TreeChoice[];
}

export interface TreeThreat {
  /** What happens, in a few words, shown with the prompt ("The count reaches zero"). */
  label: string;
  /** Minutes the player has here. */
  minutes: number;
  /** The line the player reads when it happens. */
  text: string;
  /** What it costs: marks later options read, moves on a subject's temper, pressure, civilian safety. */
  mark?: string[];
  moves?: Record<string, TreeMove | TreeMove[]>;
  pressure?: number;
  civilian?: number;
  /** The subject pushes back when the team stalls (docs/call-pressure.md, "Push-back lines"). Each
   * line is written for this subject and this moment, never drawn from a shared pool. Optional: a
   * threat without lines stays silent and its bar still drains. */
  pushback?: TreePushback[];
}

/** One push-back line on a threat. It fires once, when the stall the player spent on the decision
 * (dither minutes) reaches `at`, which is always before the threat itself lands (`at` below the
 * threat's `minutes`). It is spoken by a role or group, may set a mark later choices read, and
 * is never played in a situation that declares `suicide_self_harm`: nobody addresses the player's
 * absence where a person is at risk (E4). The line obeys swat-call-prose like any spoken line. */
export interface TreePushback {
  /** Unique within the threat. */
  id: string;
  /** Dither minutes at which it fires: above 0, below the threat's `minutes`. */
  at: number;
  /** The speaking role, or a group (its first member); never a voice like radio. */
  by: string;
  line: string;
  /** Marks it sets, readable by later choices. Never a threat-to-life mark. */
  mark?: string[];
}

export interface TreeEnding {
  title: string;
  summary: string;
  /** The author's intent; the debrief scores disposition, trust and strain from people's end
   * states (sim/outcome-score.ts), and a gate checks they agree. */
  disposition: CompletionDisposition;
  remainingTasks?: string[];
  /** What is true after the call, told as fiction may tell it (E11.2): true on every path that
   * reaches this ending, putting the cost or the grace on one named person. */
  epilogue?: string;
  /** Replaces `epilogue` in that public state at the end of the call (marks and who is out); the
   * first match wins. It carries a reframe into the after (review F19). */
  epilogueIf?: { when: TreeState; epilogue: string }[];
}

export interface CallTree {
  type: IncidentType;
  title: string;
  roles: TreeRole[];
  /** Counted roles (`{ others: { slot: 'subjects', leader: 'taker', label: 'friend' } }`): the
   * people a template slot draws past its key roles, 0 or more per call. */
  groups?: Record<string, TreeGroup>;
  /** Building types the scene fits; the board only draws the call to these. */
  families: string[];
  /** Marks that are a threat to life the team has seen (sim/authorization.ts), each with the
   * phrase that completes "Command approves it because …". */
  threatMarks?: Record<string, string>;
  /** The room the people are in, by room type in order of preference, and the building setting. */
  scene: { setting: TreeSetting | TreeSetting[]; rooms: RoomType[]; timeOfDay?: 'day' | 'dusk' | 'night'; crowd?: 0 | 1 | 2 };
  /** Card hook. */
  summary: string;
  /** The scene before the call, read once before the briefing: the place, the people and what
   * happened before the team was called (the depth register, owner 2026-10-19). */
  coldOpen?: string;
  pressureLabel: string;
  pressure: PressureModel;
  briefing: { dispatchReason: string; known: string[]; unknown: string[]; responsibilities: string[] };
  stageLabels: Record<StageId, string>;
  objectives: { id: string; label: string }[];
  facts: Record<string, TreeFact>;
  situations: [TreeSituation, TreeSituation, TreeSituation];
  /** Turn groups: one node per group is drawn per call. */
  turns?: Record<string, string[]>;
  /** The first node. */
  root: string;
  nodes: TreeNode[];
  /** Must include `handed_over` with disposition 'unresolved' (choices exhausted). */
  endings: Record<string, TreeEnding>;
  /** Base check difficulty is base + perTier x tier (default 31 + 3 x tier); a choice's
   * `check.difficulty` is added to it. Set from the balance gate, never by feel. */
  difficulty?: { base: number; perTier: number };
  rewards: { funding: number; trust: number; xp: number };
}
