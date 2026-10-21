import { AVOIDABLE_THEMES, type ContentDescriptor } from '../../content/content-descriptors';
import { callTreeAt } from '../../content/call-trees';
import { parseIncidentId } from '../../gen/incident';
import { CARD_THEME_WORDS, CARD_WARNING_TEXT } from './labels';
import { useSettings } from './SettingsControls';

/** The order a card names themes in: the avoidable ones first, then the rest. */
const CARD_ORDER: readonly ContentDescriptor[] = [...AVOIDABLE_THEMES, 'death', 'police_gunfire', 'injury'];

/** The themes a call card names: the union over every situation of the call, never the drawn one,
 * so the card can't tell the player which situation they drew (a death that exists in only one
 * situation would give it away). The board filter still works per situation. A card that isn't a
 * generated call has none. */
export function cardDescriptors(cardId: string): ContentDescriptor[] {
  const spec = parseIncidentId(cardId);
  if (!spec) return [];
  const all = new Set((callTreeAt(spec.type)?.situations ?? []).flatMap((situation) => situation.descriptors ?? []));
  return CARD_ORDER.filter((d) => all.has(d));
}

/** The call card's warning: the themes the call can involve in plain words, then a line saying the
 * call can be left alone. Shown when the player keeps warnings on. */
export function CardWarning({ descriptors }: { descriptors: readonly ContentDescriptor[] }) {
  const on = useSettings().cardWarnings === 'all';
  if (!on) return null;
  return <div className="optile-warning" role="note">
    {descriptors.length > 0 && <p><strong>{CARD_WARNING_TEXT.involves}</strong> {descriptors.map((d) => CARD_THEME_WORDS[d]).join(', ')}.</p>}
    <p className="dim">{CARD_WARNING_TEXT.leaveIt}</p>
  </div>;
}
