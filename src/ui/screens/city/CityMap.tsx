import { DISTRICT_IDS, type DistrictId } from '../../../sim/world/types';
import type { CityView, DistrictView } from '../../../sim/world/selectors';
import { crimeBand, crimeLabel, crimeSpoken } from './district';
import { CITY_LAYOUT, MAP_H, MAP_W, RIVER_PATH, STREETS_PATH, percentX, percentY, polygonPoints } from './layout';
import './city-map.css';

export interface MapMarks {
  /** The district holding a live call or an armed contact the player can answer now. */
  live: DistrictId | null;
  /** The squads on a proactive shift, by district. */
  squads: Partial<Record<DistrictId, string>>;
}

/** The living map (B1): districts as polygons from the layout data, tinted by crime, hatched while locked,
 * patrol as cyan dots, the live pin in red and a squad's letter badge. The names on it are pointer shortcuts to
 * the same districts the list under it opens, so they stay out of the tab order. */
export function CityMap({ view, marks, onOpen, dim = false }: { view: CityView; marks: MapMarks; onOpen: (id: DistrictId) => void; dim?: boolean }) {
  const byId = Object.fromEntries(view.districts.map((district) => [district.id, district])) as Record<DistrictId, DistrictView>;
  const summary = view.districts.map((d) => d.open ? `${d.name} ${crimeSpoken(d)}${marks.live === d.id ? ' with a live call' : ''}` : `${d.name} ${d.canOpen ? 'ready to open' : `locked until department level ${d.openAtLevel}`}`).join(', ');
  return (
    <div className={`city-map${dim ? ' city-map-dim' : ''}`}>
      <svg className="city-map-svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={`City map. ${summary}`}>
        <defs>
          <pattern id="city-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path className="city-hatch-line" d="M0 0 L0 8" /></pattern>
        </defs>
        <rect className="city-ground" width={MAP_W} height={MAP_H} />
        {DISTRICT_IDS.map((id) => {
          const d = byId[id];
          const state = d.open ? 'open' : d.canOpen ? 'ready' : 'locked';
          return <polygon key={id} className="city-district" data-band={d.open ? crimeBand(d.crime) : undefined} data-state={state} data-district={id}
            points={polygonPoints(CITY_LAYOUT[id].points)} onClick={() => onOpen(id)} />;
        })}
        <path className="city-river" d={RIVER_PATH} />
        <path className="city-streets" d={STREETS_PATH} />
        {DISTRICT_IDS.map((id) => {
          const d = byId[id];
          if (!d.open) return null;
          return CITY_LAYOUT[id].dots.slice(0, Math.min(d.units, CITY_LAYOUT[id].dots.length)).map(([x, y], i) => <circle key={`${id}-${i}`} className="city-dot" cx={x} cy={y} r={4} />);
        })}
        {DISTRICT_IDS.map((id) => {
          const letter = marks.squads[id];
          if (!letter || !byId[id].open) return null;
          const [x, y] = CITY_LAYOUT[id].badge;
          return <g key={`badge-${id}`} className="city-squad">
            <rect x={x - 11} y={y - 11} width={22} height={22} rx={4} />
            <text x={x} y={y + 5} textAnchor="middle">{letter}</text>
          </g>;
        })}
        {marks.live && byId[marks.live].open && (() => {
          const [x, y] = CITY_LAYOUT[marks.live].pin;
          return <g className="city-pin"><circle className="city-pin-ring" cx={x} cy={y} r={16} /><circle className="city-pin-dot" cx={x} cy={y} r={7} /></g>;
        })()}
      </svg>
      {DISTRICT_IDS.map((id) => {
        const d = byId[id];
        const [x, y] = CITY_LAYOUT[id].label;
        const at = { left: percentX(x), top: percentY(y) };
        if (!d.open) {
          return d.canOpen
            ? <button key={id} type="button" className="city-label city-label-locked" style={at} tabIndex={-1} aria-hidden="true" onClick={() => onOpen(id)}><span className="city-label-name">{d.name}</span><span className="city-label-meta">READY TO OPEN</span></button>
            : <span key={id} className="city-label city-label-locked" style={at} aria-hidden="true"><span className="city-label-meta">{d.name.toUpperCase()}<br />DEPT LEVEL {d.openAtLevel}</span></span>;
        }
        return <button key={id} type="button" className="city-label" data-band={crimeBand(d.crime)} style={at} tabIndex={-1} aria-hidden="true" onClick={() => onOpen(id)}>
          <span className="city-label-name">{d.name}</span>
          <span className="city-label-meta">{crimeLabel(d)}</span>
        </button>;
      })}
    </div>
  );
}
