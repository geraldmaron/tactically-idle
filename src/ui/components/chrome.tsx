import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons';

// The chrome contract (docs/ui-ux-audit.md, "Structure"). Three modes, chosen by the screen that
// is showing, drawn by the shell:
// - desk: the 44px resource bar on top and the four tabs below. The default.
// - flow: a 52px head with back and a title on top, no tabs, and at most one action bar below.
// - focus: neither bar; the screen draws its own chrome (the live call's strip and Step out).
// Whatever sits in the foot slot (tabs, an action bar, a focus screen's controls) is measured, and
// toasts stand above it, so a toast never covers an action bar.

export type ChromeMode = 'desk' | 'flow' | 'focus';

interface ChromeApi {
  mode: ChromeMode;
  head: HTMLElement | null;
  foot: HTMLElement | null;
  register: (mode: ChromeMode) => () => void;
}

const ChromeContext = createContext<ChromeApi>({ mode: 'desk', head: null, foot: null, register: () => () => {} });

/** The shell's side: the current mode (the most recently mounted request wins) and the slots. */
export function useChromeShell() {
  const [requests, setRequests] = useState<{ id: number; mode: ChromeMode }[]>([]);
  const [head, setHead] = useState<HTMLElement | null>(null);
  const [foot, setFoot] = useState<HTMLElement | null>(null);
  const nextId = useRef(1);
  const register = useRef((mode: ChromeMode) => {
    const id = nextId.current++;
    setRequests((current) => [...current, { id, mode }]);
    return () => setRequests((current) => current.filter((request) => request.id !== id));
  }).current;
  const mode: ChromeMode = requests.at(-1)?.mode ?? 'desk';
  return { api: { mode, head, foot, register }, setHead, setFoot };
}

export const ChromeProvider = ChromeContext.Provider;

/** The mode the shell is drawing now. */
export const useChrome = () => useContext(ChromeContext).mode;

/** Ask the shell for a chrome mode while this component is mounted. Desk is the default, so a desk
 * screen needs no call. A focus screen calls `useChromeMode('focus')` and draws its own strip. */
export function useChromeMode(mode: ChromeMode) {
  const { register } = useContext(ChromeContext);
  useLayoutEffect(() => register(mode), [register, mode]);
}

/** Put content in the shell's foot slot, where the tabs sit on a desk screen. Use it for a focus
 * screen's bottom controls so toasts stand above them. A flow passes its ActionBar to FlowScreen. */
export function ChromeFoot({ children }: { children: ReactNode }) {
  const { foot } = useContext(ChromeContext);
  return foot ? createPortal(children, foot) : null;
}

export interface FlowHeadProps {
  title: ReactNode;
  /** Leave it out for a flow with no way back (the debrief: Done settles, then leaves). The head
   * then draws no Back and the title stays centred. */
  onBack?: () => void;
  /** Where Back goes, in words ("Calls"). Defaults to "Back". */
  backLabel?: string;
  /** One quiet control at the right of the head, for example Map. */
  trailing?: ReactNode;
}

/** A pushed flow: the brief, deploy, the debrief, a hire. The head (back, title, one trailing
 * control) replaces the resource bar, the tabs go, and `footer` (one ActionBar) takes their place.
 * The children scroll in the screen as usual. Pass `onBack` that keeps any draft: Back never
 * discards the player's choices. A debrief passes no `onBack`: it settles before it leaves. */
export function FlowScreen({ footer, children, ...head }: FlowHeadProps & { footer?: ReactNode; children: ReactNode }) {
  const chrome = useContext(ChromeContext);
  useChromeMode('flow');
  return (
    <>
      {chrome.head && createPortal(<FlowHead {...head} />, chrome.head)}
      {footer && chrome.foot && createPortal(footer, chrome.foot)}
      {children}
    </>
  );
}

/** The 52px flow head. Focus lands on the title when a flow opens or its title changes. */
export function FlowHead({ title, onBack, backLabel = 'Back', trailing }: FlowHeadProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const key = typeof title === 'string' ? title : '';
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, [key]);
  return (
    <header className="flow-head">
      {onBack ? <button type="button" className="flow-back" onClick={onBack} aria-label={backLabel === 'Back' ? 'Back' : `Back to ${backLabel}`}>
        <Icon name="chevronLeft" size={18} />
        <span>{backLabel}</span>
      </button> : <span className="flow-back flow-back-none" aria-hidden="true" />}
      <h1 className="flow-title" ref={titleRef} tabIndex={-1}>{title}</h1>
      <span className="flow-trailing">{trailing}</span>
    </header>
  );
}
