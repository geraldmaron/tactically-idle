// The diff footer (spec 3.7): what differs from tuning.json right now (unsaved) and what tuning.json
// already changes from the source defaults (saved overrides), each field with default, saved and
// now, a revert, and a link to the field. Collapsed (the default) it is one line with the first
// few unsaved changes.
import { useState } from 'react';
import type { TuningPath } from '../../../../sim/tuning';
import { cx, Glyph } from '../../viz';
import { RawPath } from './Fields';
import { formatValue, groupOf, unitWord } from './studio';
import type { FieldState } from './studio';

export function DiffFooter({ unsaved, overrides, onRevert, onDefault, onShow }: {
  unsaved: readonly FieldState[]; overrides: readonly FieldState[]; onRevert(path: TuningPath): void; onDefault(path: TuningPath): void; onShow(state: FieldState): void;
}) {
  const [open, setOpen] = useState(false);
  const none = unsaved.length === 0 && overrides.length === 0;
  const glance = unsaved.slice(0, 3);
  return (
    <footer className={cx('lab-tdiff', open && !none && 'lab-tdiff-open')} aria-label="Changes">
      <button type="button" className="lab-tdiff-bar" aria-expanded={open} onClick={() => setOpen(value => !value)} disabled={none}>
        <Glyph name="row" size={13} />
        <span className="lab-tdiff-title">Changes</span>
        {none ? <span className="lab-muted">None. Every field matches tuning.json, and tuning.json matches the source defaults.</span> : <>
          <span className={cx('lab-tdiff-count', unsaved.length > 0 && 'lab-tdiff-count-pending')}>{unsaved.length} unsaved</span>
          <span className="lab-tdiff-count">{overrides.length} saved in tuning.json</span>
          {!open && glance.length > 0 && (
            <span className="lab-tdiff-glance">
              {glance.map(state => (
                <span key={state.meta.path} title={state.meta.path}>{state.meta.label} {formatValue(state.saved, state.meta)} → <b>{formatValue(state.now, state.meta)}</b></span>
              ))}
              {unsaved.length > glance.length && <span>and {unsaved.length - glance.length} more</span>}
            </span>
          )}
        </>}
        {!none && <span className="lab-tdiff-toggle"><Glyph name="caret" size={12} /></span>}
      </button>
      {open && !none && (
        <div className="lab-tdiff-body">
          {unsaved.length > 0 && <DiffList title="Unsaved, against tuning.json" rows={unsaved} action={{ label: 'Back to tuning.json', run: onRevert }} onShow={onShow} pending />}
          {overrides.length > 0 && <DiffList title="Saved in tuning.json, against the source defaults" rows={overrides} action={{ label: 'Stage the default', run: onDefault }} onShow={onShow} />}
        </div>
      )}
    </footer>
  );
}

function DiffList({ title, rows, action, onShow, pending = false }: {
  title: string; rows: readonly FieldState[]; action: { label: string; run(path: TuningPath): void }; onShow(state: FieldState): void; pending?: boolean;
}) {
  return (
    <section className="lab-tdiff-list" aria-label={title}>
      <h4 className="lab-tdiff-head">{title}</h4>
      <table className="lab-tdiff-table">
        <thead><tr><th scope="col" className="lab-tdiff-first">Field</th><th scope="col">group</th><th scope="col">default</th><th scope="col">saved</th><th scope="col">now</th><th scope="col"><span className="lab-tsr">Actions</span></th></tr></thead>
        <tbody>
          {rows.map(state => (
            <tr key={state.meta.path} className={cx(pending && 'lab-twrites-pending')}>
              <th scope="row">
                <button type="button" className="lab-tdiff-field" onClick={() => onShow(state)} title="Show this field">
                  <span className="lab-twrites-label">{state.meta.label}{unitWord(state.meta) && <span className="lab-tunit"> ({unitWord(state.meta)})</span>}</span><RawPath path={state.meta.path} />
                </button>
              </th>
              <td className="lab-muted">{groupOf(state.meta.group).label}</td>
              <td>{formatValue(state.def, state.meta, true)}</td>
              <td className={cx(state.overridden && 'lab-twrites-over')}>{formatValue(state.saved, state.meta, true)}</td>
              <td className="lab-twrites-now">{formatValue(state.now, state.meta, true)}</td>
              <td>
                <button type="button" className="lab-icon-button" onClick={() => action.run(state.meta.path)} title={action.label} aria-label={`${action.label}: ${state.meta.label}`}>
                  <Glyph name="undo" size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
