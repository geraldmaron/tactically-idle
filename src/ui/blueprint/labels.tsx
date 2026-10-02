// Render the exact wrapping, rotation and size selected by the collision-aware layout.
import { r2 } from './geometry';
import type { LabelItem } from './layout';

export function PlanLabel({ label: l, kind }: { label: LabelItem; kind: 'room' | 'zone' }) {
  return (
    <text x={r2(l.x)} y={r2(l.y)} textAnchor="middle" className={`bp-${kind}-label`} style={{ fontSize: `${l.size}px` }} transform={l.rot ? `rotate(${l.rot} ${r2(l.x)} ${r2(l.y)})` : undefined} data-space-label={l.id}>
      {(l.lines ?? [l.text]).map((line, i) => <tspan key={i} x={r2(l.x)} dy={i === 0 ? 0 : l.size * 1.15}>{line}</tspan>)}
    </text>
  );
}
