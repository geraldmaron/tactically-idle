import { useGame } from '../../store';
import { City } from './City';
import { ColdOpen } from './ColdOpen';
import { Founding } from './Founding';

/** The City tab (docs/world-redesign.md). The first session walks the onboarding stages the world keeps per
 * campaign: the cold open (A1) until the first call closes, then taking command (A2), then the living city
 * (B1) with the first custody sheet over it (A3). */
export function CityScreen() {
  const stage = useGame().world.onboarding.stage;
  if (stage === 'cold_open') return <ColdOpen />;
  if (stage === 'founding') return <Founding />;
  return <City />;
}
