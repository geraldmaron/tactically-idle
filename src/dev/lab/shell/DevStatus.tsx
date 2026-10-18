// The dev status dot (spec 3.0): green "dev" when /__lab/ping answered, grey "Static build" when
// this is a static lab build (no request is ever made), amber when the dev server doesn't answer.
// Its popover says what is off and why.
import { useRef, useState } from 'react';
import { useLab } from '../context';
import { recheckDevServer } from '../model/endpoints';
import { cx, Glyph, Popover } from '../viz';

export function DevStatus({ compact = false }: { compact?: boolean }) {
  const { dev } = useLab();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const state = dev.staticBuild ? 'static' : dev.available === null ? 'checking' : dev.available ? 'dev' : 'down';
  const label = { static: 'Static build', checking: 'Checking', dev: 'dev', down: 'Dev server not answering' }[state];
  const off: string[] = [];
  if (state !== 'dev') off.push('Saving tuning, shared notes and string checks need the dev server (npm run lab).');
  else if (dev.python === false) off.push('String checks need python3 on the PATH.');
  return (
    <>
      <button ref={anchor} type="button" className={cx('lab-dev', `lab-dev-${state}`)} aria-haspopup="dialog" aria-expanded={open}
        aria-label={`Dev server: ${label}`} title={off.join(' ') || 'Dev endpoints answer'} onClick={() => setOpen(value => !value)}>
        <Glyph name="dot" size={10} />
        {!compact && <span>{label}</span>}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label="Dev server status" align="end" width={300}>
        <div className="lab-dev-pop">
          <p className="lab-pop-title">{state === 'dev' ? 'Dev endpoints answer' : label}</p>
          {state === 'dev' && <p>Tuning saves to src/sim/tuning.json, notes to docs/calls/notes, and string checks run here.</p>}
          {off.map(line => <p key={line}>{line}</p>)}
          {state === 'static' && <p>Notes are kept in this browser only.</p>}
          {state === 'down' && <button type="button" className="lab-button" onClick={() => { void recheckDevServer(); }}><Glyph name="retry" />Check again</button>}
        </div>
      </Popover>
    </>
  );
}
