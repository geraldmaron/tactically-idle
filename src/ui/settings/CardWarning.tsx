import { CONTENT_DESCRIPTORS, type ContentDescriptor } from '../../content/content-descriptors';
import { callTreeAt } from '../../content/call-trees';
import { scenarioRecipe } from '../../content/scenario-recipes';
import { parseIncidentId } from '../../gen/incident';
import { CARD_THEME_WORDS, CARD_WARNING_TEXT } from './labels';
import { useSettings } from './SettingsControls';

/** The descriptors of the situation a generated call card will play, in list order. A card that
 * isn't a generated call has none. */
export function cardDescriptors(cardId: string): ContentDescriptor[] {
  const spec = parseIncidentId(cardId);
  if (!spec) return [];
  const own = callTreeAt(spec.type)?.situations[scenarioRecipe(spec).variant]?.descriptors ?? [];
  return CONTENT_DESCRIPTORS.filter((d) => own.includes(d));
}

/** The call card's warning: the themes the call involves in plain words, then a line saying the
 * call can be left alone. Shown when the player keeps warnings on. */
export function CardWarning({ descriptors }: { descriptors: readonly ContentDescriptor[] }) {
  const on = useSettings().cardWarnings === 'all';
  if (!on) return null;
  return <div className="optile-warning" role="note">
    {descriptors.length > 0 && <p><strong>{CARD_WARNING_TEXT.involves}</strong> {descriptors.map((d) => CARD_THEME_WORDS[d]).join(', ')}.</p>}
    <p className="dim">{CARD_WARNING_TEXT.leaveIt}</p>
  </div>;
}
