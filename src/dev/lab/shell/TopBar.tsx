// The top bar (spec 3.0): the lab's name, the call switcher, the surface tabs, Go to (⌘K), the X-ray
// and names toggles, the review notes count and the dev status. Below 1100 px the tabs fold into one
// menu button and the brand keeps only its mark.
import { useRef, useState } from 'react';
import { useLab } from '../context';
import { SURFACE_REGISTRY, TAB_ORDER } from '../surfaces';
import type { Surface } from '../types';
import { cx, Glyph, Kbd, Popover } from '../viz';
import { CallSwitcher } from './CallSwitcher';
import { DevStatus } from './DevStatus';
import { paletteKey } from './keys';
import { useNarrow } from './media';

function Toggle({ label, on, onChange, glyph, compact }: { label: string; on: boolean; onChange: () => void; glyph: 'scan' | 'names'; compact: boolean }) {
  return (
    <button type="button" className={cx('lab-toggle', on && 'lab-toggle-on')} aria-pressed={on} onClick={onChange} title={`${label} ${on ? 'on' : 'off'}`}>
      <Glyph name={glyph} />
      {!compact && <span>{label}</span>}
      <i className="lab-toggle-dot" aria-hidden="true" />
    </button>
  );
}

function TabMenu({ current, onPick, hasCall }: { current: Surface; onPick: (tab: Surface) => void; hasCall: boolean }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchor} type="button" className="lab-tabmenu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {SURFACE_REGISTRY[current].label}<Glyph name="caret" size={12} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label="Surfaces" width={220}>
        <nav className="lab-tabmenu-list" aria-label="Surfaces">
          {(['calls', ...TAB_ORDER] as Surface[]).map(tab => (
            <button key={tab} type="button" className={cx('lab-tabmenu-item', !hasCall && SURFACE_REGISTRY[tab].needsCall && 'lab-dim')} aria-current={tab === current ? 'page' : undefined}
              onClick={() => { setOpen(false); onPick(tab); }}>
              <span>{SURFACE_REGISTRY[tab].label}</span><Kbd>G {SURFACE_REGISTRY[tab].key}</Kbd>
            </button>
          ))}
        </nav>
      </Popover>
    </>
  );
}

export function TopBar({ onPalette, onShortcuts }: { onPalette: () => void; onShortcuts: () => void }) {
  const { url, navigate, notes } = useLab();
  const narrow = useNarrow();
  const count = notes.file.notes.length;
  const go = (tab: Surface) => navigate({ tab });
  return (
    <header className="lab-top">
      <span className="lab-brand" title="Scenario Lab">
        <Glyph name="plan" size={18} />
        {!narrow && <span className="lab-brand-name">Scenario Lab</span>}
      </span>
      <CallSwitcher />
      {narrow
        ? <TabMenu current={url.tab} onPick={go} hasCall={!!url.call} />
        : (
          <nav className="lab-tabs" aria-label="Surfaces">
            {TAB_ORDER.map(tab => {
              const entry = SURFACE_REGISTRY[tab];
              return (
                <button key={tab} type="button" className={cx('lab-tab', !url.call && entry.needsCall && 'lab-dim')} aria-current={url.tab === tab ? 'page' : undefined}
                  title={`${entry.question} (G ${entry.key})`} onClick={() => go(tab)}>
                  {entry.label}
                </button>
              );
            })}
          </nav>
        )}
      <span className="lab-top-end">
        <button type="button" className="lab-go" onClick={onPalette} aria-label={`Go to (${paletteKey()})`}>
          <Glyph name="search" />
          {!narrow && <span>Go to…</span>}
          <Kbd>{paletteKey()}</Kbd>
        </button>
        <span className="lab-toggles">
          <Toggle label="X-ray" glyph="scan" on={url.xray} compact={narrow} onChange={() => navigate({ xray: !url.xray }, 'replace')} />
          <Toggle label="Names" glyph="names" on={url.names} compact={narrow} onChange={() => navigate({ names: !url.names }, 'replace')} />
        </span>
        <button type="button" className={cx('lab-notes', url.notes && 'lab-notes-open')} aria-pressed={url.notes} onClick={() => navigate({ notes: !url.notes }, 'replace')}
          title={`Review notes (\\)${notes.shared ? '' : ': kept in this browser only'}`} aria-label={`Review notes, ${count}`}>
          <Glyph name="note" />
          <span>{count}</span>
        </button>
        <button type="button" className="lab-icon-button" onClick={onShortcuts} aria-label="Keyboard shortcuts (?)" title="Keyboard shortcuts (?)"><Glyph name="keys" /></button>
        <DevStatus compact={narrow} />
      </span>
    </header>
  );
}
