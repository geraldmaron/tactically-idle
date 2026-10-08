import type { ActionDefinition, ActionRequirements, CheckKind, ConcessionKind, IncidentType, MeterStance, PressureModel, RatingWeight } from '../../sim/scenario-types';
import type { CompletionDisposition, OutcomeBand, RoomType, StageId } from '../../sim/types';

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
  safe?: string[];
  notSafe?: string[];
  /** The size of a counted group, which is fixed per call: the compiler keeps this outcome, prompt
   * variant or choice only in calls where `role` (a key of `CallTree.groups`) has at least `min`
   * and at most `max` members. Write every line that names the group behind one. */
  count?: { role: string; min?: number; max?: number };
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
  place?: 'scene' | 'outside' | 'offsite' | { rooms: RoomType[] };
  /** Roles in one group share a drawn surname (a couple, a parent and child). */
  surnameGroup?: string;
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
  /** A fixed truth for every situation. Otherwise every situation sets it. */
  truth?: boolean;
  /** Once the team believes this claim (reported or confirmed), it is a threat to life the team
   * has seen (sim/authorization.ts). The phrase completes "Command approves it because …". */
  threat?: string;
}

/** One coherent situation: the hidden answers for this call. Drawn per call (recipe variant 0 to 2). */
export interface TreeSituation {
  /** Authoring note, never shown. */
  note: string;
  truth: Record<string, boolean>;
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
  promise?: { id: string; to: string; kind?: ConcessionKind | 'promise' };
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
  /** Extra operation minutes on top of the choice's own minutes. */
  minutes?: number;
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
   * only, never a group. */
  walks?: string;
  /** Offered only in this public state. */
  onlyIf?: TreeState;
  requires?: Pick<ActionRequirements, 'certs' | 'anyTags' | 'allTags' | 'minSquads'>;
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

export interface TreeNode {
  id: string;
  stage: StageId;
  /** The situation the player faces at this node. */
  prompt: string;
  /** Replaces `prompt` in that public state; the first match wins. */
  promptIf?: { when: TreeState; prompt: string }[];
  choices: TreeChoice[];
}

export interface TreeEnding {
  title: string;
  summary: string;
  /** The author's intent; the debrief scores disposition, trust and strain from people's end
   * states (sim/outcome-score.ts), and a gate checks they agree. */
  disposition: CompletionDisposition;
  remainingTasks?: string[];
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
  rewards: { funding: number; devPoints: number; trust: number; xp: number };
  squads: { min: number; max: number };
}
