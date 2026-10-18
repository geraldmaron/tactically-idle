// Development builds only (spec 3.9): open this live call or debrief in the Scenario Lab, which
// plays forward from the exact game state handed over through lab-handoff.ts.
import { useState } from 'react';
import type { GameState } from '../../sim/types';
import { writeLabHandoff } from '../lab-handoff';

// Loaded in dev only: a production build drops this branch, so the control's stylesheet never ships
// with the game (scripts/check-no-lab.mjs checks for it).
if (import.meta.env.DEV) void import('./open-in-lab.css');

/** `getState` is read on click, so the lab gets the state as it is then. */
export function OpenInLab({ getState }: { getState: () => GameState }) {
  const [note, setNote] = useState<string | null>(null);
  if (!import.meta.env.DEV) return null;
  const open = () => {
    const url = writeLabHandoff(getState(), import.meta.env.BASE_URL);
    if (!url) { setNote('No live call or debrief to hand over.'); return; }
    setNote(url.includes('handoff=') ? null : 'The snapshot could not be saved, so the lab replays these choices with forced results on its reference squad.');
    window.open(url, '_blank', 'noopener');
  };
  return <p className="open-in-lab" data-open-in-lab="">
    <button type="button" className="linkbtn" onClick={open}>Open in lab</button>
    {note && <span className="open-in-lab-note">{note}</span>}
  </p>;
}
