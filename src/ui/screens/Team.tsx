import { useEffect, useRef } from 'react';
import { CommandStaff } from '../components/CommandStaff';
import { useBeat } from '../components/Beat';
import { useNav } from '../components/nav';
import { managerViews } from '../../sim/command-staff';
import { useGame } from '../store';
import { PatrolScreen } from './Patrol';
import { SquadScreen } from './Squad';
import { TeamScene } from './TeamScene';
import { newPromotions, promotionLedger } from './team-model';
import { promotedBeat } from './team-beats';
import './team.css';

/** One personnel destination with separate tactical, patrol and command responsibilities. Each section opens
 * on its own scene (TeamScene); the section switch is the scene's title line. */
export function TeamScreen() {
  const nav = useNav();
  usePromotionBeat();
  return <div className="team-page">
    {nav.teamSection === 'patrol' ? <PatrolScreen /> : nav.teamSection === 'command' ? <CommandScreen /> : <SquadScreen />}
  </div>;
}

/** A promotion that lands while the player is on Team (a course finishing, a clock hour settling) plays the
 * PROMOTED beat: the rank and the cause the game recorded. Promotions from before the screen opened are not
 * replayed, and a new hire is never reported as promoted. Debriefs and Welcome back announce the rest. */
function usePromotionBeat() {
  const g = useGame();
  const beat = useBeat();
  const seen = useRef<ReturnType<typeof promotionLedger> | null>(null);
  useEffect(() => {
    const now = promotionLedger(g.officers);
    if (seen.current) {
      const [fresh] = newPromotions(seen.current, now);
      const officer = fresh && g.officers[fresh.officerId];
      if (fresh && officer) beat.play(promotedBeat(officer, fresh.rank, fresh.cause));
    }
    seen.current = now;
  }, [g.officers, beat]);
}

function CommandScreen() {
  const g = useGame();
  const views = managerViews(g);
  const hired = views.filter((view) => view.hired).length;
  const line = `${hired} of ${views.length} posts filled`;
  return <div className="page team-command"><CommandStaff allPosts composition="room" scene={(posts) => <TeamScene section="command" line={line} className="command-room" label="Command room">{posts}</TeamScene>} /></div>;
}
