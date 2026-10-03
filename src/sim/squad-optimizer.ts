// A bounded, deterministic arrangement suggestion. It only reads the department
// roster: no scenario, hidden truth, demographics, or random-number generator.
import type { CertId, GameState, HandlerResult, Id, Officer, RatingKey, SquadId } from './types';
import { SQUAD_IDS } from './types';
import { experienceBand, gameDay } from './calendar';
import { ECONOMY_TUNING, recoveryDuty, simNow, squadDeployed } from './economy';
import { deployability, highRiskAllowed, STRESS_BANDS, stressBand } from './officer';
import { CERT_LABEL, conditionFraction, EXPERIENCE_TUNING } from './resolution';

export interface SquadTopology {
  squads: { squadId: SquadId; officerIds: Id[]; leaderId: Id | null }[];
  unassignedIds: Id[];
}
export interface SquadOptimizerOptions {
  squadIds: SquadId[];
  includeUnassigned: boolean;
  preserveLeaders: boolean;
}
export interface SquadArrangementProposal {
  token: string;
  options: SquadOptimizerOptions;
  before: SquadTopology;
  after: SquadTopology;
}
export interface SquadArrangementState {
  officerLocks: Id[];
  squadLocks: SquadId[];
  undo?: { before: SquadTopology; after: SquadTopology };
}
export interface SquadArrangementSummary {
  squadId: SquadId;
  officerIds: Id[];
  leaderId: Id | null;
  fresh: number;
  deployable: number;
  unavailable: number;
  coverage: string[];
  gaps: string[];
  mentoring: string[];
}
export interface SquadArrangementPreview {
  proposal: SquadArrangementProposal | null;
  reason: string | null;
  before: SquadArrangementSummary[];
  after: SquadArrangementSummary[];
  moves: { officerId: Id; from: SquadId | null; to: SquadId | null; reasons: string[]; dutyImpact: string | null }[];
  protected: { officerId: Id; reason: string }[];
  scoreBefore: number;
  scoreAfter: number;
}
export type SquadArrangementLockTarget = { kind: 'officer'; officerId: Id } | { kind: 'squad'; squadId: SquadId };

const CAPACITY = 4;
const MAX_PASSES = 24;
const EPS = 1e-7;
const KEYS: RatingKey[] = ['communication', 'awareness', 'medical', 'coordination', 'composure', 'shooting'];
const LABEL: Record<RatingKey, string> = { communication: 'Communication', awareness: 'Awareness', medical: 'Medical', coordination: 'Coordination', composure: 'Composure', shooting: 'Execution' };
const CERTS: CertId[] = ['crisis_negotiation', 'entry_team', 'advanced_first_aid', 'surveillance', 'drone_operator', 'less_lethal', 'advanced_less_lethal', 'deescalation', 'vehicle_operations', 'precision_support', 'controlled_access'];
const EXECUTION_CERTS: CertId[] = ['entry_team', 'less_lethal', 'advanced_less_lethal', 'precision_support', 'controlled_access'];
const ok: HandlerResult = { ok: true };
const refuse = (reason: string): HandlerResult => ({ ok: false, reason });
const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const sorted = <T extends string>(xs: T[]): T[] => [...xs].sort(compareId);
const copyTopology = (t: SquadTopology): SquadTopology => ({ squads: t.squads.map((s) => ({ ...s, officerIds: [...s.officerIds] })), unassignedIds: [...t.unassignedIds] });
type StateExt = GameState & { squadArrangement?: SquadArrangementState };

export function squadArrangementState(state: GameState): SquadArrangementState {
  return (state as StateExt).squadArrangement ?? { officerLocks: [], squadLocks: [] };
}
export function squadTopology(state: GameState): SquadTopology {
  return {
    squads: [...state.squads].sort((a, b) => compareId(a.id, b.id)).map((s) => ({ squadId: s.id, officerIds: [...s.officerIds], leaderId: s.leaderId })),
    unassignedIds: sorted(Object.values(state.officers).filter((o) => o.squadId === null).map((o) => o.id)),
  };
}
function topologyKey(t: SquadTopology): string {
  return JSON.stringify({ squads: [...t.squads].sort((a, b) => compareId(a.squadId, b.squadId)).map((s) => ({ ...s, officerIds: sorted(s.officerIds) })), unassignedIds: sorted(t.unassignedIds) });
}
const sameTopology = (a: SquadTopology, b: SquadTopology): boolean => topologyKey(a) === topologyKey(b);
function placements(t: SquadTopology): Map<Id, SquadId | null> {
  return new Map([...t.squads.flatMap((s) => s.officerIds.map((id) => [id, s.squadId] as const)), ...t.unassignedIds.map((id) => [id, null] as const)]);
}

/** Uses the same deployment gate as operations; a deployed squad is wholly unavailable. */
export function officerArrangementReadiness(state: GameState, officer: Officer): { fresh: boolean; deployable: boolean; reason: string | null } {
  if (officer.squadId && squadDeployed(state, officer.squadId)) return { fresh: false, deployable: false, reason: 'Squad is deployed' };
  const result = deployability(officer, simNow(state));
  if (!result.ok) {
    const reason = officer.injury && officer.injury.until > simNow(state) ? 'Injured'
      : officer.stress >= STRESS_BANDS.recovery ? 'Mandatory recovery'
        : officer.assignment?.kind === 'training' ? 'In training' : 'Deployed';
    return { fresh: false, deployable: false, reason };
  }
  return { fresh: officer.stress < STRESS_BANDS.strained, deployable: true, reason: null };
}
/** Integer effective ratings are the planner's stated precision. A harmless
 * sub-point recovery tick does not invalidate a preview; any changed score does. */
function effective(o: Officer, key: RatingKey): number {
  return Math.round(o.ratings[key] * (1 - conditionFraction(o.stress)));
}
function band(state: GameState, o: Officer) { return experienceBand(o, gameDay(state, simNow(state))); }

/** Relevant facts, not the tick timestamp. No names, portraits, birth dates or other demographics. */
export function squadArrangementToken(state: GameState): string {
  const locks = squadArrangementState(state);
  return JSON.stringify({
    capacity: CAPACITY, rosterCap: state.department.rosterCap,
    squads: squadTopology(state).squads.map((s) => ({ ...s, officerIds: sorted(s.officerIds), duty: state.squads.find((x) => x.id === s.squadId)!.duty, deployed: squadDeployed(state, s.squadId) })),
    officerLocks: sorted(locks.officerLocks), squadLocks: sorted(locks.squadLocks),
    officers: sorted(Object.keys(state.officers)).map((id) => {
      const o = state.officers[id];
      return [id, o.squadId, KEYS.map((k) => effective(o, k)), sorted(o.certs), sorted(o.traits), stressBand(o.stress), o.assignment,
        o.injury, officerArrangementReadiness(state, o).deployable, band(state, o)];
    }),
  });
}

/** Validate a complete roster partition, including explicitly unassigned officers. */
export function validateSquadTopology(state: GameState, value: unknown): HandlerResult {
  if (!value || typeof value !== 'object') return refuse('Arrangement is missing');
  const t = value as SquadTopology;
  if (!Array.isArray(t.squads) || !Array.isArray(t.unassignedIds) || t.squads.length !== state.squads.length) return refuse('The squad list has changed');
  const squads = new Set<string>(), members = new Set<string>();
  for (const s of t.squads) {
    if (!s || !state.squads.some((x) => x.id === s.squadId) || squads.has(s.squadId) || !Array.isArray(s.officerIds)) return refuse('Invalid or repeated squad');
    squads.add(s.squadId);
    if (s.officerIds.length > CAPACITY) return refuse('A squad cannot hold more than four officers');
    if (s.officerIds.length ? typeof s.leaderId !== 'string' || !s.officerIds.includes(s.leaderId) : s.leaderId !== null) return refuse('Each squad needs a valid member as leader');
    for (const id of s.officerIds) {
      if (typeof id !== 'string' || !state.officers[id] || members.has(id)) return refuse('An officer is missing or appears more than once');
      members.add(id);
    }
  }
  for (const id of t.unassignedIds) {
    if (typeof id !== 'string' || !state.officers[id] || members.has(id)) return refuse('An officer is missing or appears more than once');
    members.add(id);
  }
  return members.size === Object.keys(state.officers).length ? ok : refuse('The complete roster must be preserved');
}
function currentTopologyCheck(state: GameState): HandlerResult {
  const t = squadTopology(state), check = validateSquadTopology(state, t);
  if (!check.ok) return check;
  const where = placements(t);
  return Object.values(state.officers).every((o) => where.get(o.id) === o.squadId) ? ok : refuse('Squad membership needs repair before arranging');
}

function fixedReason(state: GameState, o: Officer, options?: SquadOptimizerOptions): string | null {
  const locks = squadArrangementState(state);
  if (o.squadId && squadDeployed(state, o.squadId)) return 'Squad is deployed';
  const available = officerArrangementReadiness(state, o);
  if (!available.deployable) return available.reason;
  if (locks.officerLocks.includes(o.id)) return o.squadId ? 'Assignment locked' : 'Locked as unassigned';
  if (o.squadId && locks.squadLocks.includes(o.squadId)) return 'Whole squad locked';
  if (options) {
    if (o.squadId && !options.squadIds.includes(o.squadId)) return 'Squad not selected';
    if (!o.squadId && !options.includeUnassigned) return 'Unassigned officers excluded';
    if (options.preserveLeaders && state.squads.some((s) => s.leaderId === o.id)) return 'Leader preserved';
  }
  return null;
}
function usableCert(o: Officer, cert: CertId): boolean {
  return o.certs.includes(cert) && (!EXECUTION_CERTS.includes(cert) || highRiskAllowed(o));
}
function mentoring(state: GameState, members: Officer[]): { score: number; labels: string[] } {
  let score = 0;
  const labels: string[] = [];
  const hasTraitMentor = members.some((o) => o.traits.includes('mentor'));
  const traitRookies = members.filter((o) => o.traits.includes('rookie')).length;
  score += traitRookies * (hasTraitMentor ? -1 : -4);
  if (traitRookies) labels.push(hasTraitMentor ? `${traitRookies} rookie trait${traitRookies > 1 ? 's' : ''} steadied by a mentor (−1 instead of −4)` : `${traitRookies} rookie trait${traitRookies > 1 ? 's' : ''} without a mentor (−4)`);
  const rookies = members.filter((o) => band(state, o) === 'rookie');
  const hasVeteran = members.some((o) => band(state, o) === 'veteran');
  if (rookies.length && hasVeteran) {
    score += rookies.length * EXPERIENCE_TUNING.mentoring;
    labels.push(`${rookies.length} service rookie${rookies.length > 1 ? 's' : ''} paired with a veteran (+${EXPERIENCE_TUNING.mentoring})`);
  }
  return { score, labels };
}
export function summarizeSquadArrangement(state: GameState, topology: SquadTopology): SquadArrangementSummary[] {
  return topology.squads.map((sq) => {
    const members = sq.officerIds.map((id) => state.officers[id]);
    const usable = members.filter((o) => officerArrangementReadiness(state, o).deployable);
    const coverage: string[] = [], gaps: string[] = [];
    for (const k of KEYS) {
      const best = Math.max(0, ...usable.filter((o) => k !== 'shooting' || highRiskAllowed(o)).map((o) => effective(o, k)));
      (best >= 50 ? coverage : gaps).push(`${LABEL[k]} ${best}`);
    }
    for (const cert of CERTS) if (usable.some((o) => usableCert(o, cert))) coverage.push(CERT_LABEL[cert] ?? cert);
    if (!usable.some((o) => usableCert(o, 'advanced_first_aid'))) gaps.push('No deployable advanced first aider');
    if (!usable.some((o) => usableCert(o, 'crisis_negotiation'))) gaps.push('No deployable crisis negotiator');
    if (!usable.some((o) => usableCert(o, 'entry_team'))) gaps.push('No available entry-trained officer');
    return { squadId: sq.squadId, officerIds: [...sq.officerIds], leaderId: sq.leaderId, fresh: usable.filter((o) => o.stress < STRESS_BANDS.strained).length,
      deployable: usable.length, unavailable: members.length - usable.length, coverage, gaps, mentoring: mentoring(state, usable).labels };
  });
}
function scoreArrangement(state: GameState, topology: SquadTopology, options: SquadOptimizerOptions): number {
  let score = 0;
  for (const sq of topology.squads) {
    if (!options.squadIds.includes(sq.squadId)) continue;
    const members = sq.officerIds.map((id) => state.officers[id]).filter((o) => officerArrangementReadiness(state, o).deployable);
    // Concave rewards spread usable people and fresh officers between squads.
    score += 140 * Math.sqrt(members.length) + 90 * Math.sqrt(members.filter((o) => o.stress < STRESS_BANDS.strained).length);
    for (const key of KEYS) {
      const ratings = members.filter((o) => key !== 'shooting' || highRiskAllowed(o)).map((o) => effective(o, key)).sort((a, b) => b - a);
      score += ratings.reduce((sum, rating, i) => sum + rating * [1, .25, .08, .02][i], 0) * .2;
    }
    for (const cert of CERTS) {
      const n = members.filter((o) => usableCert(o, cert)).length;
      score += n ? 8 + Math.min(2, n - 1) * .8 : 0;
    }
    score += mentoring(state, members).score;
    const leader = members.find((o) => o.id === sq.leaderId);
    if (leader) score += effective(leader, 'coordination') * .05 + effective(leader, 'composure') * .025;
  }
  return score;
}
function optionsCheck(state: GameState, options: SquadOptimizerOptions): HandlerResult {
  if (!options || !Array.isArray(options.squadIds) || typeof options.includeUnassigned !== 'boolean' || typeof options.preserveLeaders !== 'boolean') return refuse('Choose valid arrangement options');
  if (!options.squadIds.length) return refuse('Select at least one squad');
  if (new Set(options.squadIds).size !== options.squadIds.length || options.squadIds.some((id) => !state.squads.some((s) => s.id === id))) return refuse('The selected squads have changed');
  return ok;
}
function chooseLeaders(state: GameState, t: SquadTopology, options: SquadOptimizerOptions): boolean {
  for (const s of t.squads) {
    const original = state.squads.find((sq) => sq.id === s.squadId)!;
    if (!s.officerIds.length) { s.leaderId = null; continue; }
    if (original.leaderId && s.officerIds.includes(original.leaderId) && (options.preserveLeaders || fixedReason(state, state.officers[original.leaderId], options))) { s.leaderId = original.leaderId; continue; }
    // A protection preserves both assignment and leadership status. Promoting
    // a locked nonleader would immediately prevent restoring their old role.
    const available = s.officerIds.filter((id) => officerArrangementReadiness(state, state.officers[id]).deployable
      && (id === original.leaderId || !fixedReason(state, state.officers[id], options)));
    if (!available.length) return false;
    s.leaderId = [...available].sort((a, b) => {
      const value = (id: Id) => effective(state.officers[id], 'coordination') * 2 + effective(state.officers[id], 'composure');
      return value(b) - value(a) || Number(b === original.leaderId) - Number(a === original.leaderId) || compareId(a, b);
    })[0];
  }
  return true;
}
function moveCount(before: SquadTopology, after: SquadTopology): number {
  const from = placements(before), to = placements(after);
  return [...from].filter(([id, sq]) => to.get(id) !== sq).length + before.squads.filter((s) => after.squads.find((x) => x.squadId === s.squadId)?.leaderId !== s.leaderId).length;
}
function dutyImpact(state: GameState, id: Id, to: SquadId | null): string | null {
  const fromDuty = recoveryDuty(state, state.officers[id]);
  const toDuty = state.squads.find((s) => s.id === to)?.duty ?? 'rest';
  if (fromDuty === toDuty) return null;
  const patrol = (Number(toDuty === 'patrol') - Number(fromDuty === 'patrol')) * ECONOMY_TUNING.patrolPerOfficer;
  return `${fromDuty} → ${toDuty}; base recovery ${ECONOMY_TUNING.recoveryPerHour[fromDuty]} → ${ECONOMY_TUNING.recoveryPerHour[toDuty]} stress/h${patrol ? `; patrol income ${patrol > 0 ? '+' : '−'}$${Math.abs(patrol)}/h for this officer` : ''}. Recovery modifiers still apply.`;
}

/** Greedy vacancy filling, then up to 24 best improving pair swaps. Exact score
 * ties prefer fewer moves, then stable IDs. This is a suggestion, not an optimum. */
export function planSquadArrangement(state: GameState, requested: SquadOptimizerOptions): SquadArrangementPreview {
  const before = squadTopology(state);
  const base: SquadArrangementPreview = { proposal: null, reason: null, before: [], after: [], moves: [], protected: [], scoreBefore: 0, scoreAfter: 0 };
  for (const check of [currentTopologyCheck(state), optionsCheck(state, requested)]) if (!check.ok) return { ...base, reason: check.reason };
  const options = { ...requested, squadIds: sorted(requested.squadIds) };
  base.before = summarizeSquadArrangement(state, before);
  base.after = base.before;
  base.protected = sorted(Object.keys(state.officers)).flatMap((id) => { const reason = fixedReason(state, state.officers[id], options); return reason ? [{ officerId: id, reason }] : []; });
  const movable = new Set(Object.keys(state.officers).filter((id) => !fixedReason(state, state.officers[id], options)));
  let current = copyTopology(before);
  base.scoreBefore = scoreArrangement(state, before, options);
  let currentScore = base.scoreBefore;
  const better = (candidate: SquadTopology, score: number, best: SquadTopology | null, bestScore: number) => score > bestScore + EPS
    || (best !== null && Math.abs(score - bestScore) <= EPS && (moveCount(before, candidate) < moveCount(before, best)
      || (moveCount(before, candidate) === moveCount(before, best) && topologyKey(candidate) < topologyKey(best))));

  if (options.includeUnassigned) {
    for (let i = 0; i < CAPACITY * SQUAD_IDS.length; i++) {
      let best: SquadTopology | null = null, bestScore = currentScore;
      for (const sq of current.squads) {
        if (!options.squadIds.includes(sq.squadId) || squadArrangementState(state).squadLocks.includes(sq.squadId) || squadDeployed(state, sq.squadId) || sq.officerIds.length >= CAPACITY) continue;
        for (const id of sorted(current.unassignedIds.filter((id) => movable.has(id)))) {
          const candidate = copyTopology(current);
          candidate.squads.find((s) => s.squadId === sq.squadId)!.officerIds.push(id);
          candidate.unassignedIds = candidate.unassignedIds.filter((x) => x !== id);
          if (!chooseLeaders(state, candidate, options)) continue;
          const score = scoreArrangement(state, candidate, options);
          if (better(candidate, score, best, bestScore)) { best = candidate; bestScore = score; }
        }
      }
      if (!best) break;
      current = best; currentScore = bestScore;
    }
  }
  if (!options.preserveLeaders) {
    const candidate = copyTopology(current);
    if (chooseLeaders(state, candidate, options)) {
      const score = scoreArrangement(state, candidate, options);
      if (score > currentScore + EPS) { current = candidate; currentScore = score; }
    }
  }
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let best: SquadTopology | null = null, bestScore = currentScore;
    const where = placements(current), ids = sorted([...movable]);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j], aSq = where.get(a)!, bSq = where.get(b)!;
      if (aSq === bSq) continue;
      // Reserve officers can only replace other initially unassigned hires;
      // an existing assigned officer is never displaced into the reserve.
      if ((aSq === null && state.officers[b].squadId !== null) || (bSq === null && state.officers[a].squadId !== null)) continue;
      const candidate = copyTopology(current);
      for (const s of candidate.squads) s.officerIds = s.officerIds.map((id) => id === a ? b : id === b ? a : id);
      candidate.unassignedIds = candidate.unassignedIds.map((id) => id === a ? b : id === b ? a : id);
      if (!chooseLeaders(state, candidate, options)) continue;
      const score = scoreArrangement(state, candidate, options);
      if (better(candidate, score, best, bestScore)) { best = candidate; bestScore = score; }
    }
    if (!best || bestScore <= currentScore + EPS) break;
    current = best; currentScore = bestScore;
  }
  base.after = summarizeSquadArrangement(state, current);
  base.scoreAfter = currentScore;
  const from = placements(before), to = placements(current);
  base.moves = sorted(Object.keys(state.officers)).filter((id) => from.get(id) !== to.get(id)).map((id) => {
    const destination = base.after.find((s) => s.squadId === to.get(id));
    const previous = base.before.find((s) => s.squadId === to.get(id));
    const o = state.officers[id];
    const strongest = [...KEYS].filter((k) => k !== 'shooting' || highRiskAllowed(o)).sort((a, b) => effective(o, b) - effective(o, a) || compareId(a, b)).slice(0, 2);
    const reasons = [`Brings ${strongest.map((k) => `${LABEL[k].toLowerCase()} ${effective(o, k)}`).join(' and ')} after stress adjustment`];
    if (destination && previous && destination.fresh !== previous.fresh) reasons.push(`Destination fresh coverage ${previous.fresh} → ${destination.fresh}`);
    const added = destination?.coverage.filter((c) => !previous?.coverage.includes(c) && !KEYS.some((k) => c.startsWith(LABEL[k]))) ?? [];
    if (added.length) reasons.push(`Adds ${added.join(', ')}`);
    reasons.push('Part of the combined improvement in readiness balance and complementary coverage');
    return { officerId: id, from: from.get(id)!, to: to.get(id)!, reasons, dutyImpact: dutyImpact(state, id, to.get(id)!) };
  });
  if (sameTopology(before, current) || currentScore <= base.scoreBefore + EPS) return { ...base, reason: 'No improving arrangement found with these options and protections. Keep the current roster, or adjust the selected squads and locks.' };
  base.proposal = { token: squadArrangementToken(state), options, before, after: current };
  return base;
}

function transitionCheck(state: GameState, before: SquadTopology, after: SquadTopology, options?: SquadOptimizerOptions): HandlerResult {
  for (const t of [before, after]) { const check = validateSquadTopology(state, t); if (!check.ok) return check; }
  const from = placements(before), to = placements(after), locks = squadArrangementState(state);
  for (const sq of before.squads) {
    const next = after.squads.find((s) => s.squadId === sq.squadId)!;
    const unchanged = sq.leaderId === next.leaderId && sorted(sq.officerIds).join('\0') === sorted(next.officerIds).join('\0');
    if (!unchanged && (squadDeployed(state, sq.squadId) || locks.squadLocks.includes(sq.squadId) || (options && !options.squadIds.includes(sq.squadId)))) return refuse(`Squad ${sq.squadId} is protected and cannot change`);
    if (options) {
      if ((!options.includeUnassigned && next.officerIds.length !== sq.officerIds.length) || next.officerIds.length < sq.officerIds.length) return refuse('Keep existing squad headcounts; only opted-in reserve officers may fill vacancies');
      if (options.preserveLeaders && sq.leaderId !== null && sq.leaderId !== next.leaderId) return refuse('Preserve current squad leaders');
    }
    if (sq.leaderId !== next.leaderId && sq.leaderId && fixedReason(state, state.officers[sq.leaderId], options)) return refuse('A protected leader cannot be replaced');
    if (sq.leaderId !== next.leaderId && next.leaderId && fixedReason(state, state.officers[next.leaderId], options)) return refuse('A protected officer cannot be promoted to leader');
    if (sq.leaderId !== next.leaderId && next.leaderId && !officerArrangementReadiness(state, state.officers[next.leaderId]).deployable) return refuse('An unavailable officer cannot take over as leader');
  }
  for (const o of Object.values(state.officers)) {
    if (from.get(o.id) === to.get(o.id)) continue;
    const reason = fixedReason(state, o, options);
    if (reason) return refuse(`An officer cannot move: ${reason.toLowerCase()}`);
    if (options && from.get(o.id) !== null && to.get(o.id) === null) return refuse('Assigned officers cannot be displaced into the reserve');
    const destination = to.get(o.id);
    if (destination && (squadDeployed(state, destination) || locks.squadLocks.includes(destination) || (options && !options.squadIds.includes(destination)))) return refuse('An officer cannot enter a protected squad');
  }
  return ok;
}
function writeTopology(state: GameState, topology: SquadTopology): void {
  for (const entry of topology.squads) {
    const sq = state.squads.find((s) => s.id === entry.squadId)!;
    sq.officerIds = [...entry.officerIds]; sq.leaderId = entry.leaderId;
  }
  const where = placements(topology);
  for (const o of Object.values(state.officers)) o.squadId = where.get(o.id)!;
}
export function applySquadArrangement(state: GameState, proposal: SquadArrangementProposal): HandlerResult {
  if (!proposal || typeof proposal.token !== 'string') return refuse('Generate a new arrangement preview');
  const options = optionsCheck(state, proposal.options); if (!options.ok) return options;
  if (proposal.token !== squadArrangementToken(state)) return refuse('This preview is stale. Readiness, roster, qualifications or protections changed; generate a new preview.');
  const existing = currentTopologyCheck(state); if (!existing.ok) return existing;
  const safety = transitionCheck(state, proposal.before, proposal.after, proposal.options); if (!safety.ok) return safety;
  if (!sameTopology(squadTopology(state), proposal.before)) return refuse('The current arrangement no longer matches this preview');
  if (sameTopology(proposal.before, proposal.after) || scoreArrangement(state, proposal.after, proposal.options) <= scoreArrangement(state, proposal.before, proposal.options) + EPS) return refuse('This arrangement does not improve the selected objective');
  writeTopology(state, proposal.after);
  (state as StateExt).squadArrangement = { ...squadArrangementState(state), undo: { before: copyTopology(proposal.before), after: copyTopology(proposal.after) } };
  return ok;
}
export function undoSquadArrangementCheck(state: GameState): HandlerResult {
  const undo = squadArrangementState(state).undo;
  if (!undo) return refuse('No arrangement to undo');
  const current = currentTopologyCheck(state); if (!current.ok) return current;
  for (const t of [undo.before, undo.after]) { const check = validateSquadTopology(state, t); if (!check.ok) return refuse('The roster changed; the last arrangement can no longer be restored'); }
  if (!sameTopology(squadTopology(state), undo.after)) return refuse('The arrangement has changed since Apply; undo would overwrite newer assignments');
  return transitionCheck(state, undo.after, undo.before);
}
export function undoSquadArrangement(state: GameState): HandlerResult {
  const check = undoSquadArrangementCheck(state); if (!check.ok) return check;
  const saved = squadArrangementState(state);
  writeTopology(state, saved.undo!.before);
  (state as StateExt).squadArrangement = { officerLocks: [...saved.officerLocks], squadLocks: [...saved.squadLocks] };
  return ok;
}
export function setSquadArrangementLock(state: GameState, target: SquadArrangementLockTarget, locked: boolean): HandlerResult {
  if (!target || typeof locked !== 'boolean') return refuse('Choose an officer or squad to lock');
  const current = squadArrangementState(state);
  if (target.kind === 'officer') {
    if (!state.officers[target.officerId]) return refuse('No such officer');
    const ids = current.officerLocks.filter((id) => id !== target.officerId);
    if (locked) ids.push(target.officerId);
    (state as StateExt).squadArrangement = { ...current, officerLocks: sorted(ids) };
  } else if (target.kind === 'squad') {
    if (!state.squads.some((sq) => sq.id === target.squadId)) return refuse('No such squad');
    const ids = current.squadLocks.filter((id) => id !== target.squadId);
    if (locked) ids.push(target.squadId);
    (state as StateExt).squadArrangement = { ...current, squadLocks: sorted(ids) };
  } else return refuse('Choose an officer or squad to lock');
  return ok;
}

/** Optional additive save field. Corrupt locks/history are discarded without
 * touching any officers, campaign balances, slots, or the rest of the save. */
export function normalizeSquadArrangementState(state: GameState): void {
  const raw = (state as StateExt).squadArrangement as unknown;
  if (raw === undefined) return;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { delete (state as StateExt).squadArrangement; return; }
  const data = raw as Record<string, unknown>;
  const clean: SquadArrangementState = {
    officerLocks: Array.isArray(data.officerLocks) ? sorted([...new Set(data.officerLocks.filter((id): id is Id => typeof id === 'string' && !!state.officers[id]))]) : [],
    squadLocks: Array.isArray(data.squadLocks) ? sorted([...new Set(data.squadLocks.filter((id): id is SquadId => typeof id === 'string' && state.squads.some((s) => s.id === id)))]) : [],
  };
  if (data.undo && typeof data.undo === 'object') {
    const undo = data.undo as SquadArrangementState['undo'];
    if (undo && validateSquadTopology(state, undo.before).ok && validateSquadTopology(state, undo.after).ok) clean.undo = { before: copyTopology(undo.before), after: copyTopology(undo.after) };
  }
  (state as StateExt).squadArrangement = clean;
}
