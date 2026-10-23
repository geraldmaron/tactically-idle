import type { Officer } from '../../sim/types';
import { Icon } from '../icons';
import { certLegend } from '../screens/team-model';
import { Disclosure } from './Disclosure';

/** What the qualification glyphs on the tiles and rows mean: each certification held by someone shown, once,
 * with its glyph and its name. Folded by default; the glyphs themselves carry the same names as tooltips. */
export function CertLegend({ officers }: { officers: readonly Pick<Officer, 'certs'>[] }) {
  const entries = certLegend(officers);
  if (entries.length === 0) return null;
  return <Disclosure name="cert-legend" summary="What the qualification marks mean">
    <ul className="cert-legend">{entries.map((entry) => <li key={entry.id}><Icon name={entry.icon} size={16} />{entry.name}</li>)}</ul>
  </Disclosure>;
}
