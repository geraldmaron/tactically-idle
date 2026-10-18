// The unsaved-tuning banner (spec 3.0), drawn in the game's own "reported, not confirmed" style: a
// dashed amber outline. While it shows, every odds figure and run in the lab uses the patch.
import { useMemo } from 'react';
import { tuningLayers } from '../../../sim/tuning';
import { useLab } from '../context';
import { unsavedFieldCount } from '../surfaces/tuning/studio';
import { Glyph } from '../viz';


export function PendingBanner() {
  const { tuning, navigate } = useLab();
  const n = useMemo(() => unsavedFieldCount(tuning.patch, tuningLayers()), [tuning.patch, tuning.savedHash]);
  if (!n) return null;
  return (
    <div className="lab-pending" role="status">
      <Glyph name="field" />
      <p className="lab-pending-text">
        Unsaved tuning: {n} {n === 1 ? 'field differs' : 'fields differ'} from tuning.json. Odds and runs use {n === 1 ? 'it' : 'them'}.
        {tuning.problems.length > 0 && <> Not applied: {tuning.problems.map(problem => `${problem.path} (${problem.reason})`).join(', ')}.</>}
      </p>
      <button type="button" className="lab-button lab-button-quiet" onClick={() => navigate({ tab: 'tuning' })}>Review</button>
      <button type="button" className="lab-button lab-button-quiet" onClick={() => tuning.setPatch({})}>Discard</button>
    </div>
  );
}
