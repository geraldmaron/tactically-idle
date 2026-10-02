// Officer portrait: painted art from /public/portraits, or a deterministic illustrated SVG for `proc:<seed>`.
import { useId, useState } from 'react';
import type { Officer } from '../../sim/types';
import { ProceduralFace } from './procedural';

export interface PortraitProps {
  officer: Pick<Officer, 'id' | 'firstName' | 'surname' | 'portrait' | 'role'>;
  /** Rendered width in CSS px; height is width * 1.04. */
  size?: number;
  className?: string;
}

const PROC = 'proc:';

/** Accepts a bare key ('chen'), a path ('/portraits/chen.png') or 'proc:<seed>'. */
function paintedSrc(key: string): string {
  if (key.startsWith('/') || key.startsWith('http')) return key;
  return `${import.meta.env.BASE_URL}portraits/${key}.png`;
}

export function Portrait({ officer, size = 80, className }: PortraitProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [failed, setFailed] = useState(false);
  const key = officer.portrait;
  const procedural = key.startsWith(PROC) || failed;
  const name = `${officer.firstName} ${officer.surname}`.trim();
  const style = {
    position: 'relative' as const,
    width: size,
    height: Math.round(size * 1.04 * 100) / 100,
    overflow: 'hidden',
    borderRadius: 'inherit',
    background: 'linear-gradient(160deg, #1c2c49 0%, #0d1628 100%)',
    flex: 'none',
  };
  return (
    <div className={className} style={style} data-portrait={procedural ? 'procedural' : 'painted'}>
      {procedural ? (
        <div role="img" aria-label={`Portrait of ${name}`} style={{ position: 'absolute', inset: 0 }}>
          <ProceduralFace seed={key.startsWith(PROC) ? key.slice(PROC.length) : `${officer.id}:${key}`} uid={uid} />
        </div>
      ) : (
        <>
          <img src={paintedSrc(key)} alt={`Portrait of ${name}`} width={size} height={Math.round(size * 1.04)} draggable={false} onError={() => setFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 55%, rgba(2,5,12,0.55) 100%)' }} />
        </>
      )}
    </div>
  );
}
