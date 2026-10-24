import { APPROACH_NODES } from './hostage-live-approach';
import { ENDINGS, RESOLVE_NODES } from './hostage-live-resolve';
import type { CallTree } from './types';

// Going Live, the first curated call (design sheet: docs/calls/going-live-design.md), rewritten
// 2026-10-23 after the teardown (docs/calls/notes/going-live-teardown.md). A delivery rider {delivery_app}
// cut off over a missing order holds the night manager at the pickup counter of {place} and streams it
// on {stream_app}. The rider wants one sentence said on camera: that the rider didn't take the bag.
// The stream is the rider's shield and the rider's trap, and in one call in three it is also the only
// witness who can end this.
//
// Three situations, three different earlier scenes (the teardown's block 3 and 10: the old call had
// two truths that were one truth, and a reframe that was only a motive):
// - The clerk took it. The manager, the clerk's aunt or uncle, filed the complaint against the rider to
//   keep the clerk in the job, so the glances at the stockroom door were never about the handgun.
// - The rider took it. The red light at 11:40 is true in every detail except the one the rider leaves
//   out: the rider marked the order delivered and kept the bag. The four hundred people who believe
//   the rider are why the rider can't stop.
// - Nobody took it. The bag was left on the wrong porch and carried in by a neighbor, and a viewer who
//   lives on the customer's street has the clip. The audience the player was trying to shut up is the
//   only thing that can clear the rider, if nobody cuts it first.
//
// The handgun has no hidden switch any more. It comes up on an adverse result only when the rider is
// past breaking point, the stance the card shows, so every threat has a cause the player could see.
// Adverse results otherwise cost what the choice put at risk: the audience, the contact, the clerk's
// name, the manager's pride, the squad's cover (hostage-live-parts.ts `turnsOn`).
//
// Pressure source (src/content/incidents/hostage.ts): the stream's count. Talking on the stream feeds
// it; cutting it costs the rider's trust and the comments; turning the camera to the wall slows it.
// Self-harm screen (E4): applies to the rider. Cut off from the only income, accused in public, a
// handgun, a refusal. No path shows the rider's death (noDeathOnCard, force noFatal); the negotiator
// asks the direct question off the card. The 988 line shows in the debrief.

export const HOSTAGE_LIVE: CallTree = {
  type: 'hostage_crisis',
  title: 'Going Live',
  roles: [
    { id: 'rider', label: 'delivery courier', pronouns: 'he', kind: 'subject',
      profile: '{rider.first} has carried takeout for {delivery_app} two years, five nights a week out of {place}, and keeps every rating on a card in {rider.his} wallet. {rider.His} {stream_app} channel has four hundred followers, mostly couriers, posted from a handlebar mount.',
      carries: { label: 'Handgun', glyph: 'weapon', knownFrom: 'handgun' } },
    { id: 'manager', label: 'night manager', pronouns: 'she', kind: 'civilian',
      profile: '{manager.first} is the night manager at {place} and has run the shift for six years. {manager.He} filed the complaint that got {rider.first} cut off. Every pickup time on the whiteboard by the register is in {manager.his} handwriting.' },
    { id: 'clerk', label: 'night clerk', pronouns: 'he', kind: 'civilian',
      profile: '{clerk.first} is nineteen and works the night shift as a clerk, stocking the coolers. {manager.first} got {clerk.him} the job. {clerk.He} worked the register the night the order went missing.' },
    { id: 'friend', label: 'fellow courier', pronouns: 'he', kind: 'bystander', place: 'outside',
      profile: '{friend.first} is another {delivery_app} courier and rides the same zone as {rider.first}. {friend.He} came straight from a drop when the stream started and {friend~stands|stand} at the patrol line with {friend.his} delivery bag on {friend.his} back, typing into the comments.' },
  ],
  // A pickup counter: a shop floor, a sales floor or a bar.
  families: ['market_row', 'corner_store_flat_g2', 'bar_restaurant_g2'],
  scene: { setting: 'business', rooms: ['retail'], crowd: 2, timeOfDay: 'night' },
  summary: '{rider.first} went live to make the night manager say one sentence. {manager.first} is on the floor by the counter, and {rider.first} has a handgun.',
  coldOpen: '{delivery_app} shut {rider.first}’s account on Tuesday. The email gave one reason. A bag {rider.he} picked up at {place} at 11:40 never reached the customer, and {manager.first}, who runs the night counter, was the one who reported it. {rider.first} didn’t answer the email. {rider.He} added up what two years of rent looks like without {delivery_app}, and tonight, close to shutting, {rider.he} walked in, stood {rider.his} phone against the register and went live on {stream_app}. {rider.He} asked {manager.first} to say {rider.he} hadn’t taken the bag. {manager.first} said no. {clerk.first} was coming out of the stockroom with a case of water when the handgun came out of {rider.first}’s jacket, and hasn’t put the water down.',
  pressureLabel: '{manager.first} on camera',
  pressure: { start: 18, perMinute: 0.15, threshold: 85, civilianPerMinute: 0.5 },
  briefing: {
    dispatchReason: '{clerk.first}, the night clerk, called 911 from the stockroom, keeping {clerk.his} voice down. A courier the store reported to {delivery_app} is back with a handgun and won’t let {manager.first} or {clerk.first} leave.',
    known: [
      '{clerk.first} told the dispatcher, “{rider.He} {rider~wants|want} {manager.first} to say it on the stream.”',
      'Patrol counts more than four hundred people watching {rider.first}’s stream on {stream_app}.',
      '{clerk.first} says {manager.first} is sitting on the floor behind the register, out of frame.',
      'The store’s complaint says the order was picked up at 11:40 and never delivered.',
    ],
    unknown: ['Who took the bag'],
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
      confirmed: 'The team saw the handgun in {rider.first}’s hand on the stream.', disproved: 'The team could not see a handgun.' },
    rider_clear: { label: 'Who took the bag', claim: 'Who took the missing bag.',
      confirmed: '{rider.first} didn’t take the bag.', disproved: '{rider.first} picked the bag up at 11:40, kept it and marked it delivered.' },
    proof: { label: 'What the viewers know', claim: 'Whether anyone watching has seen the bag since it left {place}.',
      confirmed: 'A viewer posted a porch camera clip. The bag sat on a step two doors from the customer, and a neighbor carried it in.', disproved: 'Nobody in the comments has seen the bag since it left {place}.' },
  },
  situations: [
    { note: '{rider.He} didn’t take the bag. {clerk.first} did, and {manager.first}, who got {clerk.first} the job, filed the complaint against {rider.first} to keep {clerk.him} in it. Nobody watching has seen the bag.', truth: { rider_clear: true, proof: false }, descriptors: ['death', 'suicide_self_harm', 'injury', 'police_gunfire'] },
    { note: '{rider.He} picked up the bag at 11:40, kept it when the drop failed, marked it delivered and told the stream otherwise. The red light is true. Four hundred people believe {rider.him}.', truth: { rider_clear: false, proof: false }, descriptors: ['death', 'suicide_self_harm', 'injury', 'police_gunfire'] },
    { note: '{rider.He} delivered the bag. It sat on the wrong porch and a neighbor carried it in, and {delivery_app} said delivered while the customer said otherwise. A viewer who lives on that street has the porch clip. Nobody in the store took anything.', truth: { rider_clear: true, proof: true }, descriptors: ['death', 'suicide_self_harm', 'injury', 'police_gunfire'] },
  ],
  turns: { clerk_out: ['clerk_talks'] },
  difficulty: { base: 36, perTier: 4 },
  root: 'going_live',
  nodes: [...APPROACH_NODES, ...RESOLVE_NODES],
  endings: ENDINGS,
  rewards: { funding: 2600, trust: 6, xp: 45 },
};
