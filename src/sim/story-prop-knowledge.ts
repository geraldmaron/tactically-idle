import type { ScenarioDefinition, StoryPropBinding } from './scenario-types';

/** Public presentation for already-issued stories. This adds no facts or effects to
 * their frozen definitions. Unrecognised props stay private until explicitly authored. */
export function publicPropBinding(s: ScenarioDefinition, prop: StoryPropBinding): StoryPropBinding | null {
  if (prop.knownWhen !== undefined) return prop;
  if (!s.story) return null;
  const holder = prop.holderPersonId && s.story.bindings.people[prop.holderPersonId];
  const seen = holder ? { facts: [{ factId: holder.locationFactId, in: ['confirmed' as const] }] } : undefined;
  const name = s.story.archetypeId;
  if (name === 'release_changes_communication') {
    if (['bens_phone', 'maras_phone'].includes(prop.id)) return { ...prop, glyph: 'phone', knownWhen: { flags: ['sig_accounted'] }, confirmedWhen: { flags: ['sig_accounted'] },
      transitions: prop.transitions?.map(t => ({ ...t, observed: t.when.flags?.includes('sig_phone_left') === true })) };
    if (prop.id === 'delivery_slip') return { ...prop, glyph: 'document', knownWhen: { flags: ['sig_ben_safe'] }, confirmedWhen: { flags: ['sig_ben_safe'] } };
  }
  if (name === 'accessible_move' && prop.id === 'wheelchair' && seen) return { ...prop, glyph: 'wheelchair', knownWhen: seen, confirmedWhen: seen };
  if (name === 'care_and_personal_responsibility' && seen) {
    if (prop.id === 'shop_keys') return { ...prop, glyph: 'keys', knownWhen: {}, confirmedWhen: seen };
    if (prop.id === 'rosas_phone') return { ...prop, glyph: 'phone', knownWhen: seen, confirmedWhen: seen };
  }
  if (name === 'private_agreement' && prop.id === 'cals_phone') return { ...prop, glyph: 'phone', knownWhen: {}, confirmedWhen: {} };
  if (name === 'danger_then_assistance' && prop.id === 'register') return { ...prop, glyph: 'item', knownWhen: {}, confirmedWhen: {} };
  return null;
}
