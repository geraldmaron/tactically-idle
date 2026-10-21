// Command Staff: hired managers who each automate one loop the player already runs by
// hand. They never make tactical or operation decisions.
// - Watch Commander: rests idle squads when someone is worn down and returns them to their
//   earning duty once everyone is fresh, through the same rules as the setSquadDuty command.
// - Training Sergeant: fills free training places with the most rested eligible officer,
//   using the same course rules as the startCourse command, above a funding reserve.
// - Quartermaster: the existing equipment manager (servicing budget) plus restock rules,
//   presented as staff. Its mechanics live in equipment-manager.ts and are not changed here.
// - Peer Support Lead: each clock hour offers peer-support sessions to the most strained idle
//   officers, which take stress off faster than rest alone, for a fee above a funding reserve.
// - Recruiter: each clock hour signs the best candidate for the role you chose while the roster
//   has room, through the same rules as the hire command, above a funding reserve.
// A Develop purchase opens each post; the post then offers three candidates who trade price against
// two levers in that manager's loop (staff-pool.ts), and hiring one fills it. Each manager has an on/off switch, a small policy, an hourly
// salary paid with payroll (economy.ratesAt) while switched on, and a saved activity log.
// Automation runs inside settle() at absolute clock hours within the 24-hour accrual window,
// exactly like restock rules, so an offline settlement equals any sequence of online ticks.
import type { GameState, HandlerResult, Id, Officer, Role, SquadDuty, SquadId } from './types';
import { SQUAD_IDS } from './types';
import { COURSES } from '../content/courses';
import { ROLES } from '../content/recruits';
import { DEV_NODES } from '../content/dev-tree';
import { HOUR_MS, isInjured, isNodeUnlocked, netRate } from './economy';
import { money } from './format';
import { simNow } from './calendar';
import { squadDeployed } from './squads';
import { courseCheck } from './develop';
import { hireCheck, ROSTER_HANDLERS } from './roster';
import { fullName, STRESS_BANDS } from './officer';
import { developmentTier, effectiveDevelopmentEffects, quoteDevelopment } from './development-tiers';
import { EQUIPMENT_MANAGER, maintenanceBudget } from './equipment-manager-policy';
import { setMaintenanceBudget } from './equipment-manager';
import { courseFee, drawStaffPool, emptyPost, staffLever, staffPostOf, STAFF_LEVERS, STAFF_POOL, type StaffCandidate, type StaffHolder, type StaffPost } from './staff-pool';
import { postFunding } from './ledger';
import { milestoneView } from './grants';

// ---------------------------------------------------------------- shapes

export type ManagerId = 'watch_commander' | 'training_sergeant' | 'quartermaster' | 'peer_support_lead' | 'recruiter';
export const MANAGER_IDS: readonly ManagerId[] = ['watch_commander', 'training_sergeant', 'quartermaster', 'peer_support_lead', 'recruiter'];

/** Duties the Watch Commander returns a squad to. Rest is where it sends tired squads. */
export type EarningDuty = Exclude<SquadDuty, 'rest'>;

export interface ManagerLogEntry {
  /** Department clock time of the action. */
  at: number;
  text: string;
}

export interface WatchCommanderPolicy {
  /** Rest a squad when any member's stress reaches this. */
  restAt: number;
  /** Squads the player keeps on manual duty. */
  optOut: SquadId[];
}

export interface TrainingSergeantPolicy {
  /** Course to enrol officers in; null until the player picks one. */
  courseId: Id | null;
  /** Never enrol if funding after the course fee would fall below this. */
  reserve: number;
}

export interface PeerSupportPolicy {
  /** Offer a session to idle officers at or above this stress. */
  supportAt: number;
  /** Never run a session if funding after its fee would fall below this. */
  reserve: number;
}

export interface RecruiterPolicy {
  /** Role to recruit; null takes the best candidate of any role. */
  role: Role | null;
  /** Never sign a candidate if funding after the signing cost would fall below this. */
  reserve: number;
}

/** Current command staff. Optional on GameState for isolated fixtures. */
export interface CommandStaffState {
  watch_commander: {
    enabled: boolean;
    policy: WatchCommanderPolicy;
    /** Duty each squad held when the Watch Commander rested it. */
    rested: Partial<Record<SquadId, EarningDuty>>;
    log: ManagerLogEntry[];
    post: StaffPost;
  };
  training_sergeant: {
    enabled: boolean;
    policy: TrainingSergeantPolicy;
    log: ManagerLogEntry[];
    post: StaffPost;
  };
  quartermaster: {
    /** Hourly service budget restored when the Quartermaster is switched back on. */
    resumeBudget: number;
    log: ManagerLogEntry[];
    post: StaffPost;
  };
  peer_support_lead: { enabled: boolean; policy: PeerSupportPolicy; log: ManagerLogEntry[]; post: StaffPost };
  recruiter: { enabled: boolean; policy: RecruiterPolicy; log: ManagerLogEntry[]; post: StaffPost };
}

export type ManagerPolicyPatch =
  | { managerId: 'watch_commander'; restAt?: number; optOut?: SquadId[] }
  | { managerId: 'training_sergeant'; courseId?: Id | null; reserve?: number }
  | { managerId: 'quartermaster'; budgetPerHour?: number }
  | { managerId: 'peer_support_lead'; supportAt?: number; reserve?: number }
  | { managerId: 'recruiter'; role?: Role | null; reserve?: number };

// ---------------------------------------------------------------- tuning and roster

/** First-pass balance values. */
export const COMMAND_STAFF = {
  logLimit: 20,
  watchCommander: {
    nodeId: 'personnel_watch_commander',
    defaultRestAt: STRESS_BANDS.overloaded,
    /** A rested squad returns once every member is below this, unless the hire's lever sets it. */
    returnBelow: STRESS_BANDS.strained,
    minRestAt: STRESS_BANDS.strained,
    maxRestAt: STRESS_BANDS.recovery,
    restChoices: [STRESS_BANDS.strained, 45, STRESS_BANDS.overloaded, 70] as readonly number[],
  },
  trainingSergeant: {
    nodeId: 'personnel_training_sergeant',
    /** Only officers below this stress are enrolled. */
    maxStress: STRESS_BANDS.strained,
    defaultReserve: 2500,
    maxReserve: 100_000,
    reserveChoices: [1000, 2500, 5000, 10_000] as readonly number[],
  },
  peerSupportLead: {
    nodeId: 'personnel_peer_support_lead',
    /** Funding per session. Sessions an hour and the stress each takes off are the hire's levers. */
    sessionCost: 80,
    defaultSupportAt: STRESS_BANDS.strained,
    supportChoices: [STRESS_BANDS.strained, 45, STRESS_BANDS.overloaded] as readonly number[],
    defaultReserve: 2500,
    maxReserve: 100_000,
    reserveChoices: [1000, 2500, 5000, 10_000] as readonly number[],
  },
  recruiter: {
    nodeId: 'personnel_recruiter',
    defaultReserve: 5000,
    maxReserve: 100_000,
    reserveChoices: [2500, 5000, 10_000, 20_000] as readonly number[],
  },
  quartermaster: {
    nodeId: EQUIPMENT_MANAGER.nodeId,
    /** The Quartermaster has no salary; its cost is the signing fee and the service budget it spends. */
    defaultBudget: 200,
  },
} as const;

/** The post, not the person: who fills it comes from the hire (staff-pool.ts). */
export interface ManagerProfile {
  id: ManagerId;
  title: string;
  nodeId: Id;
  /** The loop it automates, as a short label. */
  loop: string;
  /** What it does, in one sentence. */
  duty: string;
  /** What it never touches. */
  never: string;
}

export const MANAGERS: Record<ManagerId, ManagerProfile> = {
  watch_commander: {
    id: 'watch_commander',
    title: 'Watch Commander',
    nodeId: COMMAND_STAFF.watchCommander.nodeId,
    loop: 'Squad duty and rest',
    duty: 'Each clock hour, moves an idle squad to Rest when anyone reaches your stress limit, then back to its earlier duty once everyone is fresh again.',
    never: 'Never touches deployed squads, operations or squads you keep on manual duty.',
  },
  training_sergeant: {
    id: 'training_sergeant',
    title: 'Training Sergeant',
    nodeId: COMMAND_STAFF.trainingSergeant.nodeId,
    loop: 'Course enrolment',
    duty: 'Each clock hour, fills free training places with the most rested officer who can take your chosen course, keeping funding above your reserve.',
    never: 'Never enrols deployed, injured or strained officers, and never picks a course for you.',
  },
  quartermaster: {
    id: 'quartermaster',
    title: 'Quartermaster',
    nodeId: COMMAND_STAFF.quartermaster.nodeId,
    loop: 'Servicing and restock',
    duty: 'Each clock hour, sends worn idle equipment for service within an hourly budget. Restock rules refill held stock on the same clock.',
    never: 'Never buys new kinds of equipment or touches gear reserved for a call.',
  },
  peer_support_lead: {
    id: 'peer_support_lead',
    title: 'Peer Support Lead',
    nodeId: COMMAND_STAFF.peerSupportLead.nodeId,
    loop: 'Officer peer support',
    duty: `Each clock hour, offers peer-support sessions to the most strained idle officers, ${money(COMMAND_STAFF.peerSupportLead.sessionCost)} each, above your funding reserve. How many and how much each helps depends on who you hire.`,
    never: 'Never touches deployed officers, hurts nobody, and never decides who rests or trains.',
  },
  recruiter: {
    id: 'recruiter',
    title: 'Recruiter',
    nodeId: COMMAND_STAFF.recruiter.nodeId,
    loop: 'Hiring',
    duty: 'Each clock hour, while the roster has room, signs the best candidate for the role you choose, keeping funding above your reserve and the department in the black.',
    never: 'Never dismisses anyone, searches for new candidates or signs past a full roster.',
  },
};

// ---------------------------------------------------------------- state access

export function createCommandStaff(): CommandStaffState {
  return {
    watch_commander: { enabled: true, policy: { restAt: COMMAND_STAFF.watchCommander.defaultRestAt, optOut: [] }, rested: {}, log: [], post: emptyPost() },
    training_sergeant: { enabled: true, policy: { courseId: null, reserve: COMMAND_STAFF.trainingSergeant.defaultReserve }, log: [], post: emptyPost() },
    quartermaster: { resumeBudget: COMMAND_STAFF.quartermaster.defaultBudget, log: [], post: emptyPost() },
    peer_support_lead: { enabled: true, policy: { supportAt: COMMAND_STAFF.peerSupportLead.defaultSupportAt, reserve: COMMAND_STAFF.peerSupportLead.defaultReserve }, log: [], post: emptyPost() },
    recruiter: { enabled: true, policy: { role: null, reserve: COMMAND_STAFF.recruiter.defaultReserve }, log: [], post: emptyPost() },
  };
}

/** Read-only view; states from before save v9 (and hand-built fixtures) read as defaults. */
export function commandStaffOf(state: GameState): CommandStaffState {
  // A staff record saved before a manager existed reads that manager as its defaults.
  const staff = state.commandStaff;
  return staff && MANAGER_IDS.every((id) => id in staff) ? staff : { ...createCommandStaff(), ...staff };
}

/** Writable staff record on a draft, created on first write. */
function staffOn(d: GameState): CommandStaffState {
  const defaults = createCommandStaff();
  d.commandStaff ??= defaults;
  for (const id of MANAGER_IDS) {
    if (!(id in d.commandStaff)) Object.assign(d.commandStaff, { [id]: defaults[id] });
    else if (!d.commandStaff[id].post) d.commandStaff[id].post = emptyPost();
  }
  return d.commandStaff;
}

/** The post exists: opened through Develop. The Quartermaster's post is the equipment manager node. */
export function postOpen(state: GameState, id: ManagerId): boolean {
  if (id === 'quartermaster') return developmentTier(state, EQUIPMENT_MANAGER.nodeId) > 0;
  return effectiveDevelopmentEffects(state).some((effect) => effect.kind === 'commandStaff' && effect.managerId === id);
}

/** The person in the post, if anyone holds it. */
export function postHolder(state: GameState, id: ManagerId): StaffHolder | null {
  return postOpen(state, id) ? staffPostOf(state, id).holder : null;
}

/** Someone holds the post. */
export function managerHired(state: GameState, id: ManagerId): boolean {
  return postHolder(state, id) !== null;
}

/** Hired and switched on. The Quartermaster is on while its service budget is above zero. */
export function managerOn(state: GameState, id: ManagerId): boolean {
  if (!managerHired(state, id)) return false;
  if (id === 'quartermaster') return maintenanceBudget(state) > 0;
  return commandStaffOf(state)[id].enabled;
}

/** Hourly salaries of managers on duty, paid with payroll. */
export function commandStaffSalaries(state: GameState): number {
  let total = 0;
  for (const id of MANAGER_IDS) if (managerOn(state, id)) total += postHolder(state, id)!.salaryPerHour;
  return total;
}

/** Does settlement need the hourly grid for Command Staff? */
export function commandStaffActive(state: GameState): boolean {
  return managerOn(state, 'watch_commander') || managerOn(state, 'training_sergeant') || managerOn(state, 'peer_support_lead') || managerOn(state, 'recruiter');
}

function log(entries: ManagerLogEntry[], at: number, text: string): void {
  entries.unshift({ at, text });
  if (entries.length > COMMAND_STAFF.logLimit) entries.length = COMMAND_STAFF.logLimit;
}

/** Quantize decisions, not simulation values: tick-size float drift must not change a choice. */
const decide = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

// ---------------------------------------------------------------- settlement

/** Watch Commander: one pass over idle squads at clock hour t. */
function runWatchCommander(d: GameState, t: number): void {
  if (!managerOn(d, 'watch_commander')) return;
  const wc = staffOn(d).watch_commander;
  const returnBelow = staffLever(d, 'watch_commander', 1) ?? COMMAND_STAFF.watchCommander.returnBelow;
  for (const squad of d.squads) {
    // A squad the player moved off Rest is no longer the Watch Commander's to return.
    if (wc.rested[squad.id] && squad.duty !== 'rest') delete wc.rested[squad.id];
    if (wc.policy.optOut.includes(squad.id) || squadDeployed(d, squad.id)) continue;
    const members = squad.officerIds.map((id) => d.officers[id]).filter((o): o is Officer => !!o);
    if (!members.length) continue;
    const peak = members.reduce((worst, o) => (decide(o.stress) > decide(worst.stress) ? o : worst));
    const peakStress = decide(peak.stress);
    if (squad.duty !== 'rest' && peakStress >= wc.policy.restAt) {
      const from = squad.duty;
      if (!ROSTER_HANDLERS.setSquadDuty(d, squad.id, 'rest').ok) continue;
      wc.rested[squad.id] = from;
      log(wc.log, t, `Rested ${squad.name}: ${peak.surname} reached ${Math.floor(peakStress)} stress`);
    } else if (squad.duty === 'rest' && peakStress < returnBelow) {
      const to = wc.rested[squad.id] ?? 'patrol';
      if (!ROSTER_HANDLERS.setSquadDuty(d, squad.id, to).ok) continue;
      delete wc.rested[squad.id];
      log(wc.log, t, `Returned ${squad.name} to ${to === 'patrol' ? 'Patrol' : 'Standby'}: everyone below ${returnBelow} stress`);
    }
  }
}

/** Why the sergeant cannot enrol anyone right now, or the officer it would enrol. */
function sergeantPick(state: GameState, t: number): { officer: Officer; courseId: Id } | { officer: null; reason: string } {
  const { policy } = commandStaffOf(state).training_sergeant;
  const course = policy.courseId ? COURSES[policy.courseId] : undefined;
  if (!course) return { officer: null, reason: 'Choose a course to enrol officers in' };
  const general = courseCheck(state, course, null, t);
  if (!general.ok) return { officer: null, reason: general.reason ?? 'The course is not available' };
  const fee = courseFee(state, course.cost);
  if (decide(state.department.funding - fee) < policy.reserve) {
    return { officer: null, reason: `Waiting: the ${money(fee)} fee would take funding below the ${money(policy.reserve)} reserve` };
  }
  const { maxStress } = COMMAND_STAFF.trainingSergeant;
  const eligible = Object.values(state.officers)
    .filter((o) => !isInjured(o, t) && decide(o.stress) < maxStress && courseCheck(state, course, o, t).ok)
    .sort((a, b) => decide(a.stress) - decide(b.stress) || a.id.localeCompare(b.id));
  return eligible[0]
    ? { officer: eligible[0], courseId: course.id }
    : { officer: null, reason: `No officer below ${maxStress} stress can take ${course.name} right now` };
}

/** Training Sergeant: fill every free place at clock hour t. */
function runTrainingSergeant(d: GameState, t: number): void {
  if (!managerOn(d, 'training_sergeant')) return;
  const ts = staffOn(d).training_sergeant;
  for (;;) {
    const pick = sergeantPick(d, t);
    if (!pick.officer) return;
    const course = COURSES[pick.courseId];
    const fee = courseFee(d, course.cost);
    postFunding(d.department, -fee, 'training', `${course.name} for ${pick.officer.surname}`, t);
    pick.officer.assignment = { kind: 'training', courseId: course.id, startedAt: t, endsAt: t + Math.round(course.hours * HOUR_MS) };
    log(ts.log, t, `Enrolled ${fullName(pick.officer)} in ${course.name} (${money(fee)})`);
  }
}

/** Idle officers a peer-support session can reach: not on a call or in training, stressed enough, most strained first. */
function supportQueue(state: GameState): Officer[] {
  const { supportAt } = commandStaffOf(state).peer_support_lead.policy;
  return Object.values(state.officers)
    .filter((o) => !o.assignment && decide(o.stress) >= supportAt)
    .sort((a, b) => decide(b.stress) - decide(a.stress) || a.id.localeCompare(b.id));
}

/** Peer Support Lead: offer this hour's sessions at clock hour t. */
function runPeerSupport(d: GameState, t: number): void {
  if (!managerOn(d, 'peer_support_lead')) return;
  const ps = staffOn(d).peer_support_lead;
  const { sessionCost } = COMMAND_STAFF.peerSupportLead;
  const sessionsPerHour = staffLever(d, 'peer_support_lead', 0) ?? 0;
  const relief = staffLever(d, 'peer_support_lead', 1) ?? 0;
  for (const officer of supportQueue(d).slice(0, sessionsPerHour)) {
    if (decide(d.department.funding - sessionCost) < ps.policy.reserve) return;
    const before = Math.floor(decide(officer.stress));
    postFunding(d.department, -sessionCost, 'staff', 'Peer support sessions', t);
    officer.stress = Math.max(0, officer.stress - relief);
    log(ps.log, t, `Peer support for ${fullName(officer)}: stress ${before} to ${Math.floor(decide(officer.stress))} (${money(sessionCost)})`);
  }
}

/** Why the recruiter cannot sign anyone right now, or the candidate it would sign. */
function recruiterPick(state: GameState): { candidateId: Id; name: string; cost: number } | { candidateId: null; reason: string } {
  const { policy } = commandStaffOf(state).recruiter;
  const cap = state.department.rosterCap, size = Object.keys(state.officers).length;
  if (size >= cap) return { candidateId: null, reason: `Roster is full (${size}/${cap})` };
  const rolePool = state.candidates.filter((c) => policy.role === null || c.officer.role === policy.role);
  if (!rolePool.length) return { candidateId: null, reason: policy.role ? `No ${policy.role} candidate in the pool` : 'No candidates in the pool' };
  const score = (o: Officer) => Object.values(o.ratings).reduce((sum, value) => sum + value, 0);
  const floor = staffLever(state, 'recruiter', 1) ?? 0;
  const discount = staffLever(state, 'recruiter', 0) ?? 0;
  const pool = rolePool.filter((c) => score(c.officer) / Object.keys(c.officer.ratings).length >= floor);
  if (!pool.length) return { candidateId: null, reason: `No candidate${policy.role ? ` for ${policy.role}` : ''} is rated ${floor} or better` };
  const ranked = [...pool].sort((a, b) => score(b.officer) - score(a.officer) || a.id.localeCompare(b.id));
  let reason = '';
  for (const candidate of ranked) {
    const cost = negotiated(candidate.signingCost, discount);
    if (decide(state.department.funding - cost) < policy.reserve) {
      reason ||= `Waiting: the ${money(cost)} signing cost would take funding below the ${money(policy.reserve)} reserve`;
      continue;
    }
    const check = hireCheck({ ...state, candidates: state.candidates.map((c) => c.id === candidate.id ? { ...c, signingCost: cost } : c) }, candidate.id, netRate);
    if (check.ok) return { candidateId: candidate.id, name: fullName(candidate.officer), cost };
    reason ||= check.reason ?? 'Cannot sign anyone right now';
  }
  return { candidateId: null, reason };
}

const negotiated = (cost: number, discount: number) => Math.round((cost * (1 - discount)) / 10) * 10;

/** Recruiter: sign candidates while the roster has room, at clock hour t. */
function runRecruiter(d: GameState, t: number): void {
  if (!managerOn(d, 'recruiter')) return;
  const rc = staffOn(d).recruiter;
  for (;;) {
    const pick = recruiterPick(d);
    if (!pick.candidateId) return;
    const candidate = d.candidates.find((c) => c.id === pick.candidateId);
    if (candidate) candidate.signingCost = pick.cost;
    if (!ROSTER_HANDLERS.hire(d, pick.candidateId, netRate).ok) return;
    log(rc.log, t, `Signed ${pick.name} (${money(pick.cost)})`);
  }
}

/**
 * Called by settle() at each absolute clock hour inside the accrual window, after restock
 * and equipment servicing. Duty first, so the sergeant's budget check sees the new duties.
 */
export function runCommandStaff(d: GameState, t: number): void {
  runWatchCommander(d, t);
  runPeerSupport(d, t);
  runTrainingSergeant(d, t);
  runRecruiter(d, t);
}

/** Records what the Quartermaster's existing automation did at clock hour t. */
export function logQuartermaster(d: GameState, t: number, serviced: Id[], serviceSpend: number, restockSpend: number): void {
  if (!managerHired(d, 'quartermaster') || (!serviced.length && restockSpend <= 0)) return;
  const qm = staffOn(d).quartermaster;
  if (serviced.length) {
    const serials = serviced.map((id) => d.units[id]?.serial ?? id).join(', ');
    log(qm.log, t, `Sent ${serviced.length === 1 ? 'one item' : `${serviced.length} items`} for service (${money(serviceSpend)}): ${serials}`);
  }
  if (restockSpend > 0) log(qm.log, t, `Restocked held stock to rule targets (${money(restockSpend)})`);
}

// ---------------------------------------------------------------- commands

const refusal = (reason: string): HandlerResult => ({ ok: false, reason });
const OK: HandlerResult = { ok: true };
const isManagerId = (value: unknown): value is ManagerId => typeof value === 'string' && (MANAGER_IDS as readonly string[]).includes(value);

export function setManagerEnabled(d: GameState, managerId: ManagerId, enabled: boolean): HandlerResult {
  if (!isManagerId(managerId)) return refusal('Unknown manager');
  if (typeof enabled !== 'boolean') return refusal('Choose on or off');
  const profile = MANAGERS[managerId];
  if (!managerHired(d, managerId)) return refusal(`Hire a ${profile.title} first.`);
  if (managerOn(d, managerId) === enabled) return refusal(`The ${profile.title} is already ${enabled ? 'on' : 'off'}.`);
  const staff = staffOn(d);
  const t = simNow(d);
  if (managerId === 'quartermaster') {
    if (!enabled) staff.quartermaster.resumeBudget = maintenanceBudget(d);
    const result = setMaintenanceBudget(d, enabled ? staff.quartermaster.resumeBudget : 0);
    if (!result.ok) return result;
    log(staff.quartermaster.log, t, enabled ? `Switched on: servicing up to ${money(staff.quartermaster.resumeBudget)}/hour` : 'Switched off: running repairs finish');
    return OK;
  }
  staff[managerId].enabled = enabled;
  log(staff[managerId].log, t, enabled ? 'Switched on' : 'Switched off');
  return OK;
}

export function setManagerPolicy(d: GameState, patch: ManagerPolicyPatch): HandlerResult {
  if (!patch || typeof patch !== 'object' || !isManagerId(patch.managerId)) return refusal('Unknown manager');
  const profile = MANAGERS[patch.managerId];
  if (!managerHired(d, patch.managerId)) return refusal(`Hire a ${profile.title} first.`);
  const staff = staffOn(d);
  switch (patch.managerId) {
    case 'watch_commander': {
      const { minRestAt, maxRestAt } = COMMAND_STAFF.watchCommander;
      const policy = staff.watch_commander.policy;
      if (patch.restAt !== undefined) {
        if (!Number.isInteger(patch.restAt) || patch.restAt < minRestAt || patch.restAt > maxRestAt) {
          return refusal(`Choose a stress limit from ${minRestAt} to ${maxRestAt}.`);
        }
      }
      if (patch.optOut !== undefined) {
        if (!Array.isArray(patch.optOut) || !patch.optOut.every((id) => (SQUAD_IDS as readonly unknown[]).includes(id))) return refusal('Unknown squad');
      }
      if (patch.restAt !== undefined) policy.restAt = patch.restAt;
      if (patch.optOut !== undefined) {
        policy.optOut = SQUAD_IDS.filter((id) => patch.optOut!.includes(id));
        for (const id of policy.optOut) delete staff.watch_commander.rested[id];
      }
      return OK;
    }
    case 'training_sergeant': {
      const policy = staff.training_sergeant.policy;
      if (patch.courseId !== undefined && patch.courseId !== null) {
        const course = Object.hasOwn(COURSES, patch.courseId) ? COURSES[patch.courseId] : undefined;
        if (!course) return refusal('Unknown course');
        if (course.requiresNode && !isNodeUnlocked(d, course.requiresNode)) {
          return refusal(`${course.name} requires ${DEV_NODES[course.requiresNode]?.name ?? course.requiresNode}`);
        }
      }
      if (patch.reserve !== undefined) {
        const { maxReserve } = COMMAND_STAFF.trainingSergeant;
        if (!Number.isInteger(patch.reserve) || patch.reserve < 0 || patch.reserve > maxReserve) return refusal(`Choose a reserve from $0 to ${money(maxReserve)}.`);
      }
      if (patch.courseId !== undefined) policy.courseId = patch.courseId;
      if (patch.reserve !== undefined) policy.reserve = patch.reserve;
      return OK;
    }
    case 'peer_support_lead': {
      const policy = staff.peer_support_lead.policy;
      const { supportChoices, maxReserve } = COMMAND_STAFF.peerSupportLead;
      if (patch.supportAt !== undefined && !supportChoices.includes(patch.supportAt)) return refusal(`Choose a stress from ${supportChoices.join(', ')}.`);
      if (patch.reserve !== undefined && (!Number.isInteger(patch.reserve) || patch.reserve < 0 || patch.reserve > maxReserve)) return refusal(`Choose a reserve from $0 to ${money(maxReserve)}.`);
      if (patch.supportAt !== undefined) policy.supportAt = patch.supportAt;
      if (patch.reserve !== undefined) policy.reserve = patch.reserve;
      return OK;
    }
    case 'recruiter': {
      const policy = staff.recruiter.policy;
      const { maxReserve } = COMMAND_STAFF.recruiter;
      if (patch.role !== undefined && patch.role !== null && !(ROLES as readonly unknown[]).includes(patch.role)) return refusal('Unknown role');
      if (patch.reserve !== undefined && (!Number.isInteger(patch.reserve) || patch.reserve < 0 || patch.reserve > maxReserve)) return refusal(`Choose a reserve from $0 to ${money(maxReserve)}.`);
      if (patch.role !== undefined) policy.role = patch.role;
      if (patch.reserve !== undefined) policy.reserve = patch.reserve;
      return OK;
    }
    case 'quartermaster': {
      const budget = patch.budgetPerHour;
      if (budget === undefined) return OK;
      if (!Number.isInteger(budget) || budget < 1 || budget > EQUIPMENT_MANAGER.maxHourlyBudget) {
        return refusal(`Choose an hourly service ceiling from $1 to ${money(EQUIPMENT_MANAGER.maxHourlyBudget)}.`);
      }
      staff.quartermaster.resumeBudget = budget;
      return maintenanceBudget(d) > 0 ? setMaintenanceBudget(d, budget) : OK;
    }
  }
}

/** Draw a new pool into an open, vacant post. */
function redraw(d: GameState, id: ManagerId, t: number, exclude: string[]): void {
  const post = staffOn(d)[id].post;
  post.round += 1;
  post.pool = [];
  post.pool = drawStaffPool(d, id, post.round, exclude);
  post.drawnAt = t;
}

/** Open posts with no holder and no pool get their first draw. Develop calls this after opening a post. */
export function fillOpenPosts(d: GameState): void {
  if (!d.commandStaff) return;
  const t = simNow(d);
  for (const id of MANAGER_IDS) {
    if (!postOpen(d, id)) continue;
    const post = staffOn(d)[id].post;
    if (post.holder || post.pool.length) continue;
    post.pool = drawStaffPool(d, id, post.round);
    post.drawnAt = t;
  }
}

/** Why a candidate cannot be hired, or null. */
export function staffHireCheck(state: GameState, managerId: ManagerId, candidateId: Id): string | null {
  if (!isManagerId(managerId)) return 'Unknown manager';
  const profile = MANAGERS[managerId];
  if (!postOpen(state, managerId)) return `Open the ${profile.title} post in Develop first.`;
  const post = staffPostOf(state, managerId);
  if (post.holder) return `Replace ${post.holder.person.firstName} ${post.holder.person.surname} first.`;
  const candidate = post.pool.find((c) => c.id === candidateId);
  if (!candidate) return 'That candidate is no longer available';
  if (state.department.funding < candidate.signingCost) return `Needs ${money(candidate.signingCost)} to sign (have ${money(state.department.funding)})`;
  const on = managerId === 'quartermaster' || commandStaffOf(state)[managerId].enabled;
  if (on && netRate(state) - candidate.salaryPerHour < 0) return `Their ${money(candidate.salaryPerHour)}/h salary would leave the department short each hour`;
  return null;
}

export function hireStaff(d: GameState, managerId: ManagerId, candidateId: Id): HandlerResult {
  const reason = staffHireCheck(d, managerId, candidateId);
  if (reason) return refusal(reason);
  const post = staffOn(d)[managerId].post;
  const candidate = post.pool.find((c) => c.id === candidateId)!;
  const t = simNow(d);
  postFunding(d.department, -candidate.signingCost, 'signing', `Signed ${candidate.person.firstName} ${candidate.person.surname}, ${MANAGERS[managerId].title}`, t);
  post.holder = { ...structuredClone(candidate), hiredAt: t };
  post.pool = [];
  log(staffOn(d)[managerId].log, t, `${candidate.person.firstName} ${candidate.person.surname} signed on (${money(candidate.signingCost)})`);
  return OK;
}

/** Severance owed for letting the person in a post go. */
export function staffSeverance(holder: Pick<StaffCandidate, 'salaryPerHour'>): number {
  return holder.salaryPerHour * STAFF_POOL.severanceHours;
}

export function dismissStaff(d: GameState, managerId: ManagerId): HandlerResult {
  if (!isManagerId(managerId)) return refusal('Unknown manager');
  const holder = postHolder(d, managerId);
  if (!holder) return refusal(`Nobody holds the ${MANAGERS[managerId].title} post.`);
  const severance = staffSeverance(holder);
  if (d.department.funding < severance) return refusal(`Needs ${money(severance)} severance (have ${money(d.department.funding)})`);
  const t = simNow(d);
  if (managerId === 'quartermaster') {
    staffOn(d).quartermaster.resumeBudget = maintenanceBudget(d) || staffOn(d).quartermaster.resumeBudget;
    const result = setMaintenanceBudget(d, 0);
    if (!result.ok) return result;
  }
  postFunding(d.department, -severance, 'severance', `Severance for ${holder.person.firstName} ${holder.person.surname}`, t);
  const post = staffOn(d)[managerId].post;
  post.holder = null;
  log(staffOn(d)[managerId].log, t, `${holder.person.firstName} ${holder.person.surname} left the post${severance ? ` (${money(severance)} severance)` : ''}`);
  redraw(d, managerId, t, [holder.person.identityId]);
  return OK;
}

/** When the next free search for a vacant post opens. */
export function staffRefreshAt(state: GameState, managerId: ManagerId): number {
  return staffPostOf(state, managerId).drawnAt + STAFF_POOL.refreshCooldownMs;
}

export function refreshStaffPool(d: GameState, managerId: ManagerId): HandlerResult {
  if (!isManagerId(managerId)) return refusal('Unknown manager');
  if (!postOpen(d, managerId)) return refusal(`Open the ${MANAGERS[managerId].title} post in Develop first.`);
  if (staffPostOf(d, managerId).holder) return refusal('The post is filled.');
  const t = simNow(d);
  if (t < staffRefreshAt(d, managerId)) return refusal(`Next search in ${Math.ceil((staffRefreshAt(d, managerId) - t) / HOUR_MS)}h`);
  // A new search shows new people.
  redraw(d, managerId, t, staffPostOf(d, managerId).pool.map((c) => c.person.identityId));
  return OK;
}

export const COMMAND_STAFF_HANDLERS = { setManagerEnabled, setManagerPolicy, hireStaff, dismissStaff, refreshStaffPool };

// ---------------------------------------------------------------- read model

export interface ManagerView {
  profile: ManagerProfile;
  /** The post exists (opened in Develop). */
  open: boolean;
  /** The person in post, when hired. */
  holder: StaffHolder | null;
  /** Candidates on offer while the post is open and vacant. */
  pool: StaffCandidate[];
  hired: boolean;
  on: boolean;
  status: 'on' | 'off' | 'not_hired';
  log: ManagerLogEntry[];
  /** One plain line on what the manager is doing or waiting for. */
  activity: string;
  /** Develop price of the hire, and why it cannot be bought yet. */
  hire: { funding: number; reason: string | null } | null;
}

/** Lever lines for a person in or offered a post, in the post's own terms. */
export function leverLines(id: ManagerId, levers: [number, number]): { label: string; value: string; position: number }[] {
  return STAFF_LEVERS[id].map((def, index) => {
    const value = levers[index];
    const text = def.kind === 'share' ? `${Math.round(value * 100)}%` : String(value);
    return { label: def.label, value: text, position: def.high === def.low ? 0 : (value - def.low) / (def.high - def.low) };
  });
}

function activityOf(state: GameState, id: ManagerId, on: boolean): string {
  if (!on) return id === 'quartermaster' ? 'Off: no automatic servicing' : 'Off: no salary, no automation';
  const t = simNow(state);
  if (id === 'watch_commander') {
    const { policy } = commandStaffOf(state).watch_commander;
    const managed = state.squads.filter((squad) => !policy.optOut.includes(squad.id) && squad.officerIds.length > 0);
    if (!managed.length) return 'Every staffed squad is on manual duty';
    return `Watching ${managed.length} squad${managed.length === 1 ? '' : 's'}; rests at ${policy.restAt} stress`;
  }
  if (id === 'training_sergeant') {
    const pick = sergeantPick(state, t);
    return pick.officer ? `Next place goes to ${fullName(pick.officer)}` : pick.reason;
  }
  if (id === 'peer_support_lead') {
    const queue = supportQueue(state);
    const { policy } = commandStaffOf(state).peer_support_lead;
    return queue.length ? `Next session goes to ${fullName(queue[0])}` : `Nobody idle is at ${policy.supportAt} stress or more`;
  }
  if (id === 'recruiter') {
    const pick = recruiterPick(state);
    return 'reason' in pick ? pick.reason : `Next signing: ${pick.name}`;
  }
  return `Servicing worn gear up to ${money(maintenanceBudget(state))}/hour`;
}

export function managerView(state: GameState, id: ManagerId): ManagerView {
  const profile = MANAGERS[id];
  const open = postOpen(state, id);
  const holder = postHolder(state, id);
  const hired = holder !== null;
  const on = managerOn(state, id);
  const quote = open ? null : quoteDevelopment(state, profile.nodeId);
  const cost = quote?.cost ?? DEV_NODES[profile.nodeId]?.cost ?? null;
  return {
    profile,
    open,
    holder,
    pool: open && !hired ? staffPostOf(state, id).pool : [],
    hired,
    on,
    status: !hired ? 'not_hired' : on ? 'on' : 'off',
    log: commandStaffOf(state)[id].log,
    activity: hired ? activityOf(state, id, on) : open ? `${staffPostOf(state, id).pool.length} candidates to choose from`
      : quote?.missingPrerequisites.length
        ? `Needs ${quote.missingPrerequisites.map((nodeId) => DEV_NODES[nodeId]?.name ?? nodeId).join(', ')} first`
        : cost ? `Open the post in Develop for ${money(cost.funding)}, or reach ${milestoneView(state, DEV_NODES[profile.nodeId].grant).label.replace(/^Level/, 'level').replace(/^Trust/, 'trust')}` : 'Not open',
    hire: open || !cost ? null : { ...cost, reason: quote?.reason ?? null },
  };
}

export function managerViews(state: GameState): ManagerView[] {
  return MANAGER_IDS.map((id) => managerView(state, id));
}

// ---------------------------------------------------------------- save validation

const isObj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validLog = (value: unknown): boolean => Array.isArray(value) && value.length <= COMMAND_STAFF.logLimit
  && value.every((entry) => isObj(entry) && typeof entry.at === 'number' && Number.isFinite(entry.at) && typeof entry.text === 'string');

const validPerson = (p: unknown): boolean => isObj(p) && ['identityId', 'firstName', 'surname', 'portrait'].every((k) => typeof p[k] === 'string')
  && (p.pronouns === 'she' || p.pronouns === 'he' || p.pronouns === 'they') && (p.note === null || typeof p.note === 'string');
const validStaffCandidate = (c: unknown): boolean => isObj(c) && typeof c.id === 'string' && validPerson(c.person)
  && (c.archetype === 'seasoned' || c.archetype === 'specialist' || c.archetype === 'steady')
  && Array.isArray(c.levers) && c.levers.length === 2 && c.levers.every((v) => typeof v === 'number' && Number.isFinite(v))
  && typeof c.salaryPerHour === 'number' && c.salaryPerHour >= 0 && typeof c.signingCost === 'number' && c.signingCost >= 0;
function validPost(post: unknown): boolean {
  if (!isObj(post) || !Array.isArray(post.pool) || post.pool.length > STAFF_POOL.size || !post.pool.every(validStaffCandidate)) return false;
  if (typeof post.round !== 'number' || !Number.isInteger(post.round) || post.round < 0 || typeof post.drawnAt !== 'number' || !Number.isFinite(post.drawnAt)) return false;
  return post.holder === null || (validStaffCandidate(post.holder) && typeof (post.holder as Record<string, unknown>).hiredAt === 'number');
}

/** Structural check for a loaded save. Absent is valid for isolated hand-built states. */
export function validCommandStaff(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isObj(value)) return false;
  if (!MANAGER_IDS.every((id) => isObj(value[id]) && validPost((value[id] as Record<string, unknown>).post))) return false;
  const wc = value.watch_commander, ts = value.training_sergeant, qm = value.quartermaster;
  if (!isObj(wc) || typeof wc.enabled !== 'boolean' || !isObj(wc.policy) || !isObj(wc.rested) || !validLog(wc.log)) return false;
  const { minRestAt, maxRestAt } = COMMAND_STAFF.watchCommander;
  const restAt = wc.policy.restAt;
  if (typeof restAt !== 'number' || !Number.isInteger(restAt) || restAt < minRestAt || restAt > maxRestAt) return false;
  const optOut = wc.policy.optOut;
  if (!Array.isArray(optOut) || !optOut.every((id) => (SQUAD_IDS as readonly unknown[]).includes(id)) || new Set(optOut).size !== optOut.length) return false;
  if (!Object.entries(wc.rested).every(([id, duty]) => (SQUAD_IDS as readonly string[]).includes(id) && (duty === 'patrol' || duty === 'standby'))) return false;
  if (!isObj(ts) || typeof ts.enabled !== 'boolean' || !isObj(ts.policy) || !validLog(ts.log)) return false;
  const { courseId, reserve } = ts.policy;
  if (courseId !== null && !(typeof courseId === 'string' && Object.hasOwn(COURSES, courseId))) return false;
  if (typeof reserve !== 'number' || !Number.isInteger(reserve) || reserve < 0 || reserve > COMMAND_STAFF.trainingSergeant.maxReserve) return false;
  // Managers added after a save was written may be absent; one that is present must be well formed.
  const ps = value.peer_support_lead, rc = value.recruiter;
  if (ps !== undefined) {
    if (!isObj(ps) || typeof ps.enabled !== 'boolean' || !isObj(ps.policy) || !validLog(ps.log)) return false;
    const { supportAt, reserve: psReserve } = ps.policy;
    if (typeof supportAt !== 'number' || !COMMAND_STAFF.peerSupportLead.supportChoices.includes(supportAt)) return false;
    if (typeof psReserve !== 'number' || !Number.isInteger(psReserve) || psReserve < 0 || psReserve > COMMAND_STAFF.peerSupportLead.maxReserve) return false;
  }
  if (rc !== undefined) {
    if (!isObj(rc) || typeof rc.enabled !== 'boolean' || !isObj(rc.policy) || !validLog(rc.log)) return false;
    const { role, reserve: rcReserve } = rc.policy;
    if (role !== null && !(typeof role === 'string' && (ROLES as readonly string[]).includes(role))) return false;
    if (typeof rcReserve !== 'number' || !Number.isInteger(rcReserve) || rcReserve < 0 || rcReserve > COMMAND_STAFF.recruiter.maxReserve) return false;
  }
  if (!isObj(qm) || !validLog(qm.log)) return false;
  const resume = qm.resumeBudget;
  return typeof resume === 'number' && Number.isInteger(resume) && resume >= 1 && resume <= EQUIPMENT_MANAGER.maxHourlyBudget;
}
