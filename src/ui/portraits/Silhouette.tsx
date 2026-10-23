/** Who a silhouette stands for; it picks the head covering (a cap brim for officers, a hood for the subject). */
export type SilhouetteKind = 'officer' | 'subject' | 'civilian' | 'person' | 'patrol';

/** Head and shoulders, with what marks the role. The one stand-in for a person whose photograph is
 * missing or failed (Face, Portrait and ManagerPortrait): a generic figure, never initials, so it
 * claims nobody's identity. It fills its parent and takes the parent's `color`. */
export function Silhouette({ kind = 'person', className = '' }: { kind?: SilhouetteKind; className?: string }) {
  return <svg className={`silhouette${className ? ` ${className}` : ''}`} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    {kind === 'subject' ? <path d="M32 8c-9 0-15 6-15 15v4h30v-4c0-9-6-15-15-15z" /> : null}
    <circle cx="32" cy="26" r="11" />
    {kind === 'officer' || kind === 'patrol' ? <path d="M19 22c1-9 7-13 13-13s12 4 13 13z M17 22h30v3H17z" /> : null}
    <path d="M8 64c1-14 10-22 24-22s23 8 24 22z" />
  </svg>;
}
