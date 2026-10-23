import { recoveryInfo } from '../../sim/department-selectors';
import { isInjured } from '../../sim/economy';
import { stressBand, type StressBand } from '../../sim/officer';
import { STRESS_LABEL, whole } from './StressDisplay';
import type { GameState, Id } from '../../sim/types';
import type { IconName } from '../icons';

/** What a face's corner badge says: why the officer is not simply ready. */
export type FaceMark = 'deployed' | 'injured' | 'training' | 'resting' | 'strained';

/** One officer's condition as a face shows it: the stress ring, the corner badge, and when the badge
 * clears (null when it clears with the call, or there is nothing to clear). */
export interface FaceStatus {
  stress: number;
  band: StressBand;
  surname: string;
  mark: FaceMark | null;
  until: number | null;
  /** The badge in words, for the accessible name and the clocks. */
  label: string;
}

export const FACE_MARK_ICON: Record<FaceMark, IconName> = {
  deployed: 'deployed', injured: 'injured', training: 'training', resting: 'resting', strained: 'strained',
};

export function officerFaceStatus(g: GameState, officerId: Id, at: number): FaceStatus | null {
  const o = g.officers[officerId];
  if (!o) return null;
  const info = recoveryInfo(g, officerId, at);
  const t = Math.max(at, g.department.clockHighWater);
  // Ring fill and color read the same saved stress, so they never disagree; the words carry the band
  // (strained and overloaded differ: overloaded officers cannot take high-risk actions) and the number.
  const stress = o.stress;
  const band = stressBand(stress);
  const reading = `${STRESS_LABEL[band].toLowerCase()}, stress ${whole(stress)}`;
  const base = { stress, band, surname: o.surname };
  // An injury outranks every other mark, on a call or not.
  if (isInjured(o, t)) return { ...base, mark: 'injured', until: info.deployableAt, label: `${o.surname}, injured, ${reading}` };
  if (o.assignment?.kind === 'operation') return { ...base, mark: 'deployed', until: null, label: `${o.surname}, on a call, ${reading}` };
  if (o.assignment?.kind === 'training' || o.assignment?.kind === 'detail') return { ...base, mark: 'training', until: o.assignment.endsAt, label: `${o.surname}, ${o.assignment.kind === 'training' ? 'in training' : 'teaching a detail'}, ${reading}` };
  if (info.blocker !== null) return { ...base, mark: 'resting', until: info.deployableAt, label: `${o.surname}, must rest, ${reading}` };
  if (band !== 'ready') return { ...base, mark: 'strained', until: null, label: `${o.surname}, ${reading}` };
  return { ...base, mark: null, until: null, label: `${o.surname}, ready, ${reading}` };
}
