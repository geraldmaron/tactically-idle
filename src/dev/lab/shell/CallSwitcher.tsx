// The call switcher in the top bar: the four call trees as compact cards, plus "All calls" for the
// Calls landing. Picking a call opens its default draw and keeps the surface (spec 3.0).
import { useRef, useState } from 'react';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import type { IncidentType } from '../../../sim/scenario-types';
import { useLab } from '../context';
import { defaultCall } from '../url';
import { cx, Glyph, Popover } from '../viz';

export const CALL_TEMPLATES = Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[];

/** What a tree holds, read straight from it: decision points, choices and endings. */
export function treeCounts(template: IncidentTemplate) {
  const tree = template.tree;
  return { nodes: tree.nodes.length, choices: tree.nodes.reduce((sum, node) => sum + node.choices.length, 0), endings: Object.keys(tree.endings).length };
}

export const callTitle = (type: IncidentType | undefined): string | null => (type && INCIDENT_TEMPLATES[type]?.tree.title) ?? null;

/** One call tree as a card: title, call type and its shape in counts. */
export function CallCard({ template, current, onOpen, compact = false }: { template: IncidentTemplate; current?: boolean; onOpen: () => void; compact?: boolean }) {
  const counts = treeCounts(template);
  return (
    <button type="button" className={cx('lab-callcard', compact && 'lab-callcard-compact', current && 'lab-callcard-current')} onClick={onOpen} aria-current={current || undefined}>
      <span className="lab-callcard-title">{template.tree.title}</span>
      <span className="lab-callcard-type">{template.label}</span>
      <span className="lab-callcard-counts">
        <span><b>{counts.nodes}</b> decision points</span>
        <span><b>{counts.choices}</b> choices</span>
        <span><b>{counts.endings}</b> endings</span>
      </span>
    </button>
  );
}

export function CallSwitcher() {
  const { url, navigate } = useLab();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const type = url.call?.type;
  const title = callTitle(type);
  const pick = (next: IncidentType) => {
    setOpen(false);
    navigate({ call: defaultCall(next), path: '', node: null, sel: null, handoff: null, hist: '', tab: url.tab === 'calls' ? 'play' : url.tab });
  };
  return (
    <>
      <button ref={anchor} type="button" className="lab-switcher" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span className="lab-switcher-title">{title ?? (url.call ? 'Call from ID' : 'Pick a call')}</span>
        <Glyph name="caret" size={12} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label="Switch call" width={420}>
        <div className="lab-switcher-list">
          {CALL_TEMPLATES.map(template => <CallCard key={template.type} template={template} compact current={template.type === type} onOpen={() => pick(template.type)} />)}
        </div>
        <button type="button" className="lab-button lab-button-quiet lab-switcher-all" onClick={() => { setOpen(false); navigate({ tab: 'calls' }); }}>
          <Glyph name="grid" />All calls
        </button>
      </Popover>
    </>
  );
}
