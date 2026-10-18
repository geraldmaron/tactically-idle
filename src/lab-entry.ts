// Which app this page load opens. The Scenario Lab lives at `{base}lab` in dev (Vite's SPA fallback
// serves index.html there) and behind a `lab` query key anywhere, for static lab builds that have no
// fallback. main.tsx decides before importing either app, so the lab never loads the game's store.

/** True when this load should open the Scenario Lab: path `{base}lab` or `{base}lab/`, or a `lab` query key. */
export function isLabLocation(pathname: string, search: string, base: string): boolean {
  if (new URLSearchParams(search).has('lab')) return true;
  // A relative base ('./') can't anchor the path, so only the last segment counts there.
  const root = base.startsWith('/') ? (base.endsWith('/') ? base : `${base}/`) : null;
  if (root) return pathname === `${root}lab` || pathname === `${root}lab/`;
  return /\/lab\/?$/.test(pathname);
}
