import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Measure before paint so newly mounted cards never flash their fallback portrait size. */
export function useWidth<T extends HTMLElement>(fallback = 0): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.floor(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Call fn when Escape is pressed while active. */
export function useEscape(active: boolean, fn: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fn();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [active, fn]);
}
