// Command Staff: hired managers who each automate one loop the player already runs by
// hand. They never make tactical or operation decisions.
// - Watch Commander: rests idle squads when someone is worn down and returns them to their
//   earning duty once everyone is fresh, through the same rules as the setSquadDuty command.
// - Training Sergeant: fills free training places with the most rested eligible officer,
//   using the same course rules as the startCourse command, above a funding reserve.
// - Quartermaster: the existing equipment manager (servicing budget) plus restock rules,
//   presented as staff. Its mechanics live in equipment-manager.ts and are not changed here.
// Hiring is a Develop purchase. Each manager has an on/off switch, a small policy, an hourly
// salary paid with payroll (economy.ratesAt) while switched on, and a saved activity log.
// Automation runs inside settle() at absolute clock hours within the 24-hour accrual window,
// exactly like restock rules, so an offline settlement equals any sequence of online ticks.
import type { GameState, HandlerResult, Id, Officer, SquadDuty, SquadId } from './types';
import { SQUAD_IDS } from './types';
import { COURSES } from '../content/courses';
import { DEV_NODES } from '../content/dev-tree';
import { HOUR_MS, isInjured, isNodeUnlocked, money, simNow, squadDeployed } from './economy';
import { courseCheck } from './develop';
import { ROSTER_HANDLERS } from './roster';
import { fullName, STRESS_BANDS } from './officer';
import { effectiveDevelopmentEffects, quoteDevelopment } from './development-tiers';
import { EQUIPMENT_MANAGER, hasEquipmentManager, maintenanceBudget } from './equipment-manager-policy';
import { setMaintenanceBudget } from './equipment-manager';

// ---------------------------------------------------------------- shapes

export type ManagerId = 'watch_commander' | 'training_sergeant' | 'quartermaster';
export const MANAGER_IDS: readonly ManagerId[] = ['watch_commander', 'training_sergeant', 'quartermaster'];

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

/** Added in save v9. Optional on GameState only for hand-built fixtures and migration inputs. */
export interface CommandStaffState {
  watch_commander: {
    enabled: boolean;
    policy: WatchCommanderPolicy;
    /** Duty each squad held when the Watch Commander rested it. */
    rested: Partial<Record<SquadId, EarningDuty>>;
    log: ManagerLogEntry[];
  };
  training_sergeant: {
    enabled: boolean;
    policy: TrainingSergeantPolicy;
    log: ManagerLogEntry[];
  };
  quartermaster: {
    /** Hourly service budget restored when the Quartermaster is switched back on. */
    resumeBudget: number;
    log: ManagerLogEntry[];
  };
}

export type ManagerPolicyPatch =
  | { managerId: 'watch_commander'; restAt?: number; optOut?: SquadId[] }
  | { managerId: 'training_sergeant'; courseId?: Id | null; reserve?: number }
  | { managerId: 'quartermaster'; budgetPerHour?: number };

// ---------------------------------------------------------------- tuning and roster

/** First-pass balance values. */
export const COMMAND_STAFF = {
  logLimit: 20,
  watchCommander: {
    nodeId: 'personnel_watch_commander',
    salaryPerHour: 45,
    defaultRestAt: STRESS_BANDS.overloaded,
    /** A rested squad returns once every member is below this. */
    returnBelow: STRESS_BANDS.strained,
    minRestAt: STRESS_BANDS.strained,
    maxRestAt: STRESS_BANDS.recovery,
    restChoices: [STRESS_BANDS.strained, 45, STRESS_BANDS.overloaded, 70] as readonly number[],
  },
  trainingSergeant: {
    nodeId: 'personnel_training_sergeant',
    salaryPerHour: 45,
    /** Only officers below this stress are enrolled. */
    maxStress: STRESS_BANDS.strained,
    defaultReserve: 2500,
    maxReserve: 100_000,
    reserveChoices: [1000, 2500, 5000, 10_000] as readonly number[],
  },
  quartermaster: {
    nodeId: EQUIPMENT_MANAGER.nodeId,
    /** The equipment manager never had a salary; its cost is the service budget it spends. */
    salaryPerHour: 0,
    defaultBudget: 200,
  },
} as const;

export interface ManagerProfile {
  id: ManagerId;
  name: string;
  title: string;
  nodeId: Id;
  salaryPerHour: number;
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
    name: 'Sam Navarro',
    title: 'Watch Commander',
    nodeId: COMMAND_STAFF.watchCommander.nodeId,
    salaryPerHour: COMMAND_STAFF.watchCommander.salaryPerHour,
    loop: 'Squad duty and rest',
    duty: 'Each clock hour, moves an idle squad to Rest when anyone reaches your stress limit, then back to its earlier duty once everyone is below Strained.',
    never: 'Never touches deployed squads, operations or squads you keep on manual duty.',
  },
  training_sergeant: {
    id: 'training_sergeant',
    name: 'Jordan Pike',
    title: 'Training Sergeant',
    nodeId: COMMAND_STAFF.trainingSergeant.nodeId,
    salaryPerHour: COMMAND_STAFF.trainingSergeant.salaryPerHour,
    loop: 'Course enrolment',
    duty: 'Each clock hour, fills free training places with the most rested officer who can take your chosen course, keeping funding above your reserve.',
    never: 'Never enrols deployed, injured or strained officers, and never picks a course for you.',
  },
  quartermaster: {
    id: 'quartermaster',
    name: 'Robin Kessler',
    title: 'Quartermaster',
    nodeId: COMMAND_STAFF.quartermaster.nodeId,
    salaryPerHour: COMMAND_STAFF.quartermaster.salaryPerHour,
    loop: 'Servicing and restock',
    duty: 'Each clock hour, sends worn idle equipment for service within an hourly budget. Restock rules refill held stock on the same clock.',
    never: 'Never buys new kinds of equipment or touches gear reserved for a call.',
  },
};

// ---------------------------------------------------------------- state access

export function createCommandStaff(): CommandStaffState {
  return {
    watch_commander: { enabled: true, policy: { restAt: COMMAND_STAFF.watchCommander.defaultRestAt, optOut: [] }, rested: {}, log: [] },
    training_sergeant: { enabled: true, policy: { courseId: null, reserve: COMMAND_STAFF.trainingSergeant.defaultReserve }, log: [] },
    quartermaster: { resumeBudget: COMMAND_STAFF.quartermaster.defaultBudget, log: [] },
  };
}

/** Read-only view; states from before save v9 (and hand-built fixtures) read as defaults. */
export function commandStaffOf(state: GameState): CommandStaffState {
  return state.commandStaff ?? createCommandStaff();
}

/** Writable staff record on a draft, created on first write. */
function staffOn(d: GameState): CommandStaffState {
  d.commandStaff ??= createCommandStaff();
  return d.commandStaff;
}

/** Hired through Develop. The Quartermaster is the equipment manager node. */
export function managerHired(state: GameState, id: ManagerId): boolean {
  if (id === 'quartermaster') return hasEquipmentManager(state);
  return effectiveDevelopmentEffects(state).some((effect) => effect.kind === 'commandStaff' && effect.managerId === id);
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
  for (const id of MANAGER_IDS) if (managerOn(state, id)) total += MANAGERS[id].salaryPerHour;
  return total;
}

/** Does settlement need the hourly grid for Command Staff? */
export function commandStaffActive(state: GameState): boolean {
  return managerOn(state, 'watch_commander') || managerOn(state, 'training_sergeant');
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
  const { returnBelow } = COMMAND_STAFF.watchCommander;
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
  if (decide(state.department.funding - course.cost) < policy.reserve) {
    return { officer: null, reason: `Waiting: the ${money(course.cost)} fee would take funding below the ${money(policy.reserve)} reserve` };
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
    d.department.funding -= course.cost;
    pick.officer.assignment = { kind: 'training', courseId: course.id, startedAt: t, endsAt: t + Math.round(course.hours * HOUR_MS) };
    log(ts.log, t, `Enrolled ${fullName(pick.officer)} in ${course.name} (${money(course.cost)})`);
  }
}

/**
 * Called by settle() at each absolute clock hour inside the accrual window, after restock
 * and equipment servicing. Duty first, so the sergeant's budget check sees the new duties.
 */
export function runCommandStaff(d: GameState, t: number): void {
  runWatchCommander(d, t);
  runTrainingSergeant(d, t);
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
  if (!managerHired(d, managerId)) return refusal(`Hire the ${profile.title} in Develop first.`);
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
  if (!managerHired(d, patch.managerId)) return refusal(`Hire the ${profile.title} in Develop first.`);
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

export const COMMAND_STAFF_HANDLERS = { setManagerEnabled, setManagerPolicy };

// ---------------------------------------------------------------- read model

export interface ManagerView {
  profile: ManagerProfile;
  hired: boolean;
  on: boolean;
  status: 'on' | 'off' | 'not_hired';
  log: ManagerLogEntry[];
  /** One plain line on what the manager is doing or waiting for. */
  activity: string;
  /** Develop price of the hire, and why it cannot be bought yet. */
  hire: { dp: number; funding: number; reason: string | null } | null;
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
  return `Servicing worn gear up to ${money(maintenanceBudget(state))}/hour`;
}

export function managerView(state: GameState, id: ManagerId): ManagerView {
  const profile = MANAGERS[id];
  const hired = managerHired(state, id);
  const on = managerOn(state, id);
  const quote = hired ? null : quoteDevelopment(state, profile.nodeId);
  const cost = quote?.cost ?? DEV_NODES[profile.nodeId]?.cost ?? null;
  return {
    profile,
    hired,
    on,
    status: !hired ? 'not_hired' : on ? 'on' : 'off',
    log: commandStaffOf(state)[id].log,
    activity: hired ? activityOf(state, id, on) : quote?.missingPrerequisites.length
      ? `Needs ${quote.missingPrerequisites.map((nodeId) => DEV_NODES[nodeId]?.name ?? nodeId).join(', ')} first`
      : cost ? `Hire in Develop: ${cost.dp} DP + ${money(cost.funding)}` : 'Not hired',
    hire: hired || !cost ? null : { ...cost, reason: quote?.reason ?? null },
  };
}

export function managerViews(state: GameState): ManagerView[] {
  return MANAGER_IDS.map((id) => managerView(state, id));
}

// ---------------------------------------------------------------- save validation

const isObj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validLog = (value: unknown): boolean => Array.isArray(value) && value.length <= COMMAND_STAFF.logLimit
  && value.every((entry) => isObj(entry) && typeof entry.at === 'number' && Number.isFinite(entry.at) && typeof entry.text === 'string');

/** Structural check for a loaded save. Absent is valid (hand-built states); old saves migrate to defaults. */
export function validCommandStaff(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isObj(value)) return false;
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
  if (!isObj(qm) || !validLog(qm.log)) return false;
  const resume = qm.resumeBudget;
  return typeof resume === 'number' && Number.isInteger(resume) && resume >= 1 && resume <= EQUIPMENT_MANAGER.maxHourlyBudget;
}
