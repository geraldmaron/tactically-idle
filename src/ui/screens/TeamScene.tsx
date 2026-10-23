import type { ReactNode } from 'react';
import { PlateArt, plateUrl } from '../art/Plates';
import { ChoiceRail } from '../components/ChoiceRail';
import { useNav, type SquadSection, type TeamSection } from '../components/nav';
import './team-scene.css';

/** One scene per Team section (station rebuild, a place): the SWAT locker room, the patrol garage, the
 * command room. The section switch is the scene's title line (the current section large, the others
 * beside it), so no rail of tabs sits above the first face. A section with sub-views carries one compact
 * segmented row at the scene's foot; Hire and Training stay one tap away. */
const PLATE: Record<TeamSection, string> = { swat: 'scene_swat_locker', patrol: 'scene_patrol_garage', command: 'scene_command_room' };

/** `count` is a visual badge (aria-hidden): the segment keeps its plain name, and the same fact is in the view's own heading. */
export interface SubView { value: SquadSection; label: string; count?: string }

export function TeamScene({ section, line, action, subViews, children, className, label }: { section: TeamSection; line?: ReactNode; /** A quiet text button at the end of the count line (Squads: Arrange). */ action?: ReactNode; subViews?: SubView[]; children?: ReactNode; className?: string; label?: string }) {
  const nav = useNav();
  return <header className={`team-scene team-scene-${section}${className ? ` ${className}` : ''}`} data-team-scene={section} aria-label={label}>
    <PlateArt src={plateUrl(PLATE[section])} />
    <ChoiceRail size="sm" kind="navigation" label="Team sections" value={nav.teamSection} onChange={nav.setTeamSection} options={[
      { value: 'swat', label: 'SWAT' }, { value: 'patrol', label: 'Patrol' }, { value: 'command', label: 'Command' },
    ]} />
    {(line || action) && <div className="team-scene-meta">{line && <p className="team-scene-line">{line}</p>}{action}</div>}
    {children}
    {subViews && <ChoiceRail size="sm" kind="navigation" label="SWAT sections" value={nav.squadSection} onChange={nav.setSquadSection}
      options={subViews.map((view) => ({ value: view.value, label: <>{view.label}{view.count && <span className="team-scene-count" aria-hidden="true">{view.count}</span>}</> }))} />}
  </header>;
}
