// The shortcut sheet (`?`): the global keys, then each surface's own keys as the streams add them
// to the registry.
import { SURFACE_REGISTRY } from '../surfaces';
import { Glyph, Kbd, Modal } from '../viz';
import { GLOBAL_KEYS, isMac, paletteKey } from './keys';

/** "G then C P F", "R or Enter", "1 to 9": key groups with the joining word between them. ⌘ reads
 * Ctrl+ off a Mac. */
function Keys({ keys }: { keys: string }) {
  const text = keys === '⌘K' ? paletteKey() : isMac() ? keys : keys.replace(/⌘/g, 'Ctrl+');
  const parts = text.split(/ (then|or|to) /);
  return <>{parts.map((part, i) => (i % 2 ? <span key={i}> {part} </span> : <Kbd key={i}>{part}</Kbd>))}</>;
}

export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const surfaces = Object.values(SURFACE_REGISTRY).filter(entry => entry.keys?.length);
  return (
    <Modal open={open} onClose={onClose} label="Keyboard shortcuts" className="lab-shortcuts">
      <header className="lab-modal-bar">
        <h2 className="lab-modal-title">Keyboard shortcuts</h2>
        <button type="button" className="lab-icon-button" onClick={onClose} aria-label="Close"><Glyph name="close" /></button>
      </header>
      <section>
        <h3 className="lab-modal-head">Everywhere</h3>
        <dl className="lab-keys">
          {GLOBAL_KEYS.map(row => (
            <div key={row.keys} className="lab-keys-row"><dt><Keys keys={row.keys} /></dt><dd>{row.does}</dd></div>
          ))}
        </dl>
      </section>
      {surfaces.map(entry => (
        <section key={entry.tab}>
          <h3 className="lab-modal-head">{entry.label}</h3>
          <dl className="lab-keys">
            {entry.keys!.map(row => <div key={row.keys} className="lab-keys-row"><dt><Keys keys={row.keys} /></dt><dd>{row.does}</dd></div>)}
          </dl>
        </section>
      ))}
      <p className="lab-muted">Surface keys are ignored while you type in a field.</p>
    </Modal>
  );
}
