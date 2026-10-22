// The head of a call's pushed flow (brief, deploy, debrief): Back on the left, the title, one action
// on the right. 52px, pinned to the top of the scroll owner. Focus lands on the title when the step
// changes, so a keyboard or screen reader starts on the new step (docs/ui-ux-audit.md, exit table).
import { useEffect, useRef } from 'react';
import type { JSX, ReactNode } from 'react';
import { Icon } from '../icons';

export function CallHead({ back, title, action }: { back?: { label: string; onClick: () => void }; title: string; action?: ReactNode }): JSX.Element {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const node = heading.current;
    // Only move focus when it was on the page already (a step change), never on the first paint.
    if (node && document.activeElement && document.activeElement !== document.body) node.focus({ preventScroll: true });
  }, [title]);
  return <header className="cl-head">
    <span className="cl-head-side">
      {back && <button type="button" className="cl-head-back" onClick={back.onClick}><Icon name="chevronLeft" size={18} />{back.label}</button>}
    </span>
    <h1 className="cl-head-title" ref={heading} tabIndex={-1}>{title}</h1>
    <span className="cl-head-side cl-head-end">{action}</span>
  </header>;
}
