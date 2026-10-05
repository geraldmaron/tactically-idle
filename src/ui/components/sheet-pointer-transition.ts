// A second tap can land on a different control after a sheet changes or closes.
// Keep only that small pointer area quiet for the rest of the double-tap gesture;
// keyboard activation and deliberate taps elsewhere remain immediately usable.
const REPEAT_MS = 500;
const REPEAT_RADIUS = 24;
interface Point { x: number; y: number; at: number }

export function guardSheetPointerTransitions(sheet: HTMLElement, backdrop: HTMLElement | null) {
  const doc = sheet.ownerDocument;
  const view = doc.defaultView;
  let last: Point | null = null;
  let guarded: Point | null = null;
  let held: Point | null = null;
  let released = false;
  let removed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const capture = { capture: true };
  const near = (event: MouseEvent, point: Point) => Math.hypot(event.clientX - point.x, event.clientY - point.y) <= REPEAT_RADIUS;
  const remove = () => {
    if (removed) return;
    removed = true;
    clearTimeout(timer);
    for (const type of pointerEvents) doc.removeEventListener(type, pointer, capture);
    doc.removeEventListener('keydown', reset, capture);
    view?.removeEventListener('popstate', reset);
    view?.removeEventListener('blur', reset);
    view?.removeEventListener('pagehide', reset);
  };
  const finish = () => {
    if (held) return;
    clearTimeout(timer);
    if (!released) return;
    const remaining = guarded ? guarded.at + REPEAT_MS - Date.now() : 0;
    if (remaining > 0) timer = setTimeout(remove, remaining);
    else remove();
  };
  const reset = () => { last = guarded = held = null; finish(); };
  const pointer = (input: Event) => {
    const event = input as MouseEvent;
    if (event.type === 'pointercancel') { held = null; finish(); return; }
    // Assistive technology and keyboard-generated clicks have no pointer count.
    if (event.type === 'click' && event.detail === 0) { reset(); return; }
    if (event.button !== 0) return;
    const down = event.type === 'pointerdown' || event.type === 'mousedown';
    if (down && event.type !== 'mousedown') held = null;
    const repeat = guarded && Date.now() - guarded.at <= REPEAT_MS && near(event, guarded);
    if (repeat || (held && near(event, held))) {
      if (down) { held = guarded; clearTimeout(timer); }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.type === 'click' || event.type === 'dblclick') { held = null; finish(); }
      else if (event.type === 'pointerup' || event.type === 'mouseup') {
        // Keep a press that began during the guard protected through its click,
        // even when the user holds it past the original repeat-tap interval.
        clearTimeout(timer);
        timer = setTimeout(() => { held = null; finish(); }, 50);
      }
      return;
    }
    if (event.type === 'pointerup' || event.type === 'mouseup') held = null;
    if (!released && (down || event.type === 'click')) {
      const target = event.target as Node | null;
      if (target && (sheet.contains(target) || backdrop?.contains(target))) {
        last = { x: event.clientX, y: event.clientY, at: Date.now() };
      }
    }
    finish();
  };
  const pointerEvents = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick', 'pointercancel'];
  for (const type of pointerEvents) doc.addEventListener(type, pointer, capture);
  doc.addEventListener('keydown', reset, capture);
  view?.addEventListener('popstate', reset);
  view?.addEventListener('blur', reset);
  view?.addEventListener('pagehide', reset);
  const transition = () => {
    if (last && Date.now() - last.at <= REPEAT_MS) guarded = last;
  };
  return {
    transition,
    release() {
      if (released) return;
      transition();
      released = true;
      // A campaign switch replaces the app/overlay nodes. The document capture
      // survives that replacement, then removes itself after this gesture.
      finish();
    },
  };
}
