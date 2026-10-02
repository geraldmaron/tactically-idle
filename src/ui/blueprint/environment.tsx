// Environment on the sheet: a darker paper wash for dusk/night, a light diagonal hatch over exterior zones for
// rain / fog / snow, a crowd cluster in the street zone, and one compact row of text-plus-icon chips. The
// chips carry every condition in words; nothing here relies on colour alone.
import type { EnvironmentDefinition } from '../../sim/scenario-types';
import type { Polygon } from '../../sim/types';
import { Icon, type IconName } from '../icons';
import type { Rect } from './geometry';
import { polyPath } from './geometry';

export interface EnvChip {
  key: string;
  label: string;
  icon: IconName;
  kind: 'hazard' | 'power' | 'time' | 'weather' | 'crowd';
}

const HAZARD: Record<EnvironmentDefinition['hazards'][number], { label: string; icon: IconName }> = {
  gas: { label: 'GAS?', icon: 'warning' },
  fire_risk: { label: 'FIRE RISK', icon: 'flame' },
  structural: { label: 'UNSTABLE', icon: 'warning' },
  biohazard: { label: 'BIOHAZARD', icon: 'warning' },
};

const WEATHER: Partial<Record<EnvironmentDefinition['weather'], { label: string; icon: IconName }>> = {
  rain: { label: 'RAIN', icon: 'rain' },
  fog: { label: 'FOG', icon: 'cloud' },
  snow: { label: 'SNOW', icon: 'snow' },
  wind: { label: 'WIND', icon: 'wind' },
};

/** Chips for the conditions that are in effect, most operationally urgent first. Clear day, power on: none. */
export function envChips(env: EnvironmentDefinition | undefined): EnvChip[] {
  if (!env) return [];
  const out: EnvChip[] = [];
  for (const h of env.hazards ?? []) out.push({ key: `hz-${h}`, kind: 'hazard', ...HAZARD[h] });
  if (env.power === 'off') out.push({ key: 'power', kind: 'power', label: 'NO POWER', icon: 'plug' });
  if (env.timeOfDay === 'night') out.push({ key: 'time', kind: 'time', label: 'NIGHT', icon: 'moon' });
  else if (env.timeOfDay === 'dusk') out.push({ key: 'time', kind: 'time', label: 'DUSK', icon: 'moon' });
  const w = WEATHER[env.weather];
  if (w) out.push({ key: 'weather', kind: 'weather', ...w });
  if (env.crowd === 2) out.push({ key: 'crowd', kind: 'crowd', label: 'CROWD', icon: 'crowd' });
  else if (env.crowd === 1) out.push({ key: 'crowd', kind: 'crowd', label: 'BYSTANDERS', icon: 'crowd' });
  return out;
}

/** Rows the chips need at `availPx` wide (estimate; a chip is icon + padding + roughly 6.6 px a letter). */
export function chipRows(chips: EnvChip[], availPx: number): number {
  if (!chips.length) return 0;
  let rows = 1;
  let used = 0;
  for (const c of chips) {
    const w = 31 + 6.6 * c.label.length + 4;
    if (used > 0 && used + w > availPx) {
      rows += 1;
      used = 0;
    }
    used += w;
  }
  return rows;
}

export function EnvChips({ chips }: { chips: EnvChip[] }) {
  if (!chips.length) return null;
  return (
    <ul className="bp-chips" aria-label="Conditions">
      {chips.map((c) => (
        <li key={c.key} className={`bp-envchip bp-envchip-${c.kind}`}>
          <span className="bp-envchip-icon" aria-hidden="true">
            <Icon name={c.icon} size={13} strokeWidth={2} />
            {c.kind === 'power' && <i className="bp-envchip-slash" />}
          </span>
          {c.label}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ SVG layers

export const envIds = (uid: string) => ({ rain: `${uid}-wx-rain`, snow: `${uid}-wx-snow`, fog: `${uid}-wx-fog`, wash: `${uid}-wash` });

export function EnvDefs({ uid }: { uid: string }) {
  const id = envIds(uid);
  return (
    <defs>
      {/* steep dashed diagonals */}
      <pattern id={id.rain} width="1.1" height="1.1" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
        <path d="M0.3 0V0.55" stroke="var(--chalk)" strokeWidth="0.09" strokeOpacity="0.5" strokeLinecap="round" />
      </pattern>
      {/* diagonal hatch with flakes */}
      <pattern id={id.snow} width="1.4" height="1.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0.7H1.4" stroke="var(--chalk)" strokeWidth="0.06" strokeOpacity="0.28" />
        <circle cx="0.7" cy="0.7" r="0.1" fill="var(--chalk)" fillOpacity="0.6" />
      </pattern>
      {/* wide, thin diagonals */}
      <pattern id={id.fog} width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <path d="M0 1H2" stroke="var(--chalk)" strokeWidth="0.1" strokeOpacity="0.2" />
      </pattern>
    </defs>
  );
}

/** Darker paper wash. Dusk is subtle, night a little more; line work stays full strength on top. */
export function EnvWash({ vb, tone }: { vb: Rect; tone: 'dusk' | 'night' }) {
  return (
    <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} className={`bp-wash bp-wash-${tone}`} pointerEvents="none" aria-hidden="true" />
  );
}

/** Light diagonal hatch over exterior zones only. */
export function WeatherHatch({ uid, weather, zones }: { uid: string; weather: EnvironmentDefinition['weather']; zones: Polygon[] }) {
  if (weather !== 'rain' && weather !== 'snow' && weather !== 'fog') return null;
  const id = envIds(uid);
  return (
    <g className={`bp-weather bp-weather-${weather}`} pointerEvents="none" aria-hidden="true">
      {zones.map((z, i) => (
        <path key={i} d={polyPath(z)} fill={`url(#${id[weather]})`} stroke="none" />
      ))}
    </g>
  );
}
