// The dev-only switch for the design candidates under comparison (candidates.ts), on the live call
// so the owner can flip a layout or a face mid-call and compare the same moment. Not in production
// builds or tests.
import { DECIDE_LAYOUTS, READING_FACES, updateCandidates, useCandidates, type DecideLayout, type ReadingFace } from './candidates';
import './candidates.css';

export const SHOW_CANDIDATE_SWITCH = import.meta.env.DEV && import.meta.env.MODE !== 'test';

const LAYOUT_LABEL: Record<DecideLayout, string> = { now: 'Now', compact: '4A', folded: '4B' };
const FACE_LABEL: Record<ReadingFace, string> = { sans: 'Sans', serif: 'Serif' };

export function CandidateSwitch() {
  const value = useCandidates();
  return <div className="candidate-switch" role="group" aria-label="Design candidates (dev)">
    <span className="candidate-switch-tag">DEV</span>
    <span className="candidate-switch-set" role="radiogroup" aria-label="Decide layout">
      {DECIDE_LAYOUTS.map((layout) => <button key={layout} type="button" role="radio" aria-checked={value.layout === layout}
        onClick={() => updateCandidates({ layout })}>{LAYOUT_LABEL[layout]}</button>)}
    </span>
    <span className="candidate-switch-set" role="radiogroup" aria-label="Reading face">
      {READING_FACES.map((face) => <button key={face} type="button" role="radio" aria-checked={value.face === face}
        onClick={() => updateCandidates({ face })}>{FACE_LABEL[face]}</button>)}
    </span>
  </div>;
}
