// Accessible text alternative to the spatial blueprint.
import type { BuiltLocation, Id, KnowledgeStatus, PersonMark, SpaceView } from '../../sim/types';
import './blueprint.css';
import { armamentText } from './layout';

export interface RoomListProps {
  spaces: SpaceView[];
  built: BuiltLocation;
  selectedSpaceId: Id | null;
  onSelectSpace?: (id: Id) => void;
  className?: string;
}

const STATUS: Record<KnowledgeStatus | 'none', { word: string; glyph: string }> = {
  unknown: { word: 'Unknown', glyph: '?' },
  reported: { word: 'Reported', glyph: '!' },
  confirmed: { word: 'Confirmed', glyph: '✓' },
  disproved: { word: 'Disproved', glyph: '×' },
  none: { word: 'No report', glyph: '–' },
};

export function statusWord(s: SpaceView['status']): string {
  return STATUS[s].word;
}

/** The same public facts are available on touch, keyboard and the text map. */
export function personDescription(person: PersonMark): string {
  if (person.status === 'unknown') return '';
  if (person.status === 'disproved') return `${person.label || 'Person report'}: report ruled out`;
  const parts = [person.label || 'Person', person.status === 'reported' ? 'reported, approximate position' : 'position confirmed'];
  if (person.condition) parts.push(person.condition);
  if (person.armament && person.armament !== 'unknown') parts.push(`${armamentText(person.armament, 'confirmed')?.toLowerCase()} (${person.status})`);
  else parts.push('armament not known');
  for (const item of person.carried ?? []) parts.push(`${item.label} (${item.status})`);
  return parts.join(' · ');
}

export function RoomList({ spaces, built, selectedSpaceId, onSelectSpace, className }: RoomListProps) {
  const loc = built.location;
  const order = [...loc.rooms.map((r) => r.id), ...loc.zones.map((z) => z.id)];
  const zoneIds = new Set(loc.zones.map((z) => z.id));
  const byId = new Map(spaces.map((s) => [s.id, s]));
  const rows = order.map((id) => byId.get(id)).filter((s): s is SpaceView => Boolean(s));
  const extra = spaces.filter((s) => !order.includes(s.id));
  return (
    <ul className={`bp-roomlist ${className ?? ''}`} aria-label={`Spaces at ${loc.name}`}>
      {[...rows, ...extra].map((s) => {
        const d = built.derived.spaces[s.id];
        const st = STATUS[s.status];
        const selected = s.id === selectedSpaceId;
        const exterior = zoneIds.has(s.id);
        return (
          <li key={s.id} className="bp-roomlist-item">
            <button type="button" className="bp-roomlist-btn" aria-pressed={selected} onClick={() => onSelectSpace?.(s.id)} data-status={s.status}>
              <span className="bp-roomlist-name">
                {s.label}
                {exterior && <span className="bp-roomlist-tag">Outside</span>}
              </span>
              <span className={`bp-roomlist-status bp-status-${s.status}`}>
                <span aria-hidden="true" className="bp-roomlist-glyph">
                  {st.glyph}
                </span>
                {st.word}
              </span>
              <span className="bp-roomlist-meta">
                {d ? `${Math.round(d.area)} sq ft · capacity ${d.capacity}` : 'Size unknown'}
                {' · '}
                {s.squadsHere.length ? `Squad${s.squadsHere.length > 1 ? 's' : ''} ${s.squadsHere.join(', ')}` : 'No squads'}
                {s.marker ? ` · Note: ${s.marker.text}${s.marker.subtext ? ` (${s.marker.subtext})` : ''}` : ''}
              </span>
              {s.people.filter((person) => person.status !== 'unknown').map((person) => <span className="bp-roomlist-person" key={person.id}>{personDescription(person)}</span>)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
