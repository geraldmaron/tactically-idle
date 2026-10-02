// Environment contributors for operation resolution. Every modifier here is one named
// effect with one variable behind it, so a test can change a single field of
// `ScenarioDefinition.environment` and watch exactly one contributor move. Game
// abstractions: lighting, sound carry, clutter, hazards, language, bystanders and access
// aids change risk, strain, time and options. Nothing here is a procedure.
import type { BuiltLocation, Contributor, Id, Officer, OperationRun } from './types';
import type { ActionDefinition, EnvironmentDefinition, ScenarioDefinition } from './scenario-types';
import { HAZARD_FLAG } from './scenario-types';

export const ENV_TUNING = {
  /** Visual multiplier on sightlines (1 = bright daylight with the lights on). */
  light: { dusk: 0.85, night: 0.6, powerOff: 0.7 },
  /** Added observation difficulty for squads that cannot read heat. */
  observationDifficulty: { dusk: 1.5, night: 3, powerOff: 2 },
  /** Strain multipliers (compounding). */
  strain: { powerOff: 1.1, gas: 1.1, biohazard: 1.1 },
  /** Outdoor sound carry (hailer, voice from outside). */
  weatherSound: { clear: 1, rain: 0.8, wind: 0.75, fog: 1, snow: 0.9 },
  /** Outdoor visual carry. */
  weatherVisual: { clear: 1, rain: 0.95, wind: 1, fog: 0.65, snow: 0.9 },
  clutter: {
    /** Below this, clutter has no effect. */
    min: 0.1,
    /** Capacity loss at clutter 1. */
    capacity: 0.6,
    /** Extra interior movement time at clutter 1. */
    travel: 0.5,
  },
  fire: { rateMult: 1.3, score: -2 },
  structural: { difficulty: 0 },
  biohazard: { medicalDifficulty: 4 },
  /** Contact penalty (score points) by barrier. */
  communication: { language_barrier: 9, hearing_impaired: 7 },
  /** Share of the barrier a calm voice removes; a language-trained officer removes all of it. */
  calmVoiceShare: 0.5,
  crowd: {
    /** Pressure rate added per crowd level. */
    rate: 0.15,
    /** Civilian-safety loss multiplier added per level once over the pressure threshold. */
    civilian: 0.3,
    /** Score lost on actions carried out outside, per level. */
    outside: -2.5,
  },
  keyholderScore: 2,
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function environmentOf(s: Pick<ScenarioDefinition, 'environment'>): EnvironmentDefinition | null {
  return s.environment ?? null;
}

/** True when the space is an exterior zone. */
export function isOutside(built: BuiltLocation, spaceId: Id): boolean {
  return built.location.zones.some((z) => z.id === spaceId);
}

/** Visual multiplier for sightlines from the lighting alone: 1 when nothing dims the scene. */
export function lightFactor(env: EnvironmentDefinition | null): number {
  if (!env) return 1;
  let f = 1;
  if (env.timeOfDay === 'night') f *= ENV_TUNING.light.night;
  else if (env.timeOfDay === 'dusk') f *= ENV_TUNING.light.dusk;
  if (env.power === 'off') f *= ENV_TUNING.light.powerOff;
  return f;
}

/** Why the lighting is poor, in player language. Null in good light. */
export function lightReason(env: EnvironmentDefinition | null): string | null {
  if (!env) return null;
  const parts: string[] = [];
  if (env.timeOfDay === 'night') parts.push('night');
  else if (env.timeOfDay === 'dusk') parts.push('dusk');
  if (env.power === 'off') parts.push('power out');
  return parts.length ? parts.join(' and ') : null;
}

/** Observation difficulty added by poor light (none when the action reads heat). */
export function observationDifficulty(env: EnvironmentDefinition | null, usesThermal: boolean): { value: number; label: string } | null {
  if (!env || usesThermal) return null;
  let v = 0;
  if (env.timeOfDay === 'night') v += ENV_TUNING.observationDifficulty.night;
  else if (env.timeOfDay === 'dusk') v += ENV_TUNING.observationDifficulty.dusk;
  if (env.power === 'off') v += ENV_TUNING.observationDifficulty.powerOff;
  if (v <= 0) return null;
  return { value: v, label: `Poor light (${lightReason(env)}): harder to read a scene` };
}

/** Strain multiplier from the environment (applies to everyone deployed) and its named causes. */
export function environmentStrain(env: EnvironmentDefinition | null): { mult: number; causes: string[] } {
  if (!env) return { mult: 1, causes: [] };
  let mult = 1;
  const causes: string[] = [];
  if (env.power === 'off') {
    mult *= ENV_TUNING.strain.powerOff;
    causes.push('Power out: working in the dark adds strain');
  }
  if (env.hazards.includes('gas')) {
    mult *= ENV_TUNING.strain.gas;
    causes.push('Gas smell: everyone works on edge');
  }
  if (env.hazards.includes('biohazard')) {
    mult *= ENV_TUNING.strain.biohazard;
    causes.push('Biohazard: protective handling adds strain');
  }
  return { mult: round1(mult * 100) / 100, causes };
}

/** Floor of a space (zones are 0). */
export function floorOfSpace(built: BuiltLocation, id: Id): number {
  return built.derived.spaces[id]?.floor ?? built.location.rooms.find((r) => r.id === id)?.floor ?? 0;
}

/** Reasons the environment makes an action unavailable. */
export function environmentGates(
  scenario: Pick<ScenarioDefinition, 'environment'>,
  run: Pick<OperationRun, 'flags'>,
  action: ActionDefinition,
  built: BuiltLocation,
): string[] {
  const env = scenario.environment ?? null;
  const out: string[] = [];
  for (const need of action.requires.env ?? []) {
    if (need === 'cctv') {
      if (!env?.cctv) out.push('There is no camera system at this address');
      else if (env.power === 'off') out.push('The cameras are down: the power is out');
    } else if (need === 'keyholder' && !env?.keyholder) out.push('No keyholder has been reached');
  }
  if (action.keyholder && !env?.keyholder) out.push('No keyholder has been reached');
  if (env) {
    if (env.hazards.includes('gas') && action.check.kind === 'execution' && action.tempo === 'urgent' && !action.hazardReason && !run.flags.includes(HAZARD_FLAG.gas))
      out.push('Gas smell reported: no rushed entry without a reason');
    if (
      env.hazards.includes('structural') &&
      action.approach === 'path' &&
      floorOfSpace(built, action.targetId) >= 1 &&
      !action.hazardReason &&
      !run.flags.includes(HAZARD_FLAG.structural)
    )
      out.push('The upper floor is reported unsafe: nobody goes up until it is checked');
  }
  return out;
}

/** Calm-voice partial mitigation and the future 'language' trait, in one place. */
export function communicationPenalty(env: EnvironmentDefinition | null, participants: Officer[]): { value: number; label: string; mitigation: string | null } | null {
  if (!env || env.communication === 'normal') return null;
  const base = ENV_TUNING.communication[env.communication];
  const noun = env.communication === 'language_barrier' ? 'Language barrier' : 'Hearing impairment';
  const trained = participants.find((o) => (o.traits as string[]).includes('language'));
  const calm = participants.find((o) => o.traits.includes('calm_voice'));
  if (trained) return { value: 0, label: `${noun}: ${trained.surname} can bridge it`, mitigation: trained.surname };
  if (calm) {
    const left = round1(base * (1 - ENV_TUNING.calmVoiceShare));
    return { value: -left, label: `${noun}: ${calm.surname}'s calm voice helps a little`, mitigation: calm.surname };
  }
  return { value: -base, label: `${noun}: hard to be understood`, mitigation: null };
}

export function clutterEffects(env: EnvironmentDefinition | null): { capacityMult: number; travelMult: number } {
  const c = env?.clutter ?? 0;
  if (c < ENV_TUNING.clutter.min) return { capacityMult: 1, travelMult: 1 };
  return { capacityMult: 1 - ENV_TUNING.clutter.capacity * c, travelMult: 1 + ENV_TUNING.clutter.travel * c };
}

export function crowdScore(env: EnvironmentDefinition | null): number {
  return env ? ENV_TUNING.crowd.outside * env.crowd : 0;
}

/** Contributor-shaped difficulty entry: difficulty adds are carried as negative 'difficulty' contributors. */
export function difficultyContributor(label: string, add: number): Contributor {
  return { label, value: -add, source: 'difficulty' };
}
