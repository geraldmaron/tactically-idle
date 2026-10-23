import { COURSES } from '../../../content/courses';
import type { NodeOption } from '../../../sim/department-selectors';
import { GearArt } from '../../art/GearArt';
import { EmblemArt, branchEmblemId } from '../../art/EmblemArt';
import { BRANCH_META } from '../../components/labels';

/** Gear art when a development unlocks equipment, else the emblem of the course it unlocks or of its branch. */
export function NodeGlyph({ option: o, size }: { option: NodeOption; size: number }) {
  const item = o.node.effects.find((effect): effect is Extract<typeof effect, { kind: 'unlockItem' }> => effect.kind === 'unlockItem');
  const course = o.node.effects.find((effect): effect is Extract<typeof effect, { kind: 'unlockCourse' }> => effect.kind === 'unlockCourse');
  const iconSize = Math.round(size * 0.66);
  return <span className="dev-glyph" aria-hidden="true">{item ? <GearArt itemId={item.itemId} size={size} />
    : course && COURSES[course.courseId] ? <EmblemArt id={course.courseId} icon="mortarboard" size={size} iconSize={iconSize} />
    : <EmblemArt id={branchEmblemId(o.node.branch)} icon={BRANCH_META[o.node.branch].icon} size={size} iconSize={iconSize} />}</span>;
}
