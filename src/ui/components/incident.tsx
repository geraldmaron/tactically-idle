// Shared presentation for generated incidents: type and building labels, tier chevrons, difficulty band,
// environment chips, and a calm countdown. Content tables here are display fallbacks; the generators'
// own INCIDENT_TYPES / BUILDING_FAMILIES win when they provide a label.
import { useEffect, useState } from 'react';
import type { Armament, EnvironmentDefinition, ScenarioDefinition } from '../../sim/scenario-types';
import { SCENARIO_TYPES_V9 } from '../../content/scenario-recipes';
import { INCIDENT_TYPES_V4 } from '../../gen/incident';
import { ALL_BUILDING_FAMILIES } from '../../gen/building';
import { getBuilt } from '../../sim/resolution';
import { floorCount } from '../blueprint/floors';
import { Chip } from './ui';
import { Icon } from '../icons';
import type { IconName } from '../icons';

type Tone = 'neutral' | 'amber' | 'mint' | 'danger' | 'warn' | 'blue';

// ---------------------------------------------------------------- incident types and buildings

const INCIDENT_FALLBACK: Record<string, { label: string; icon: IconName }> = {
  welfare_check: { label: 'Welfare check', icon: 'heart' },
  domestic: { label: 'Domestic disturbance', icon: 'house' },
  person_in_crisis: { label: 'Person in crisis', icon: 'pulse' },
  barricaded: { label: 'Barricaded subject', icon: 'steeldoor' },
  burglary: { label: 'Burglary in progress', icon: 'unlock' },
  business_robbery: { label: 'Business robbery', icon: 'store' },
  holding: { label: 'Holding situation', icon: 'lock' },
  medical_complication: { label: 'Medical emergency', icon: 'medic' },
  disturbance: { label: 'Disturbance', icon: 'soundwave' },
  missing_vulnerable: { label: 'Missing person', icon: 'binoculars' },
  false_intruder: { label: 'Reported intruder', icon: 'question' },
  vacant_occupancy: { label: 'Vacant property', icon: 'eye' },
  active_armed_incident: { label: 'Active armed incident', icon: 'shield' },
  hostage_crisis: { label: 'Hostage crisis', icon: 'lock' },
  protected_rescue: { label: 'Protected rescue', icon: 'medic' },
};

function titleCase(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function incidentMeta(type: string | null | undefined): { label: string; icon: IconName } {
  if (!type) return { label: 'Operation', icon: 'pin' };
  const fb = INCIDENT_FALLBACK[type];
  const gen = [...SCENARIO_TYPES_V9, ...INCIDENT_TYPES_V4].find((t) => t.type === type);
  return { label: gen?.label ?? fb?.label ?? titleCase(type), icon: fb?.icon ?? 'pin' };
}

/** Building content is authored in British English; player-facing copy is American. */
function americanBuildingWords(text: string): string {
  return text.replaceAll('storey', 'story').replace(/\ba flat\b/g, 'an apartment').replace(/\bflat\b/g, 'apartment').replace(/\bshop\b/g, 'store');
}

export function familyBlurb(familyId: string | null | undefined): string | null {
  if (!familyId) return null;
  // The persistence key identifies a furniture version, not a player-facing place.
  familyId = familyId.replace(/__furnished_v7$/, '');
  const f = ALL_BUILDING_FAMILIES.find((x) => x.id === familyId);
  if (f) return americanBuildingWords(f.blurb);
  return familyId === 'maple_street' ? 'Single-story house' : titleCase(familyId);
}

/** Short name of a building type for pickers, e.g. 'Cedar Close' or 'Two-story house'. */
export function familyLabel(familyId: string): string {
  const f = ALL_BUILDING_FAMILIES.find((x) => x.id === familyId.replace(/__furnished_v7$/, ''));
  return f ? americanBuildingWords(f.label) : titleCase(familyId);
}

/** Floors of the building a scenario actually uses. A v10 call may be hosted on a different
 * layout than the one drawn, so this reads the scenario's location, never the incident spec. */
export function scenarioFloorCount(scenario: ScenarioDefinition | null | undefined): number {
  if (!scenario) return 1;
  try {
    return floorCount(getBuilt(scenario.locationFamilyId, scenario.locationSeed).location);
  } catch {
    return 1;
  }
}

/** Only multi-floor buildings get a chip: on a phone the floor tabs are easy to miss. */
export function FloorsChip({ floors }: { floors: number }) {
  return floors > 1 ? <Chip icon="layers" title="Use the floor tabs on the map to see each floor">{floors} floors</Chip> : null;
}

export function settingIcon(setting: 'residential' | 'business' | 'apartment' | string): IconName {
  return setting === 'residential' ? 'house' : setting === 'business' ? 'store' : 'layers';
}

// ---------------------------------------------------------------- tier and difficulty

/** Tier 1 to 5 as chevrons. Filled count = tier. Never colour alone: the number is in the label. */
export function TierChevrons({ tier, max = 5 }: { tier: number; max?: number }) {
  const t = Math.max(0, Math.min(max, Math.round(tier)));
  return (
    <span className="tier" role="img" aria-label={`Tier ${t} of ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} viewBox="0 0 12 10" width="12" height="10" className={i < t ? 'tier-on' : 'tier-off'} aria-hidden="true">
          <path d="M1.5 8L6 3l4.5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

export type DifficultyBand = 'low' | 'moderate' | 'high' | 'severe';
const BAND_TONE: Record<DifficultyBand, Tone> = { low: 'mint', moderate: 'amber', high: 'warn', severe: 'danger' };
const BAND_WORD: Record<DifficultyBand, string> = { low: 'Low', moderate: 'Moderate', high: 'High', severe: 'Severe' };

export function DifficultyChip({ band }: { band: DifficultyBand }) {
  return (
    <Chip tone={BAND_TONE[band]} icon="mountain" title="Expected difficulty, conditional on what is known now">
      {BAND_WORD[band]} difficulty
    </Chip>
  );
}

// ---------------------------------------------------------------- armament

export const ARMAMENT_LABEL: Record<string, string> = {
  none: 'Unarmed',
  blunt: 'Blunt object',
  edged: 'Edged weapon',
  handgun: 'Handgun',
  long_gun: 'Long gun',
  unknown: 'Unknown object',
};

export function armamentLabel(a: Armament | string): string {
  return ARMAMENT_LABEL[a] ?? titleCase(a);
}

// ---------------------------------------------------------------- environment chips

export interface EnvChip {
  key: string;
  icon: IconName;
  label: string;
  tone: Tone;
  /** What it changes, for the long-press title and screen readers. */
  title: string;
}

const HAZARD: Record<EnvironmentDefinition['hazards'][number], { label: string; icon: IconName; title: string }> = {
  gas: { label: 'Gas smell', icon: 'warning', title: 'Gas smell: some actions are restricted and strain rises' },
  fire_risk: { label: 'Fire risk', icon: 'flame', title: 'Fire risk: some actions are restricted and strain rises' },
  structural: { label: 'Structural risk', icon: 'brick', title: 'Structural risk: some actions are restricted and strain rises' },
  biohazard: { label: 'Biohazard', icon: 'warning', title: 'Biohazard: some actions are restricted and strain rises' },
};

function clutterWord(c: number): string {
  if (c < 0.2) return 'Tidy';
  if (c < 0.5) return 'Some clutter';
  if (c < 0.75) return 'Cluttered';
  return 'Heavy clutter';
}

/** Chips in reading order: conditions first, then access aids. Every chip names the thing it changes. */
export function environmentChips(env: EnvironmentDefinition): EnvChip[] {
  const out: EnvChip[] = [];
  const time = { day: ['Daylight', 'sun', 'neutral'], dusk: ['Dusk', 'sunset', 'neutral'], night: ['Night', 'moon', 'amber'] } as const;
  const [tl, ti, tt] = time[env.timeOfDay];
  out.push({ key: 'time', icon: ti, label: tl, tone: tt, title: 'Time of day: lighting and where people are likely to be' });

  const weather: Record<EnvironmentDefinition['weather'], [string, IconName, Tone]> = {
    clear: ['Clear', 'eye', 'neutral'],
    rain: ['Rain', 'rain', 'amber'],
    wind: ['Windy', 'wind', 'neutral'],
    fog: ['Fog', 'cloud', 'amber'],
    snow: ['Snow', 'snow', 'amber'],
  };
  const [wl, wi, wt] = weather[env.weather];
  out.push({ key: 'weather', icon: wi, label: wl, tone: wt, title: 'Weather: outside sound and visibility' });

  out.push(
    env.power === 'on'
      ? { key: 'power', icon: 'plug', label: 'Power on', tone: 'neutral', title: 'Power: whether the lights are on inside' }
      : { key: 'power', icon: 'plug', label: 'Power off', tone: 'warn', title: 'Power: lights are out, so vision inside is poor' },
  );
  out.push({ key: 'clutter', icon: 'box', label: clutterWord(env.clutter), tone: env.clutter >= 0.5 ? 'amber' : 'neutral', title: 'Clutter: reduces usable space and movement speed' });

  if (env.hazards.length === 0) out.push({ key: 'hazard-none', icon: 'checkcircle', label: 'No hazards reported', tone: 'neutral', title: 'Hazards: none reported' });
  for (const h of env.hazards) out.push({ key: `hazard-${h}`, icon: HAZARD[h].icon, label: HAZARD[h].label, tone: 'warn', title: HAZARD[h].title });

  if (env.communication === 'language_barrier') out.push({ key: 'comm', icon: 'chat', label: 'Language barrier', tone: 'amber', title: 'Communication: contact is harder without a shared language' });
  else if (env.communication === 'hearing_impaired') out.push({ key: 'comm', icon: 'ear', label: 'Hearing impaired', tone: 'amber', title: 'Communication: voice contact is harder' });
  else out.push({ key: 'comm', icon: 'chat', label: 'Contact: normal', tone: 'neutral', title: 'Communication: no barrier reported' });

  out.push(
    env.crowd === 2
      ? { key: 'crowd', icon: 'crowd', label: 'Crowd outside', tone: 'amber', title: 'Bystanders: a crowd raises civilian-safety pressure' }
      : env.crowd === 1
        ? { key: 'crowd', icon: 'people', label: 'Some bystanders', tone: 'neutral', title: 'Bystanders: some people outside' }
        : { key: 'crowd', icon: 'people', label: 'No crowd', tone: 'neutral', title: 'Bystanders: none outside' },
  );

  out.push(
    env.keyholder
      ? { key: 'key', icon: 'key', label: 'Keyholder', tone: 'mint', title: 'Access aid: a keyholder can unlock a door' }
      : { key: 'key', icon: 'key', label: 'No keyholder', tone: 'neutral', title: 'Access aid: nobody holds a key' },
  );
  out.push(
    env.plansOnFile
      ? { key: 'plans', icon: 'blueprint', label: 'Plans on file', tone: 'mint', title: 'Access aid: better starting knowledge of the layout' }
      : { key: 'plans', icon: 'blueprint', label: 'No plans on file', tone: 'neutral', title: 'Access aid: the layout is not on file' },
  );
  out.push(
    env.alarm === 'triggered'
      ? { key: 'alarm', icon: 'bell', label: 'Alarm sounding', tone: 'warn', title: 'Alarm: triggered' }
      : env.alarm === 'armed'
        ? { key: 'alarm', icon: 'bell', label: 'Alarm armed', tone: 'amber', title: 'Alarm: armed; entry may set it off' }
        : { key: 'alarm', icon: 'bell', label: 'No alarm', tone: 'neutral', title: 'Alarm: none fitted' },
  );
  out.push(
    env.cctv
      ? { key: 'cctv', icon: 'camera', label: 'CCTV', tone: 'mint', title: 'Access aid: camera footage available' }
      : { key: 'cctv', icon: 'camera', label: 'No CCTV', tone: 'neutral', title: 'Access aid: no cameras' },
  );
  return out;
}

/** Lead with conditions that change a plan; routine absences stay available in details. */
export function relevantEnvironmentChips(env: EnvironmentDefinition): EnvChip[] {
  const keys = new Set(['time', ...(env.weather !== 'clear' ? ['weather'] : []), ...(env.power !== 'on' ? ['power'] : []), ...(env.clutter > 0 ? ['clutter'] : []), ...(env.communication !== 'normal' ? ['comm'] : []), ...(env.crowd > 0 ? ['crowd'] : []), ...(env.keyholder ? ['key'] : []), ...(env.plansOnFile ? ['plans'] : []), ...(env.alarm !== 'none' ? ['alarm'] : []), ...(env.cctv ? ['cctv'] : []), ...env.hazards.map(h => `hazard-${h}`)]);
  return environmentChips(env).filter(chip => keys.has(chip.key));
}
export function EnvChips({ env }: { env: EnvironmentDefinition }) {
  const important = relevantEnvironmentChips(env);
  const rest = environmentChips(env).filter(chip => !important.some(shown => shown.key === chip.key));
  const list = (chips: EnvChip[], label: string) => <ul className="envchips" aria-label={label}>{chips.map(c => <li key={c.key}><Chip tone={c.tone} icon={c.icon} title={c.title}>{c.label}</Chip></li>)}</ul>;
  return <>{list(important, 'Scene conditions')}{rest.length > 0 && <details className="scene-condition-details"><summary>Other reported conditions</summary>{list(rest, 'Other reported conditions')}</details>}</>;
}

// ---------------------------------------------------------------- calm countdown

/** Re-render on an interval so a countdown stays live. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** '2h 14m' above an hour, '14m 07s' below, so the last hour visibly ticks. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

export function TimeLeft({ expiresAt, now }: { expiresAt: number; now: number }) {
  const left = expiresAt - now;
  if (left <= 0) {
    return (
      <span className="timeleft timeleft-gone">
        <Icon name="hourglass" size={14} />
        Closed: another unit took it
      </span>
    );
  }
  return (
    <span className={`timeleft${left < 15 * 60000 ? ' timeleft-soon' : ''}`}>
      <Icon name="hourglass" size={14} />
      <span>
        Open for <b>{countdown(left)}</b>
        {left < 15 * 60000 ? ' · closing soon' : ''}
      </span>
    </span>
  );
}

/** Time left as a draining bar plus the countdown. The bar is the share of the call's open window
 * still remaining; the words carry the exact time, so the bar is never the only signal. */
export function TimeLeftBar({ arrivedAt, expiresAt, now }: { arrivedAt: number; expiresAt: number; now: number }) {
  const left = expiresAt - now;
  const span = Math.max(1, expiresAt - arrivedAt);
  const share = Math.max(0, Math.min(1, left / span));
  const soon = left > 0 && left < 15 * 60000;
  return (
    <span className={`timebar${soon ? ' timebar-soon' : ''}${left <= 0 ? ' timebar-gone' : ''}`}>
      <span className="timebar-track" aria-hidden="true"><i style={{ width: `${Math.round(share * 100)}%` }} /></span>
      <span className="timebar-text">
        <Icon name="hourglass" size={13} />
        {left <= 0 ? 'Closed: another unit took it' : <><b>{countdown(left)}</b>{soon ? ' left · closing soon' : ' left'}</>}
      </span>
    </span>
  );
}
