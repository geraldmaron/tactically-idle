// Call strip chips open the matching Director section on Play (spec 3.0). The strip names the
// section; Play opens the Director (a drawer below 1100 px) and that section opens and scrolls into
// view. Elsewhere the chips keep their own popovers.

export type DirectorSection = 'draw' | 'squad' | 'kit' | 'frame';

const EVENT = 'lab:director';

export function openDirector(section: DirectorSection): void {
  window.dispatchEvent(new CustomEvent<DirectorSection>(EVENT, { detail: section }));
}

/** Listens for openDirector; returns the unsubscribe. */
export function onDirector(listener: (section: DirectorSection) => void): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<DirectorSection>).detail);
  window.addEventListener(EVENT, handle);
  return () => window.removeEventListener(EVENT, handle);
}
