import { APPROACH_NODES } from './hostage-live-approach';
import { ENDINGS, RESOLVE_NODES } from './hostage-live-resolve';
import type { CallTree } from './types';

// Going Live, the first curated call (design sheet: docs/calls/going-live-design.md), rewritten
// 2026-10-23 after the teardown (docs/calls/notes/going-live-teardown.md) and again 2026-10-24 after
// sol's review (docs/calls/notes/going-live-sol-review-2026-10-24.md). A delivery courier {delivery_app}
// cut off over a missing order holds the night manager at the pickup counter of {place} and streams it
// on {stream_app}. The courier wants one sentence said on camera: that the courier didn't take the bag.
// The stream is the courier's shield and the courier's trap, and in one call in three it is also the
// only witness who can end this.
//
// The record every situation shares: the store logged the order collected at 11:40, and the courier's
// map has the courier at a red light on Calloway, two blocks away, at 11:40. Three situations, three
// different earlier scenes:
// - The clerk took it before the courier came, logged it collected, and told the courier another
//   courier had it. The manager, the clerk's aunt or uncle, filed the complaint against the courier to
//   keep the clerk in the job, so the glances at the stockroom door were never about the handgun.
// - The courier took it. The courier collected it a few minutes after 11:40, kept it when the drop
//   failed and marked it delivered. The red light is real and proves nothing about the bag.
// - Nobody took it. The courier collected it, left it on the wrong porch, and a neighbor carried it
//   in. A viewer on that street has the porch clip. The audience the player was trying to shut up is
//   the only thing that can clear the courier, if nobody cuts it first.
//
// What the player hears is evidence, not the answer: a walk-out ends `out_cleared` only when the
// viewers heard where the order went (hostage-live-parts.ts `walkOutEnding`), and a reveal settles a
// fact only from evidence that shows it (an admission, a confession, a matched clip).
//
// The handgun has no hidden switch. It comes up on an adverse result only when the courier is past
// breaking point, the stance the card shows (`turnsOn`), and every preview that can end there says so.
//
// Pressure source (src/content/incidents/hostage.ts): the stream's count. Talking on it feeds it;
// cutting it costs the courier's trust; turning the camera to the wall slows it. Self-harm screen (E4):
// applies to the courier. Cut off from the only income, accused in public, a handgun, a refusal. No
// path shows the courier's death (noDeathOnCard, force noFatal); the negotiator asks the direct
// question in `cornered`. The 988 line shows in the debrief.

export const HOSTAGE_LIVE: CallTree = {
  type: 'hostage_crisis',
  title: 'Going Live',
  roles: [
    { id: 'rider', label: 'delivery courier', pronouns: 'he', kind: 'subject',
      profile: '{rider.first} has carried takeout for {delivery_app} two years, five nights a week out of {place}. The missing order’s number is written on a card behind {rider.his} license. {rider.His} {stream_app} channel has about four hundred followers, mostly couriers, posted from a handlebar mount.',
      carries: { label: 'Handgun', glyph: 'weapon', knownFrom: 'handgun' } },
    { id: 'manager', label: 'night manager', pronouns: 'she', kind: 'civilian',
      profile: '{manager.first} is the night manager at {place} and has run the shift for six years. {manager.He} filed the complaint that got {rider.first} cut off. Every pickup time on the whiteboard by the register is in {manager.his} handwriting.' },
    // In the stockroom, where the 911 call came from. The way out from it is the building's shortest
    // (it can cross the shop floor), so no line promises a back door until R-R5 builds one.
    { id: 'clerk', label: 'night clerk', pronouns: 'he', kind: 'civilian', place: { rooms: ['storage'] },
      profile: '{clerk.first} is nineteen and works the night shift as a clerk, stocking the coolers. {manager.first} got {clerk.him} the job. {clerk.He} worked the register the night the order went missing.' },
    { id: 'friend', label: 'fellow courier', pronouns: 'he', kind: 'bystander', place: 'outside',
      profile: '{friend.first} is another {delivery_app} courier and rides the same zone as {rider.first}. {friend.He} came straight from a drop when the stream started. {friend.He} {friend~stands|stand} at the patrol line with {friend.his} delivery bag on, typing into the comments.' },
  ],
  // A pickup counter: a shop floor, a sales floor or a bar.
  families: ['market_row', 'corner_store_flat_g2', 'bar_restaurant_g2'],
  scene: { setting: 'business', rooms: ['retail'], crowd: 2, timeOfDay: 'night' },
  summary: '{rider.first} wants the night manager to say on camera that {rider.he} didn’t take an order. More viewers join while {rider.he} {rider~holds|hold} the manager at gunpoint.',
  coldOpen: '{delivery_app} shut {rider.first}’s account on Tuesday. The complaint names {rider.first}. The order is logged as collected from {place} at 11:40, and the customer says it never came. {manager.first}, who runs the night counter, filed the complaint. The email shut off new orders. {rider.first} kept reopening it. Tonight, close to shutting, {rider.he} walked in, stood {rider.his} phone against the register and went live on {stream_app}. {rider.He} asked {manager.first} to say {rider.he} hadn’t taken the bag. {manager.first} said no. {clerk.first} was coming out of the stockroom with a case of water when the handgun came out of {rider.first}’s jacket. {clerk.He} backed into the stockroom with the water still in {clerk.his} arms.',
  pressureLabel: '{rider.first}’s growing audience',
  pressure: { start: 18, perMinute: 0.15, threshold: 85, civilianPerMinute: 0.5 },
  briefing: {
    dispatchReason: '{clerk.first}, the night clerk, called 911 from the stockroom. A courier the store reported to {delivery_app} is back with a handgun and won’t let {manager.first} or {clerk.first} leave. Patrol says {rider.first} refused to come out.',
    known: [
      '{clerk.first} told the dispatcher, “{rider.He} {rider~wants|want} {manager.first} to say on the stream that {rider.he} didn’t take it.”',
      'The store’s complaint says the order was collected at 11:40 and never reached the customer.',
    ],
    unknown: ['Where the missing order went'],
    responsibilities: ['Get {manager.first} and {clerk.first} out', 'Bring {rider.first} out alive'],
  },
  stageLabels: { assess: 'On the stream', adapt: 'The bag', resolve: 'Way out' },
  objectives: [
    { id: 'clerk', label: 'Get {clerk.first} out' },
    { id: 'manager', label: 'Get {manager.first} out' },
    { id: 'rider', label: 'Bring {rider.first} out alive' },
  ],
  // A rider past breaking point who turns on the manager: a threat to life the team saw, so command
  // can approve going in (sim/authorization.ts).
  threatMarks: { turned: '{rider.first} turned the handgun on {manager.first}', shot_inside: '{rider.first} fired a shot inside' },
  facts: {
    handgun: { public: true, source: 'Responding patrol', truth: true, label: 'Patrol’s handgun report',
      claim: 'Patrol says {rider.first} is holding a handgun on the people inside.',
      confirmed: 'The team saw the handgun in {rider.first}’s hand.', disproved: 'The team could not see a handgun.' },
    rider_clear: { label: 'The missing order', claim: 'Whether {rider.first} kept the missing order.',
      confirmed: '{rider.first} didn’t keep the order.', disproved: '{rider.first} kept the order and marked it delivered.' },
    proof: { label: 'What the viewers have', claim: 'Whether a viewer has a clip that shows the delivery.',
      confirmed: 'A viewer’s porch camera shows the bag on a step two doors from the customer at 11:52. A neighbor carries the bag inside.', disproved: 'No viewer has supplied a checkable delivery clip.' },
  },
  situations: [
    { note: '{rider.He} never had the bag. {clerk.first} took it before {rider.first} came, logged it collected at 11:40 and said another courier had it. {manager.first}, who got {clerk.first} the job, filed the complaint against {rider.first} to keep {clerk.him} in it. No viewer has a delivery clip.', truth: { rider_clear: true, proof: false }, descriptors: ['death', 'suicide_self_harm', 'injury', 'police_gunfire'] },
    { note: '{rider.He} collected the bag a few minutes after 11:40, kept it when the drop failed, marked it delivered and told the stream otherwise. The red light is real and proves nothing about the bag. {rider.His} followers believe {rider.him}.', truth: { rider_clear: false, proof: false }, descriptors: ['death', 'suicide_self_harm', 'injury', 'police_gunfire'] },
    { note: '{rider.He} collected the bag and left it on the wrong porch at 11:52, and a neighbor carried it in. {delivery_app} said delivered while the customer said otherwise. A viewer who lives on that street has the porch clip. Nobody in the store took anything.', truth: { rider_clear: true, proof: true }, descriptors: ['death', 'suicide_self_harm', 'injury', 'police_gunfire'] },
  ],
  turns: { clerk_out: ['clerk_talks'] },
  difficulty: { base: 36, perTier: 4 },
  root: 'going_live',
  nodes: [...APPROACH_NODES, ...RESOLVE_NODES],
  endings: ENDINGS,
  rewards: { funding: 2600, trust: 6, xp: 45 },
};
