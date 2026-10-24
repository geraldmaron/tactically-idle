import type { Id } from '../../../sim/types';
import { useGame } from '../../store';
import { useNow } from '../../components/incident';
import { boardEntries } from '../helpers';
import { OpsBoard } from '../OpsBoard';
import { Archive } from './Archive';
import { Investigations } from './Investigations';
import { ReadyWarrants } from './ReadyWarrants';
import { readyLeads } from './model';
import { opsView, useOpsView, type OpsSection } from './view';
import './ops-world.css';

const SECTIONS: { id: OpsSection; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'investigations', label: 'Investigations' },
  { id: 'archive', label: 'Archive' },
];

/** The Operations tab (docs/world-redesign.md, C1): Now, Investigations and Archive under one segmented
 * control. Now is the call board with warrants that are ready to plan; Investigations is the crew ladder, the
 * dossier and warrant prep; Archive is the casebook and the investigations already closed. */
export function OpsHome({ onOpen }: { onOpen: (id: Id) => void }) {
  const g = useGame();
  const now = useNow(1000);
  const view = useOpsView();
  // A dossier or warrant prep is a page of its own: the segments return with Back.
  const deep = view.section === 'investigations' && (!!view.subjectId || !!view.prepLeadId);
  const waiting = boardEntries(g, now).some((e) => e.incident.expiresAt > now) || readyLeads(g).length > 0;
  return <div className="ow-home">
    <h1 className="sr-only">Operations</h1>
    {!deep && <div className="ow-seg" role="tablist" aria-label="Operations">
      {SECTIONS.map((s) => <button key={s.id} type="button" role="tab" id={`ow-tab-${s.id}`} aria-selected={view.section === s.id} aria-controls="ow-panel"
        className="ow-seg-tab" onClick={() => opsView.section(s.id)}>
        {s.label}
        {s.id === 'now' && waiting && view.section !== 'now' && <i className="ow-seg-dot" aria-hidden="true" />}
        {s.id === 'now' && waiting && view.section !== 'now' && <span className="sr-only">, something is waiting</span>}
      </button>)}
    </div>}
    <div id="ow-panel" role={deep ? undefined : 'tabpanel'} aria-labelledby={deep ? undefined : `ow-tab-${view.section}`}>
      {view.section === 'now' && <OpsBoard onOpen={onOpen} above={<ReadyWarrants />} />}
      {view.section === 'investigations' && <Investigations />}
      {view.section === 'archive' && <Archive />}
    </div>
  </div>;
}
