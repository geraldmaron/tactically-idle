import './silhouette.css';

/** Who a silhouette stands for; it picks the head covering (a cap brim for officers, a hood for the subject). */
export type SilhouetteKind = 'officer' | 'subject' | 'civilian' | 'person' | 'patrol';

/** What a person wears or carries for the job they do. A role cue is read from the call's own words
 * for the role ("night manager", "delivery courier"); anyone it does not name gets no cue. */
export type SilhouetteCue = 'tie' | 'apron' | 'courier';

const CUE_WORDS: [SilhouetteCue, RegExp][] = [
  ['tie', /\b(manager|owner|supervisor|landlord|landlady|principal|director|boss|agent|lawyer|banker)\b/i],
  ['apron', /\b(clerk|cashier|stocker|worker|employee|server|waiter|waitress|cook|barista|attendant|teller|nurse|bartender|janitor|guard)\b/i],
  ['courier', /\b(courier|driver|rider|delivery|cyclist|carrier|messenger)\b/i],
];

/** The cue a role's words name, or null. Pure, so the same role always draws the same figure. */
export function cueForRole(role: string | null | undefined): SilhouetteCue | null {
  if (!role) return null;
  for (const [cue, words] of CUE_WORDS) if (words.test(role)) return cue;
  return null;
}

/** A small stable number from any string (FNV-1a), so one person always gets the same figure. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Hair, drawn in the shade tone over the head. Index is the person's variant. */
const HAIR_BACK: (string | null)[] = [null, 'M20 27c0-10 5-14 12-14s12 4 12 14v14h-5V29H25v12h-5z', null, null, null, null];
const HAIR_FRONT: (string | null)[] = [
  'M21 25c0-7 5-11 11-11s11 4 11 11c-2-4-6-6-11-6s-9 2-11 6z',
  'M22 24c3-6 8-8 11-8s7 2 9 8c-4-2-8-3-10-3s-6 1-10 3z',
  'M22 25c0-6 4-10 10-10s10 4 10 10c-3-3-6-4-10-4s-7 1-10 4z',
  null,
  'M21 26c-1-8 4-12 11-12 7 0 12 4 11 12-1-3-3-5-6-6-3 2-9 3-16 6z',
  null,
];
const SHOULDER_SCALE = [0.94, 1, 1.07];
const HEAD_SHIFT = [-1.4, 0, 1.4];

/** Head and shoulders, with what marks the role. The one stand-in for a person whose photograph is
 * missing or failed (Face, Portrait and ManagerPortrait): a figure drawn, never initials and never a
 * portrait, so it claims nobody's identity. `seed` (a person's id) makes the figure stable per person
 * (hair, shoulders, how the head sits); `role` adds the one cue their job names. With neither it is
 * the plain generic figure. It fills its parent and takes the parent's `color`. */
export function Silhouette({ kind = 'person', className = '', seed, role }: { kind?: SilhouetteKind; className?: string; seed?: string; role?: string | null }) {
  const h = seed ? hash(seed) : null;
  const hair = h === null ? -1 : h % 6;
  const cue = kind === 'officer' || kind === 'patrol' ? null : cueForRole(role);
  const bodyScale = h === null ? 1 : SHOULDER_SCALE[(h >>> 3) % 3];
  const headShift = h === null ? 0 : HEAD_SHIFT[(h >>> 5) % 3];
  const capped = kind === 'officer' || kind === 'patrol';
  return <svg className={`silhouette${className ? ` ${className}` : ''}`} viewBox="0 0 64 64" aria-hidden="true" focusable="false" data-cue={cue ?? undefined}>
    <g transform={`translate(${headShift} 0)`}>
      {hair >= 0 && HAIR_BACK[hair] ? <path className="sil-shade" d={HAIR_BACK[hair]!} /> : null}
    </g>
    <g transform={`translate(32 0) scale(${bodyScale} 1) translate(-32 0)`}>
      <path d="M8 64c1-14 10-22 24-22s23 8 24 22z" />
      {cue === 'tie' ? <><path className="sil-light" d="M25 42.5l7 11 7-11z" /><path className="sil-cue" d="M30.6 46h2.8l1.3 12-2.7 2.3L29.3 58z" /></> : null}
      {cue === 'apron' ? <><path className="sil-cue" d="M22 64V49l4-5h12l4 5v15z" /><path className="sil-light" d="M35.5 51h5v3h-5z" /></> : null}
      {cue === 'courier' ? <><path className="sil-cue" d="M11 64l31-23 3 3.5L16 64z" /><rect className="sil-cue" x="38" y="50" width="14" height="11" rx="2.5" /></> : null}
    </g>
    <path className="sil-shade" d="M27.5 33h9v10h-9z" />
    <g transform={`translate(${headShift} 0)`}>
      {kind === 'subject' ? <path d="M32 8c-9 0-15 6-15 15v4h30v-4c0-9-6-15-15-15z" /> : null}
      <circle cx="32" cy="26" r="11" />
      {capped ? <path d="M19 22c1-9 7-13 13-13s12 4 13 13z M17 22h30v3H17z" /> : null}
      {cue === 'courier' && kind !== 'subject' ? <path className="sil-cue" d="M20 23c0-8 5-12 12-12s12 4 12 12zm-2 0h30v2.6H18z" /> : null}
      {!capped && kind !== 'subject' && cue !== 'courier' && hair >= 0 && HAIR_FRONT[hair] ? <path className="sil-shade" d={HAIR_FRONT[hair]!} /> : null}
      {hair === 2 && !capped && kind !== 'subject' && cue !== 'courier' ? <circle className="sil-shade" cx="32" cy="12" r="4.6" /> : null}
      {hair === 5 && !capped && kind !== 'subject' && cue !== 'courier' ? <g className="sil-shade"><circle cx="23.5" cy="21" r="4" /><circle cx="29" cy="16.5" r="4.4" /><circle cx="35.5" cy="16.5" r="4.4" /><circle cx="41" cy="21" r="4" /></g> : null}
    </g>
  </svg>;
}
