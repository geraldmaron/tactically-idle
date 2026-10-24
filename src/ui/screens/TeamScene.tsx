import type { ReactNode } from 'react';
import { PlateArt, plateUrl } from '../art/Plates';
import { ChoiceRail } from '../components/ChoiceRail';
import { Face } from '../components/Face';
import { useNav, type SquadSection, type TeamSection } from '../components/nav';
import { managerViews } from '../../sim/command-staff';
import { employedPatrol } from '../../sim/patrol';
import { useGame } from '../store';
import { Icon } from '../icons';
import { useTeamActions } from './team/team-actions';
import { decisionBanners } from './team/team-view';
import { officerList } from './helpers';
import './team-scene.css';

/** The Team header (canvas E1): the section's painting behind the title, the Bonds link, the division switch with
 * its counts, a rose banner for each officer whose aftercare waits, one line of counts, and for SWAT a quiet row
 * of sub-views at its foot. Hire and Training stay one tap away. */
const PLATE: Record<TeamSection, string> = { swat: 'scene_swat_locker', patrol: 'scene_patrol_garage', command: 'scene_command_room' };

/** `count` is a visual badge (aria-hidden): the segment keeps its plain name, and the same fact is in the view's own heading. */
export interface SubView { value: SquadSection; label: string; count?: string }

export function TeamScene({ section, line, action, subViews, children, className, label }: { section: TeamSection; line?: ReactNode; /** A quiet text button at the end of the count line (Squads: Arrange). */ action?: ReactNode; subViews?: SubView[]; children?: ReactNode; className?: string; label?: string }) {
  const nav = useNav();
  const g = useGame();
  const { openBonds, openAftercare } = useTeamActions();
  const counts: Record<TeamSection, number> = {
    swat: officerList(g).length,
    patrol: employedPatrol(g).length,
    command: managerViews(g).filter((view) => view.hired).length,
  };
  const banners = decisionBanners(g);
  const shown = banners.slice(0, 2);
  const divisions: { value: TeamSection; label: string }[] = [{ value: 'swat', label: 'SWAT' }, { value: 'patrol', label: 'Patrol' }, { value: 'command', label: 'Command' }];
  return <header className={`team-scene team-scene-${section}${className ? ` ${className}` : ''}`} data-team-scene={section} aria-label={label}>
    <PlateArt src={plateUrl(PLATE[section])} />
    <div className="team-head-row">
      <h2 className="team-title">Team</h2>
      <button type="button" className="team-bonds-link" onClick={openBonds}><Icon name="nodes" size={18} />Bonds</button>
    </div>
    <ChoiceRail kind="navigation" grow label="Team divisions" value={nav.teamSection} onChange={nav.setTeamSection}
      options={divisions.map((d) => ({ value: d.value, accessibleLabel: `${d.label}, ${counts[d.value]}`, label: <>{d.label}<span className="team-division-count" aria-hidden="true">{counts[d.value]}</span></> }))} />
    {shown.length > 0 && <div className="team-banners">
      {shown.map((b) => <button key={b.imprintId} type="button" className="team-banner" onClick={() => openAftercare(b.imprintId)}>
        <Face size="sm" kind="officer" officer={g.officers[b.officerId]} />
        <span className="team-banner-text"><b>{b.surname}</b> · {b.line}</span>
        <span className="team-banner-go">Decide</span>
      </button>)}
      {banners.length > shown.length && <p className="team-scene-line">{banners.length - shown.length} more need a decision</p>}
    </div>}
    {(line || action) && <div className="team-scene-meta">{line && <p className="team-scene-line">{line}</p>}{action}</div>}
    {children}
    {subViews && <ChoiceRail kind="navigation" grow label="SWAT sections" value={nav.squadSection} onChange={nav.setSquadSection}
      options={subViews.map((view) => ({ value: view.value, label: <>{view.label}{view.count && <span className="team-scene-count" aria-hidden="true">{view.count}</span>}</> }))} />}
  </header>;
}
