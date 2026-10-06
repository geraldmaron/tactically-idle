import type { IncidentType } from '../sim/scenario-types';

/** Finite, reviewed narrative units. Engine IDs never come from display names.
 * Every framework owns its question, evidence, two investigative approaches,
 * competing resolutions and three coherent reports. Add a framework here and
 * register its compatible recipes; the generator does not invent missing facts.
 */
export interface IncidentFramework {
  type: IncidentType;
  title: string;
  personId: string;
  name: string;
  role: string;
  opening: string;
  question: string;
  approaches: readonly [string, string];
  approachResults: readonly [string, string];
  verify: string;
  claim: string;
  confirmed: string;
  disproved: string;
  resolutions: readonly [string, string];
  results: readonly [string, string];
  /** Only explicitly agreed physical moves receive an exit route. */
  moveOn: 'confirmed' | 'disproved' | 'neither';
  variants: readonly [string, string, string];
  truth: readonly [boolean, boolean, boolean];
}
export const ADDITIONAL_FRAMEWORKS: readonly IncidentFramework[] = [
  { type: 'missing_vulnerable', title: 'The Usual Way Home', personId: 'alex', name: 'Alex Morgan', role: 'Adult reported missing',
    opening: 'Alex Morgan missed an agreed check-in. A friend gives a last-known address; the report does not establish that Alex needs to be removed from home.',
    question: 'Where is Alex now, and what help, if any, does Alex want?',
    approaches: ['Reconstruct the last confirmed sighting', 'Check the familiar address with the caller'],
    approachResults: ['The caller separates the confirmed sighting from a guessed route.', 'The caller identifies the familiar address and who expected the check-in.'],
    verify: 'Reach Alex and check the requested next step', claim: 'Alex wants help reaching the waiting friend outside.',
    confirmed: 'Alex is found at the address and asks to meet the waiting friend outside.', disproved: 'Alex is found safe at home and wants the friend told that the check-in was missed.',
    resolutions: ['Accompany Alex to the waiting friend', 'Confirm Alex is safe and pass on the agreed message'],
    results: ['Alex reaches the friend outside by the checked route. The reunion, not the initial sighting, completes the search.', 'Alex stays at home by choice. The agreed message reaches the friend and the missing-person report is updated.'],
    moveOn: 'confirmed', variants: ['A missed check-in after a changed appointment', 'An old sighting mistaken for the current location', 'A familiar address omitted from the first search'], truth: [true, false, true] },
  { type: 'person_in_crisis', title: 'Someone to Stay', personId: 'robin', name: 'Robin Ellis', role: 'Person requesting support',
    opening: 'Robin Ellis called because being alone feels difficult tonight. Dispatch has no verified report of a weapon or injury.',
    question: 'What support will Robin accept now, and who will actually provide it?',
    approaches: ['Hear Robin without the caller speaking for them', 'Ask dispatch about the support Robin requested'],
    approachResults: ['Robin has room to describe the immediate concern in their own words.', 'Dispatch separates Robin’s request from the caller’s assumptions.'],
    verify: 'Check Robin’s preference with the trusted friend', claim: 'Robin wants to join the trusted friend waiting outside.',
    confirmed: 'Robin and the friend both agree to meet outside and remain together.', disproved: 'Robin asks for the friend to stay on the phone while Robin remains at home; both agree.',
    resolutions: ['Walk with Robin to the agreed support', 'Establish the agreed call while Robin stays home'],
    results: ['Robin reaches the waiting friend by consent. The friend accepts the agreed support role; no clinical recovery is claimed.', 'The friend answers and accepts the agreed call. Robin chooses to stay home; no diagnosis or medical discharge is implied.'],
    moveOn: 'confirmed', variants: ['The original caller proposed a move Robin did not request', 'Robin prefers familiar surroundings', 'A trusted friend has arrived after the first call'], truth: [true, false, true] },
  { type: 'domestic', title: 'Room to Cool Down', personId: 'jordan', name: 'Jordan Reed', role: 'Adult in a household disagreement',
    opening: 'Jordan Reed and another adult have argued about shared belongings. Patrol has separated the initial conversations; allegations remain separate from verified events.',
    question: 'Can the adults agree to a safe separation without anyone deciding ownership for them?',
    approaches: ['Hear Jordan’s request separately', 'Compare the two accounts with patrol'],
    approachResults: ['Jordan’s preferred next step is recorded without the other adult answering for them.', 'Patrol identifies what both adults agree happened and what remains disputed.'],
    verify: 'Confirm each adult’s separation agreement', claim: 'Jordan freely chooses to wait outside with patrol while the other adult stays indoors.',
    confirmed: 'Both adults accept that temporary arrangement. Jordan keeps personal belongings; disputed property stays untouched.', disproved: 'Both adults choose separate rooms and agree to stop the exchange. Neither asks to leave the home.',
    resolutions: ['Accompany Jordan to the agreed outside space', 'Record the separate-room agreement and next contact'],
    results: ['Jordan reaches patrol outside by the agreed route. The arrangement is temporary and makes no finding about the disputed property.', 'Patrol confirms the adults are apart in the agreed rooms and records their next contact. No ownership or relationship dispute is declared solved.'],
    moveOn: 'confirmed', variants: ['One adult has an arranged lift outside', 'Both adults want to remain at home separately', 'A disputed item is left in place pending later advice'], truth: [true, false, true] },
  { type: 'burglary', title: 'The Keyholder’s Call', personId: 'casey', name: 'Casey Bell', role: 'Shop keyholder',
    opening: 'An alarm activated after closing. Casey Bell is the keyholder. The alarm alone does not establish an intruder, a theft or a person still inside.',
    question: 'Is there evidence of an entry that needs preserving, or a verified alarm fault?',
    approaches: ['Check the alarm timing with Casey', 'Compare patrol’s exterior inspection with the alarm'],
    approachResults: ['Casey supplies the last authorized closing time and the alarm sequence.', 'Patrol distinguishes observed damage from the alarm company’s automated message.'],
    verify: 'Check the entry evidence with the keyholder', claim: 'There is corroborated damage requiring an incident record and preservation.',
    confirmed: 'The keyholder and patrol confirm fresh entry damage. Nobody is located inside; the record does not identify an offender.', disproved: 'The keyholder demonstrates the failed sensor and patrol finds no corroborating entry evidence.',
    resolutions: ['Preserve the entry evidence and agree keyholder custody', 'Record the verified sensor fault with Casey'],
    results: ['The observed damage is recorded and kept undisturbed. Casey accepts responsibility for the premises while the report proceeds.', 'The alarm company receives the verified fault report. Casey accepts the premises; no fictional intruder is recorded.'],
    moveOn: 'neither', variants: ['A fresh damaged opening after closing', 'A sensor repeats an earlier fault', 'An automated alarm omitted observed entry damage'], truth: [true, false, true] },
  { type: 'false_intruder', title: 'The Spare Key', personId: 'taylor', name: 'Taylor Brooks', role: 'Visitor at the address',
    opening: 'A neighbor reports Taylor Brooks entering with a key. Taylor says the resident expected the visit. Possession of a key and unfamiliarity to a neighbor settle neither account.',
    question: 'Can the resident confirm this visit independently?',
    approaches: ['Hear Taylor’s explanation at the doorway', 'Ask the neighbor what they actually observed'],
    approachResults: ['Taylor gives a checkable account of the invitation without being treated as guilty.', 'The neighbor separates an unfamiliar face from evidence of a forced entry.'],
    verify: 'Contact the resident and compare the invitation', claim: 'The resident independently confirms Taylor’s current visit.',
    confirmed: 'The resident confirms the invitation and Taylor’s access today.', disproved: 'The key was lent for an earlier visit. Taylor and the resident agree that Taylor will wait outside for the resident.',
    resolutions: ['Correct the intruder report with the resident’s account', 'Accompany Taylor to the agreed waiting place'],
    results: ['The authorized visit is recorded and the neighbor’s mistaken report corrected. Taylor remains by the resident’s invitation.', 'Taylor reaches the agreed waiting place voluntarily. The resident handles the access misunderstanding; no theft or arrest is invented.'],
    moveOn: 'disproved', variants: ['An expected visit unknown to the neighbor', 'An old permission mistaken for today’s invitation', 'The resident changed the visitor’s arrival time'], truth: [true, false, true] },
  { type: 'vacant_occupancy', title: 'Still Living Here', personId: 'sam', name: 'Sam Rivera', role: 'Current occupant',
    opening: 'A property record describes the address as empty, but Sam Rivera says it is their home. Patrol has no authority in this call to determine tenancy or carry out an eviction.',
    question: 'Is there an immediate safety repair to arrange, or only a records dispute needing referral?',
    approaches: ['Hear Sam’s current safety concerns', 'Ask the property contact what the empty record means'],
    approachResults: ['Sam separates immediate needs from the unresolved occupancy record.', 'The property contact identifies the record’s date without treating it as an eviction decision.'],
    verify: 'Check the reported defect with Sam and the property contact', claim: 'A damaged entrance needs an agreed repair contact today.',
    confirmed: 'Sam and the property contact verify the damaged entrance and agree who will arrange the repair.', disproved: 'The entrance is secure. The remaining issue is the outdated occupancy record, not an immediate physical danger.',
    resolutions: ['Complete the agreed repair referral with Sam present', 'Record current occupancy and provide the agreed referral'],
    results: ['The property contact accepts the repair referral with Sam’s consent. Sam remains at home; tenancy and repair completion are not invented.', 'The current account and disputed record are preserved for the proper service. Sam remains at home; the call makes no tenancy ruling.'],
    moveOn: 'neither', variants: ['A damaged entrance alongside the records dispute', 'An old vacancy record at an occupied home', 'A repair request lost when the address was marked empty'], truth: [true, false, true] },
  { type: 'disturbance', title: 'Across the Hall', personId: 'jamie', name: 'Jamie Patel', role: 'Resident named in a noise report',
    opening: 'A neighbor reports repeated noise from Jamie Patel’s address. The report combines what was heard earlier with an assumption about what is happening now.',
    question: 'Is the disturbance current, and what practical agreement can both sides keep?',
    approaches: ['Hear the neighbor’s timing and specific concern', 'Ask Jamie about the current gathering'],
    approachResults: ['The neighbor gives the time and duration rather than an accusation about motives.', 'Jamie describes the gathering and who can change its noise.'],
    verify: 'Compare the current sound with both accounts', claim: 'The reported noise is still occurring and Jamie can reduce it.',
    confirmed: 'The current sound matches the report. Jamie agrees to lower it and both sides accept a later check-in.', disproved: 'The noise has stopped. Both sides agree that the earlier event should not be described as continuing.',
    resolutions: ['Check the agreed noise reduction with both sides', 'Correct the timing and record the neighbor agreement'],
    results: ['The team verifies the agreed reduction and records the check-in. A neighborhood relationship is not declared permanently fixed.', 'The record distinguishes the earlier disturbance from the quiet scene now. Both parties receive the agreed next-contact arrangement.'],
    moveOn: 'neither', variants: ['A gathering still audible across the hall', 'A delayed report after the gathering ended', 'A quieter room is available for the remaining gathering'], truth: [true, false, true] },
  { type: 'business_robbery', title: 'Two Versions of the Till', personId: 'morgan', name: 'Morgan Lee', role: 'Shop witness',
    opening: 'Morgan Lee reports a theft from the till. Another witness describes an earlier disagreement. Patrol reports no ongoing threat and no suspect at the scene.',
    question: 'Which parts of the reported theft are independently supported, and which belong to another event?',
    approaches: ['Take Morgan’s account without the other witness present', 'Ask patrol to separate the witnesses’ timelines'],
    approachResults: ['Morgan identifies what was personally seen and what was heard from someone else.', 'Patrol records the two timelines separately before comparing them.'],
    verify: 'Compare the till record and the independent account', claim: 'Independent records support a current theft report.',
    confirmed: 'The record supports a missing sum during the reported event. It does not identify the person responsible.', disproved: 'The till record and timing contradict the claimed current loss. The earlier disagreement remains a separate account.',
    resolutions: ['Preserve the corroborated report and witness contacts', 'Record the contradiction without inventing an offender'],
    results: ['The current loss record and separate witness accounts are preserved for follow-up. No suspect identification, recovery or arrest is invented.', 'Both accounts and the contradictory record remain available. The call closes as a corrected report, without declaring a witness dishonest.'],
    moveOn: 'neither', variants: ['A corroborated current loss with no suspect identification', 'An earlier disagreement conflated with a loss', 'A delayed till record supports part of the witness account'], truth: [true, false, true] },
];
export const ADDITIONAL_FRAMEWORK_BY_TYPE = Object.fromEntries(ADDITIONAL_FRAMEWORKS.map(value => [value.type, value])) as Partial<Record<IncidentType, IncidentFramework>>;
