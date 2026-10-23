import portraitManifest from '../../../public/art/portraits/manifest.json';
import { useState } from 'react';
import type { Officer } from '../../sim/types';
import { PERSONA_BY_ID } from '../../content/personas';
import { assetUrl } from '../art/assetUrl';
import { Silhouette } from './Silhouette';
import './portrait.css';

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
  const person = officer.identityId ? PERSONA_BY_ID[officer.identityId] : undefined;
  if (!person || person.firstName !== officer.firstName || person.surname !== officer.surname
    || !portraitManifest.readyIds.includes(person.id)) return null;
  return person.portrait;
}

export function Portrait({ officer, size = 80, className, age }: PortraitProps) {
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const key = currentPortraitKey(officer);
  const failed = key === null || failedKey === key;
  const name = `${officer.firstName} ${officer.surname}`.trim();
  const style = { width: size, height: Math.round(size * 1.04 * 100) / 100 };
  return (
    <div className={`portrait-art${className ? ` ${className}` : ''}`} style={style} data-portrait={failed ? 'unavailable' : 'painted'} title={age === undefined ? name : `${name} · age ${Math.floor(age)} · file portrait`}>
      {failed ? (
        <div className="portrait-file" role="img" aria-label={`Personnel file for ${name}; no photo on file`} style={{ ['--portrait-grid' as string]: `${size / 6}px` }}>
          <Silhouette kind="officer" />
          {/* The caption is only legible on large cards; small ones keep the silhouette and the accessible label. */}
          {size >= 100 && <span className="portrait-file-caption" aria-hidden="true">NO PHOTO<br />ON FILE</span>}
        </div>
      ) : (
        <img key={key} src={portraitSource(key)} alt={`File portrait of ${name}`} width={size} height={Math.round(size * 1.04)} draggable={false} onError={() => setFailedKey(key)} />
      )}
    </div>
  );
}
