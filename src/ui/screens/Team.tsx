import { CommandStaff } from '../components/CommandStaff';
import { ChoiceRail } from '../components/ChoiceRail';
import { useNav } from '../components/nav';
import { PatrolScreen } from './Patrol';
import { SquadScreen } from './Squad';
import './team.css';

/** One personnel destination with separate tactical, patrol and command responsibilities. */
export function TeamScreen() {
  const nav = useNav();
  return <div className="team-page">
    <header className="team-head">
      <ChoiceRail size="sm" value={nav.teamSection} kind="navigation" label="Team sections" grow onChange={nav.setTeamSection} options={[
        { value: 'swat', label: 'SWAT' }, { value: 'patrol', label: 'Patrol' }, { value: 'command', label: 'Command' },
      ]} />
    </header>
    {nav.teamSection === 'patrol' ? <PatrolScreen /> : nav.teamSection === 'command' ? <CommandScreen /> : <SquadScreen />}
  </div>;
}

function CommandScreen() {
  return <div className="page team-command"><CommandStaff allPosts composition="room" /></div>;
}
