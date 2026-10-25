// Who the "People inside" panel shows, and how: the cast strip's rules (docs/cast-strip.md).
// A person gets a row of their own when they are the subject or leader, the stage's prose names
// them, they need care, or the player pinned them, four rows at most. Everyone else folds into one
// row per group with a count. How the team knows someone is a ladder (reported, heard, seen) that
// never falls: if the prose has named a person, the panel never says less than the prose showed.
import type { OperationRun } from '../../sim/types';
import type { IncidentPersonDef, ScenarioDefinition } from '../../sim/scenario-types';
import { civilianOutcomeViews } from '../../sim/incident-consequences';
import { stanceOf, type Stance } from '../../sim/meters';

export type Evidence = 'unlocated' | 'reported' | 'heard' | 'seen';
export const EVIDENCE_RANK: Record<Evidence, number> = { unlocated: 0, reported: 1, heard: 2, seen: 3 };
export const EVIDENCE_WORD: Record<Evidence, string> = { unlocated: 'Not located', reported: 'Reported', heard: 'Heard', seen: 'Seen' };

/** Rows a cast shows for individuals; groups come on top of these. */
export const MAX_ROWS = 4;
/** Three or more people of one kind that earned no row fold into a group row. */
const FOLD_AT = 3;

export interface CastMember {
  id: string;
  label: string;
  side: 'subject' | 'civilian';
  /** The person's own job or place, from the briefing's "who they are". */
  role?: string;
  stake?: string;
  background?: string;
  evidence: Evidence;
  stance?: Exclude<Stance, 'unheard'>;
  /** Civilian outcome while the call runs (sim/incident-consequences.ts). */
  status?: ReturnType<typeof civilianOutcomeViews>[number]['status'];
  out: boolean;
  hurt: boolean;
  named: boolean;
  leader: boolean;
  groupKey: string;
  groupLabel: string;
  /** The subject who leads this member's group, for "Follow Marcus". */
  follows?: string;
}

export interface CastGroup {
  key: string;
  label: string;
  side: 'subject' | 'civilian';
  follows?: string;
  members: CastMember[];
  counts: Record<Evidence | 'out', number>;
}

export interface Cast {
  rows: CastMember[];
  groups: CastGroup[];
  inside: number;
  out: number;
  /** Everyone the panel knows, rows and group members, for the pin list. */
  all: CastMember[];
}

/** What the live screen's prose says right now: the stage's prompt and the lines spoken with it. */
export interface CastProse { prompt: string; exchange?: { speaker: string; line: string }[] }

const GROUP_LABEL: Record<IncidentPersonDef['kind'], string> = {
  subject: 'The others', hostage: 'People held', victim: 'People hurt', trapped: 'People trapped', bystander: 'Bystanders', reporting_party: 'Callers', animal: 'Animals',
};

const firstName = (label: string) => label.trim().split(/\s+/)[0] ?? '';
const mentions = (text: string, name: string) => !!name && new RegExp(`(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(text);

// What the screen has already shown stays shown: the highest rung each person has reached, per run.
const reached = new Map<string, Map<string, Evidence>>();
function remember(runId: string, id: string, evidence: Evidence): Evidence {
  let seen = reached.get(runId);
  if (!seen) reached.set(runId, seen = new Map());
  const before = seen.get(id);
  if (before && EVIDENCE_RANK[before] > EVIDENCE_RANK[evidence]) return before;
  seen.set(id, evidence);
  return evidence;
}

/** Pins live per run for as long as the page does; a pin is a wish for a row, never saved. */
const pinned = new Map<string, Set<string>>();
export const pinsOf = (runId: string): Set<string> => {
  let set = pinned.get(runId);
  if (!set) pinned.set(runId, set = new Set());
  return set;
};

const OUT = new Set(['safe', 'care_accepted', 'accounted_elsewhere']);

export function buildCast(scenario: ScenarioDefinition, run: OperationRun, prose?: CastProse, pins: ReadonlySet<string> = new Set()): Cast {
  const defs = new Map((scenario.incidentPeople ?? []).map((person) => [person.id, person]));
  const who = new Map((scenario.briefing.people ?? []).map((person) => [person.personId, person]));
  const spoken = new Set((prose?.exchange ?? []).map((line) => firstName(line.speaker).toLowerCase()));
  const text = [prose?.prompt ?? '', ...(prose?.exchange ?? []).map((line) => line.line)].join(' ');
  const leaders = new Map((scenario.incidentPeople ?? []).filter((person) => person.group?.role === 'leader').map((person) => [person.group!.id, person.label]));
  const known = (id: string | undefined) => (id ? run.knowledge[id] : undefined);

  const lift = (id: string, label: string, base: Evidence): { evidence: Evidence; named: boolean } => {
    const name = firstName(label);
    const named = mentions(text, name);
    let evidence = base;
    if (spoken.has(name.toLowerCase()) && EVIDENCE_RANK[evidence] < EVIDENCE_RANK.heard) evidence = 'heard';
    if (named && EVIDENCE_RANK[evidence] < EVIDENCE_RANK.seen) evidence = 'seen';
    return { evidence: remember(run.id, id, evidence), named };
  };
  const detail = (id: string) => {
    const entry = who.get(id);
    return { role: entry?.role, stake: entry?.stake, background: entry?.text };
  };

  const members: CastMember[] = [];
  for (const [id, meters] of Object.entries(run.meters ?? {})) {
    const stance = stanceOf(meters);
    const def = defs.get(id);
    if (stance === 'unheard' || !def) continue;
    const seen = known(def.locationFactId) === 'confirmed';
    const { evidence, named } = lift(id, def.label, seen ? 'seen' : 'heard');
    const follower = def.group && def.group.role !== 'leader' && def.group.role !== 'lone';
    members.push({ id, label: def.label, side: 'subject', ...detail(id), evidence, stance, out: run.flags.includes(`out:${id}`), hurt: false, named,
      leader: !follower, groupKey: follower ? `s:${def.group!.id}` : id, groupLabel: GROUP_LABEL.subject, ...(follower ? { follows: leaders.get(def.group!.id) } : {}) });
  }
  for (const person of civilianOutcomeViews(scenario, run)) {
    const def = defs.get(person.id);
    const out = OUT.has(person.status);
    const base: Evidence = person.status === 'unaccounted' ? 'unlocated' : person.status === 'reported' ? 'reported' : 'seen';
    const { evidence, named } = lift(person.id, person.label, base);
    const kind = def?.kind ?? 'bystander';
    members.push({ id: person.id, label: person.label, side: 'civilian', ...detail(person.id), evidence, status: person.status, out, named,
      hurt: person.status === 'injured_needs_care' || person.status === 'deceased', leader: false, groupKey: `c:${kind}`, groupLabel: GROUP_LABEL[kind] });
  }

  const live = members.filter((member) => !member.out);
  const priority = (member: CastMember) => member.leader && member.side === 'subject' ? 0 : pins.has(member.id) ? 1 : member.hurt ? 2 : member.named ? 3 : 9;
  const earned = live.filter((member) => priority(member) < 9).sort((a, b) => priority(a) - priority(b));
  const rows = earned.slice(0, MAX_ROWS);
  const rest = members.filter((member) => !rows.includes(member));

  const byGroup = new Map<string, CastMember[]>();
  for (const member of rest) byGroup.set(member.groupKey, [...(byGroup.get(member.groupKey) ?? []), member]);
  const groups: CastGroup[] = [];
  for (const [key, list] of byGroup) {
    const open = list.filter((member) => !member.out);
    // One or two people left over, with a row to spare, stand on their own; anything else is a group row.
    if (open.length && open.length < FOLD_AT && list.length === open.length && rows.length + open.length <= MAX_ROWS) { rows.push(...open); continue; }
    const counts = { out: 0, unlocated: 0, reported: 0, heard: 0, seen: 0 } as CastGroup['counts'];
    for (const member of list) counts[member.out ? 'out' : member.evidence]++;
    groups.push({ key, label: list[0].groupLabel, side: list[0].side, follows: list[0].follows, members: list, counts });
  }
  groups.sort((a, b) => (a.side === b.side ? 0 : a.side === 'subject' ? -1 : 1));
  rows.sort((a, b) => (a.side === b.side ? 0 : a.side === 'subject' ? -1 : 1));
  return { rows, groups, inside: live.length, out: members.length - live.length, all: members };
}
