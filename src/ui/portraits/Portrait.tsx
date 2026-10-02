import portraitManifest from '../../../public/art/portraits/manifest.json';
import { useState } from 'react';
import type { Officer } from '../../sim/types';
import { PERSONA_BY_ID, STARTER_PERSONAS } from '../../content/personas';
import { assetUrl } from '../art/assetUrl';

export interface PortraitProps {
  officer: Pick<Officer, 'id' | 'firstName' | 'surname' | 'portrait' | 'role'> & Pick<Partial<Officer>, 'identityId'>;
  size?: number;
  className?: string;
  /** Current career age, not a request to randomly replace the person's file photograph. */
  age?: number;
}

export function portraitSource(key: string): string {
  return assetUrl(key.includes('/') || /\.(png|webp|jpe?g|svg)$/i.test(key) ? key : `portraits/${key}.png`);
}

/** Upgrade presentation without rewriting a saved person or borrowing someone else's face. */
export function currentPortraitKey(officer: PortraitProps['officer']): string | null {
  const person = officer.identityId
    ? PERSONA_BY_ID[officer.identityId]
    : STARTER_PERSONAS.find((p) => p.legacyOfficerId === officer.id);
  if (!person || person.firstName !== officer.firstName || person.surname !== officer.surname
    || !portraitManifest.readyIds.includes(person.id)) return null;
  return person.portrait;
}

export function Portrait({ officer, size = 80, className, age }: PortraitProps) {
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const key = currentPortraitKey(officer);
  const failed = key === null || failedKey === key;
  const name = `${officer.firstName} ${officer.surname}`.trim();
  const style = {
    position: 'relative' as const, width: size, height: Math.round(size * 1.04 * 100) / 100,
    overflow: 'hidden', borderRadius: 'inherit', background: 'linear-gradient(160deg, #1c2c49 0%, #0d1628 100%)', flex: 'none',
  };
  return (
    <div className={className} style={style} data-portrait={failed ? 'unavailable' : 'painted'} title={age === undefined ? name : `${name} · age ${Math.floor(age)} · file portrait`}>
      {failed ? (
        <div role="img" aria-label={`Personnel file for ${name}; no photo on file`} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: size * .06, color: '#b8c8dc', fontSize: size * .3, letterSpacing: '.06em', backgroundImage: 'linear-gradient(rgba(158,184,212,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(158,184,212,.055) 1px, transparent 1px)', backgroundSize: `${size / 6}px ${size / 6}px`, border: '1px solid rgba(158,184,212,.18)', boxSizing: 'border-box' }}>
          <span aria-hidden="true" style={{ fontFamily: 'var(--font-display, sans-serif)', lineHeight: 1.2 }}>{officer.firstName.slice(0, 1)}{officer.surname.slice(0, 1)}</span>
          {size >= 54 && <span aria-hidden="true" style={{ fontSize: Math.max(6, size * .085), letterSpacing: '.04em', lineHeight: 1.35, textAlign: 'center', opacity: .7 }}>NO PHOTO<br />ON FILE</span>}
        </div>
      ) : (
        <img key={key} src={portraitSource(key)} alt={`File portrait of ${name}`} width={size} height={Math.round(size * 1.04)} draggable={false} onError={() => setFailedKey(key)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
      )}
    </div>
  );
}
