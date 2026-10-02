// Floor tabs ("GROUND" / "UPPER") for the map, with a marker badge (amber dot + count) on a floor that holds
// unresolved markers or people the player knows about, and the north arrow they displace from the sheet corner.
import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { FLOOR_NAMES, floorWord, type FloorBadge } from './floors';

export interface FloorTabsProps {
  floors: number;
  floor: number;
  badges: FloorBadge[];
  onChange: (f: number) => void;
}

function Compass() {
  return (
    <svg className="bp-compass" viewBox="-12 -13 24 26" width="24" height="26" aria-hidden="true" focusable="false">
      <circle r="8.4" className="bp-compass-ring" />
      <path d="M0 -7.4L4.4 5.4L0 2.4L-4.4 5.4Z" className="bp-compass-needle" />
      <text y="-9.6" textAnchor="middle" className="bp-compass-n">
        N
      </text>
    </svg>
  );
}

export function FloorTabs({ floors, floor, badges, onChange }: FloorTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % floors;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + floors) % floors;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = floors - 1;
    else return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="bp-tabwrap">
      <Compass />
      <div className="bp-tabs" role="tablist" aria-label="Floors">
        {Array.from({ length: floors }, (_, i) => {
          const b = badges[i] ?? { markers: 0, people: 0, count: 0 };
          const sel = i === floor;
          const parts: string[] = [];
          if (b.markers) parts.push(`${b.markers} unresolved marker${b.markers > 1 ? 's' : ''}`);
          if (b.people) parts.push(`${b.people} known ${b.people > 1 ? 'people' : 'person'}`);
          return (
            <button
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`bp-tab-${i}`}
              aria-selected={sel}
              tabIndex={sel ? 0 : -1}
              aria-label={parts.length ? `${floorWord(i)}, ${parts.join(', ')}` : floorWord(i)}
              className={`bp-tab${sel ? ' bp-tab-on' : ''}`}
              onClick={() => onChange(i)}
              onKeyDown={(e) => move(e, i)}
            >
              <span className="bp-tab-name">{FLOOR_NAMES[i]}</span>
              {b.count > 0 && (
                <span className="bp-tab-badge" aria-hidden="true">
                  <i className="bp-tab-dot" />
                  {b.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
