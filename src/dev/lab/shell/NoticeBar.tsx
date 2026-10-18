// The notice bar under the call strip (spec 3.0): what the lab changed for you and why (a rewritten
// old link, a path kept to its valid prefix, a draw that also changed names), and call errors with
// the action that fixes them. Errors are red-edged; nothing here disappears on a timer.
import type { NoticeAction } from '../context';
import { cx, Glyph } from '../viz';
import type { GlyphName } from '../viz';

/** `key`: a notice with a key replaces any other with the same key (LabContextValue.notify). */
export interface Notice { id: string; text: string; tone: 'info' | 'warn' | 'error'; actions?: NoticeAction[]; dismissible?: boolean; key?: string }

const TONE_GLYPH: Record<Notice['tone'], GlyphName> = { info: 'info', warn: 'warn', error: 'error' };

export function NoticeBar({ notices, onDismiss }: { notices: readonly Notice[]; onDismiss: (id: string) => void }) {
  if (!notices.length) return null;
  return (
    <div className="lab-notices" role="region" aria-label="Notices" aria-live="polite">
      {notices.map(notice => (
        <div key={notice.id} className={cx('lab-notice', `lab-notice-${notice.tone}`)} role={notice.tone === 'error' ? 'alert' : undefined}>
          <Glyph name={TONE_GLYPH[notice.tone]} />
          <p className="lab-notice-text">{notice.text}</p>
          {notice.actions?.map(action => <button key={action.label} type="button" className="lab-button lab-button-quiet" onClick={action.run}>{action.label}</button>)}
          {notice.dismissible !== false && (
            <button type="button" className="lab-icon-button" aria-label="Dismiss notice" onClick={() => onDismiss(notice.id)}><Glyph name="close" size={12} /></button>
          )}
        </div>
      ))}
    </div>
  );
}
