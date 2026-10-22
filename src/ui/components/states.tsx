import type { ReactNode } from 'react';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { Spot } from '../icons/spots';
import type { SpotName } from '../icons/spots';

// The three states a list or panel can be in besides "has things": nothing here, working, and failed.
// One family (`.empty` in app.css) so a screen never hand-writes a muted paragraph for them. `compact`
// is the inline form for a card or a short list, where a 128px picture would add clutter.

interface StateProps {
  title: string;
  children?: ReactNode;
  /** One row: a 20px icon, the title and the line beside it. For a state inside a card or a short list. */
  compact?: boolean;
}

/** Nothing here yet. Pass the screen's `spot` picture, or an `icon` where a picture would crowd it. */
export function EmptyState({ spot, icon = 'info', title, children, compact }: StateProps & {
  /** The kit's picture for this screen (icons/spots.tsx); the icon is the fallback for one with none. */
  spot?: SpotName;
  icon?: IconName;
}) {
  return (
    <div className={`empty${compact ? ' empty-compact' : ''}`}>
      {spot && !compact ? <Spot name={spot} width={128} /> : <Icon name={icon} size={compact ? 'md' : 26} />}
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

/** Something is being fetched or worked out. Announced politely. It does not animate: the game's one
 * looping motion is the waiting-on-you ring (docs/call-presentation.md). */
export function LoadingState({ title = 'Loading', children, compact }: Partial<StateProps>) {
  return (
    <div className={`empty empty-loading${compact ? ' empty-compact' : ''}`} role="status" aria-live="polite">
      <Icon name="wait" size={compact ? 'md' : 'lg'} />
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

/** Something failed. Says what, and offers the way out as `action` (a Button). Announced at once. */
export function ErrorState({ title, children, compact, action }: StateProps & { action?: ReactNode }) {
  return (
    <div className={`empty empty-error${compact ? ' empty-compact' : ''}`} role="alert">
      <Icon name="warning" size={compact ? 'md' : 'lg'} />
      <strong>{title}</strong>
      {children && <span>{children}</span>}
      {action}
    </div>
  );
}
