import { useNav } from '../components/nav';
import { Icon, type IconName } from '../icons';
import { DevelopScreen, nextDevelopment } from './Develop';
import { employedPatrol, patrolCapacity } from '../../sim/patrol';
import { nodeOptions } from '../../sim/department-selectors';
import type { DevBranch, Id } from '../../sim/types';
import { useGame } from '../store';
import { Disclosure } from '../components/Disclosure';
import { GearArt } from '../art/GearArt';
import { PlateArt, plateUrl } from '../art/Plates';
import { money } from '../format';
import './build.css';

const FACILITIES: { branch: DevBranch; name: string; icon: IconName; item?: Id }[] = [
  { branch: 'personnel', name: 'Personnel office', icon: 'desk' },
  { branch: 'field', name: 'Training floor', icon: 'shooting' },
  { branch: 'intel', name: 'Information room', icon: 'binoculars', item: 'thermal_imager' },
  { branch: 'wellbeing', name: 'Recovery room', icon: 'bed' },
  { branch: 'logistics', name: 'Equipment bay', icon: 'van', item: 'support_van' },
];

/** Department facilities and development. Equipment purchases live in the Store. */
export function BuildScreen() {
  const nav = useNav();
  const game = useGame();
  const options = nodeOptions(game);
  const capacity = patrolCapacity(game);
  const next = game.department.level < 3 ? { level: 3, positions: 8 } : game.department.level < 6 ? { level: 6, positions: 12 } : null;
  return <div className="page facility-build-page">
    <h1 className="section-title build-title"><Icon name="build" size={24} />Build</h1>
    <section className="facility-plan" aria-label="Department facility plan">
      <div className="facility-plan-scene plate" aria-hidden="true"><PlateArt src={plateUrl('scene_facilities_plan')} /></div>
      <p className="facility-plan-label">Department plan</p>
      <div className="facility-building">
        {FACILITIES.map((facility) => {
          const branch = options.filter((option) => option.node.branch === facility.branch);
          const option = nextDevelopment(branch) ?? branch.find((row) => row.targetTier) ?? branch[0];
          if (!option) return null;
          const complete = branch.filter((row) => !row.targetTier).length;
          const cost = option.quote.cost?.funding;
          return <button key={facility.branch} type="button" data-facility-branch={facility.branch}
            className={`facility-room facility-room-${facility.branch}${option.quote.ok ? ' facility-room-ready' : ''}`}
            onClick={() => nav.openDevelopment(option.node.id)}
            aria-label={`${facility.name}. ${complete} of ${branch.length} improvements complete. ${option.node.name}${cost ? `, ${money(cost)}` : ''}. ${option.quote.ok ? 'Available to improve' : option.reason ?? 'Complete'}`}>
            <span className="facility-object" aria-hidden="true">
              <span className={`facility-furnishing facility-furnishing-${facility.branch}`}><i /><i />{facility.item ? <GearArt itemId={facility.item} size={88} /> : <Icon name={facility.icon} size={24} />}</span>
            </span>
            <span className="facility-room-name">{facility.name}<Icon name="chevronRight" size={16} /></span>
            <span className="facility-room-progress">{complete} of {branch.length} complete</span>
            <span className="facility-next"><span>{option.node.name}</span>{cost ? <strong>{money(cost)}</strong> : <strong>Complete</strong>}</span>
            {option.targetTier && !option.quote.ok && <span className="facility-blocker"><Icon name={option.status === 'locked' ? 'lock' : 'cash'} size={16} />{option.status === 'locked' ? 'Prerequisite needed' : 'Needs funding'}</span>}
          </button>;
        })}
      </div>
    </section>
    <section className="build-capacity" aria-label="Patrol positions">
      <Icon name="people" size={24} />
      <div><strong>{employedPatrol(game).length} / {capacity} patrol positions filled</strong><span>Department level {game.department.level}</span><p>{next ? `${next.positions} positions at department level ${next.level}` : 'All 12 patrol positions authorized'}</p></div>
    </section>
    <Disclosure name="all-department-upgrades" summary="All upgrades" icon="build">
      <DevelopScreen highlightedNode={nav.developmentNode} highlightRequest={nav.developmentRequest} openHighlighted />
    </Disclosure>
  </div>;
}
