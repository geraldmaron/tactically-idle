// Gate checks as bullet rows (spec 3.1 card rows, 3.4 gate panel): the band CI allows shaded, the
// saved value as a hollow tick, an unsaved patch's value as a solid amber mark, pass or fail with a
// glyph and in words (no verdict while a pending patch's side hasn't run; the saved side is then
// named as such), and while the gate runs, how far its job has got. Verdicts only ever come from
// the CI population (spec 5 rule 7).
import type { GateCheck } from '../../../../gen/incident/trees-v13/balance';
import { gateJobKey } from '../../../../gen/incident/trees-v13/balance';
import type { GateProgress, GateVerdict } from '../../model/gate-view';
import { Bullet, cx, Glyph } from '../../viz';
import { checkLabel, jobOf } from './calls-model';

export function GateRows({ verdicts, progress, compact = false, onOpen, deltas = false }: {
  verdicts: readonly GateVerdict[]; progress: GateProgress | null; compact?: boolean; onOpen?: (check: GateCheck) => void; deltas?: boolean;
}) {
  return (
    <ul className={cx('lab-gate-rows', compact && 'lab-gate-rows-compact')}>
      {verdicts.map(v => {
        const job = progress?.jobs.filter(entry => gateJobKey(entry.job) === gateJobKey(jobOf(v.check)));
        const running = job?.find(entry => entry.done < entry.total);
        const label = checkLabel(v.check);
        const row = (
          <>
            <span className="lab-gate-label">{label}</span>
            <Bullet label={label} min={v.check.min} max={v.check.max} saved={v.saved} patch={v.patch} pass={running ? null : v.pass} />
            {running && <span className="lab-gate-progress" role="status">≈ {running.done} of {running.total} calls</span>}
          </>
        );
        return (
          <li key={v.check.id} className={cx('lab-gate-row', v.pass === false && 'lab-gate-row-fail', v.pass === null && !running && 'lab-gate-row-empty')} data-check={v.check.id}
            data-pass={v.pass === null ? '' : String(v.pass)}>
            {onOpen ? <button type="button" className="lab-gate-open" onClick={() => onOpen(v.check)} title={v.text}>{row}</button> : <div className="lab-gate-open" title={v.text}>{row}</div>}
            {!compact && v.pass !== null && <p className="lab-gate-text"><Glyph name={v.pass ? 'clean' : 'close'} size={12} />{v.text}</p>}
            {!compact && v.pass === null && v.saved !== null && !running && <p className="lab-gate-text lab-muted">{v.text}</p>}
            {!compact && deltas && v.deltaText && <p className={cx('lab-gate-delta', v.delta?.withinNoise && 'lab-gate-noise')}>{v.deltaText}</p>}
          </li>
        );
      })}
    </ul>
  );
}
