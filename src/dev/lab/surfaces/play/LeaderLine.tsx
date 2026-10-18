// The X-ray's leader line (spec 4.6, "select a row"): a dashed chalk line from the selected choice's
// card in the frame to its row in the rail, drawn in the blueprint's own ink, so the eye can go from
// what the player sees to what's underneath it. Measured from the DOM on every layout change; drawn
// only when both ends are on screen.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface Line { d: string; x1: number; y1: number; x2: number; y2: number }

export function LeaderLine({ root, selectedId, watch, reduced }: { root: RefObject<HTMLDivElement | null>; selectedId: string | null; watch: string; reduced: boolean }) {
  const [line, setLine] = useState<Line | null>(null);
  const frameRef = useRef(0);
  const measure = () => {
    const box = root.current;
    if (!box || !selectedId) { setLine(null); return; }
    const card = box.querySelector<HTMLElement>('.lab-frame-card-on');
    const row = box.querySelector<HTMLElement>(`[data-lab-row="${CSS.escape(selectedId)}"]`);
    const rail = row?.closest<HTMLElement>('.lab-play-rail');
    if (!card || !row || !rail) { setLine(null); return; }
    const base = box.getBoundingClientRect(), a = card.getBoundingClientRect(), b = row.getBoundingClientRect(), r = rail.getBoundingClientRect();
    const midB = b.top + b.height / 2;
    if (midB < r.top + 4 || midB > r.bottom - 4) { setLine(null); return; }
    const x1 = a.right - base.left + 2, y1 = a.top + Math.min(a.height / 2, 28) - base.top;
    const x2 = b.left - base.left - 4, y2 = midB - base.top;
    if (x2 - x1 < 24) { setLine(null); return; }
    const k = (x2 - x1) * 0.5;
    const next = { d: `M${x1.toFixed(1)},${y1.toFixed(1)} C${(x1 + k).toFixed(1)},${y1.toFixed(1)} ${(x2 - k).toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`, x1, y1, x2, y2 };
    setLine(prev => prev && prev.d === next.d ? prev : next);
  };
  const schedule = () => { cancelAnimationFrame(frameRef.current); frameRef.current = requestAnimationFrame(measure); };
  useLayoutEffect(() => { measure(); }, [watch]);
  useEffect(() => {
    const box = root.current;
    if (!box) return;
    const observer = new ResizeObserver(schedule);
    observer.observe(box);
    box.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    // The frame lays out after fonts and images load; look again shortly after.
    const timer = window.setInterval(schedule, 700);
    return () => { observer.disconnect(); box.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule); window.clearInterval(timer); cancelAnimationFrame(frameRef.current); };
  }, [selectedId]);
  if (!line) return null;
  return (
    <svg className="lab-leader" aria-hidden="true">
      <path key={reduced ? 'still' : `${selectedId}|${watch}`} className={reduced ? 'lab-leader-path' : 'lab-leader-path lab-leader-draw'} d={line.d} />
      <circle className="lab-leader-end" cx={line.x1} cy={line.y1} r={2.5} />
      <circle className="lab-leader-end" cx={line.x2} cy={line.y2} r={2.5} />
    </svg>
  );
}
