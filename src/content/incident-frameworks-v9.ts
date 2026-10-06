import type { IncidentType } from '../sim/scenario-types';

/** Finite, reviewed narrative units. Engine IDs never come from display names.
 * Every framework owns its question, evidence, two investigative approaches,
 * competing resolutions and three coherent reports. Add a framework here and
 * register its compatible recipes; the generator does not invent missing facts.
 *
 * Player-facing prose stays in-world: say what happened and what is left for
 * follow-up, rather than listing what the story declines to claim.
 */
export interface IncidentFramework {
  type: IncidentType;
  title: string;
  personId: string;
  name: string;
  role: string;
  /** Why this team was sent, shown with the call before dispatch. */
  dispatch: string;
  opening: string;
  question: string;
  /** Short label for the disputed point on the map and people panel. */
  factLabel: string;
  /** [first account, independent source]. Hearing the first account helps the
   * final agreed step; the independent source helps the disputed-point check. */
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
  /** Authoring notes for the three situations. Each one fixes the answer to the
   * disputed point, so they are never shown before the call is resolved. */
  variants: readonly [string, string, string];
  truth: readonly [boolean, boolean, boolean];
}
export const ADDITIONAL_FRAMEWORKS: readonly IncidentFramework[] = [
  { type: 'missing_vulnerable', title: 'The Usual Way Home', personId: 'alex', name: 'Alex Morgan', role: 'Adult reported missing',
    dispatch: 'The friend’s account and the first search disagree about where Alex was last seen. Find Alex and ask what Alex wants, without overriding Alex’s choices.',
    opening: 'Alex Morgan missed an agreed check-in. The friend who raised the alarm gave this address as the last place Alex was expected. Nobody has reported that Alex is hurt or in danger.',
    question: 'Where is Alex, and what help, if any, does Alex want?', factLabel: 'What Alex wants',
    approaches: ['Hear the friend’s account of the missed check-in', 'Ask a neighbor when Alex was last seen'],
    approachResults: ['The friend separates what they saw from what they guessed about Alex’s route.', 'The neighbor confirms when Alex last came home, which narrows where to look.'],
    verify: 'Find Alex and ask what Alex wants', claim: 'Alex wants help getting to the friend waiting outside.',
    confirmed: 'Alex is at the address and asks to go out and meet the waiting friend.', disproved: 'Alex is safe at home and would rather stay. Alex asks for the friend to be told.',
    resolutions: ['Walk Alex out to the waiting friend', 'Pass Alex’s message to the friend'],
    results: ['Alex meets the friend outside. The missing-person report closes with Alex found safe.', 'Alex stays home by choice. The friend gets Alex’s message, and the missing-person report closes with Alex found safe.'],
    moveOn: 'confirmed', variants: ['A missed check-in after a changed appointment', 'An old sighting mistaken for the current location', 'A familiar address omitted from the first search'], truth: [true, false, true] },
  { type: 'person_in_crisis', title: 'Someone to Stay', personId: 'robin', name: 'Robin Ellis', role: 'Person requesting support',
    dispatch: 'Robin asked for support, and the original caller suggested Robin should leave home. Find out what Robin actually wants and who will provide it.',
    opening: 'Robin Ellis called because being alone tonight feels too hard. There is no report of a weapon or injury. A trusted friend has offered to help.',
    question: 'What support will Robin accept, and who will provide it?', factLabel: 'Robin’s choice of support',
    approaches: ['Hear Robin out without the caller speaking for them', 'Ask dispatch what Robin asked for on the call'],
    approachResults: ['Robin describes what feels hard tonight in their own words.', 'The call record separates what Robin asked for from what the caller assumed.'],
    verify: 'Check Robin’s choice with the trusted friend', claim: 'Robin wants to go and stay with the trusted friend waiting outside.',
    confirmed: 'Robin and the friend both want to meet outside and stay together tonight.', disproved: 'Robin wants to stay home with the friend on the phone. The friend agrees to keep the call going.',
    resolutions: ['Walk Robin out to the friend', 'Set up the call and leave Robin at home'],
    results: ['Robin meets the friend outside and they leave together. The friend will stay with Robin tonight.', 'Robin stays home with the friend on the line. The friend will keep checking in tonight.'],
    moveOn: 'confirmed', variants: ['The original caller proposed a move Robin did not request', 'Robin prefers familiar surroundings', 'A trusted friend has arrived after the first call'], truth: [true, false, true] },
  { type: 'domestic', title: 'Room to Cool Down', personId: 'jordan', name: 'Jordan Reed', role: 'Adult in a household disagreement',
    dispatch: 'Patrol separated two adults arguing over shared belongings. Help them agree how to stay apart tonight without anyone deciding who owns what.',
    opening: 'Jordan Reed and another adult argued over shared belongings. Patrol has separated them. Each has made claims about the other that nobody has checked yet.',
    question: 'Can both adults agree to stay apart safely, without anyone ruling on who owns what?', factLabel: 'The arrangement both adults accept',
    approaches: ['Hear Jordan’s side separately', 'Compare both accounts with patrol'],
    approachResults: ['Jordan says what they want to happen next, without the other adult answering for them.', 'Patrol sets out what both adults agree happened and what is still disputed.'],
    verify: 'Confirm what each adult will agree to', claim: 'Jordan wants to wait outside with patrol while the other adult stays in.',
    confirmed: 'Both adults accept that for tonight. Jordan takes personal belongings; the disputed items stay where they are.', disproved: 'Both adults would rather stay home in separate rooms, and both agree to stop arguing tonight.',
    resolutions: ['Walk Jordan out to patrol', 'Record the separate-rooms agreement'],
    results: ['Jordan waits outside with patrol. The arrangement is for tonight only; who owns the disputed items is for later.', 'The adults stay in separate rooms and agree when patrol will check back. The property dispute is left for later.'],
    moveOn: 'confirmed', variants: ['One adult has an arranged lift outside', 'Both adults want to remain at home separately', 'A disputed item is left in place pending later advice'], truth: [true, false, true] },
  { type: 'burglary', title: 'The Keyholder’s Call', personId: 'casey', name: 'Casey Bell', role: 'Shop keyholder',
    dispatch: 'An after-hours alarm needs checking with the keyholder before anyone records it as a break-in.',
    opening: 'An alarm went off after closing, and Casey Bell, the keyholder, has arrived. An alarm on its own doesn’t mean someone broke in, took anything or is still inside.',
    question: 'Did someone force an entry, or did the alarm fault?', factLabel: 'Signs of forced entry',
    approaches: ['Go over the alarm timeline with Casey', 'Compare patrol’s outside check with the alarm log'],
    approachResults: ['Casey gives the closing time and the order the sensors tripped.', 'Patrol separates the damage they actually saw from the alarm company’s automated message.'],
    verify: 'Check the entry point with Casey', claim: 'There is fresh damage at an entry point that needs recording and preserving.',
    confirmed: 'Casey and patrol find fresh damage at the entry point. Nobody is inside, and nothing yet shows who did it.', disproved: 'Casey shows the sensor that failed, and patrol finds no sign of entry.',
    resolutions: ['Preserve the damage and hand the premises to Casey', 'Log the sensor fault with Casey'],
    results: ['The damage is recorded and left untouched for investigators. Casey takes charge of the premises.', 'The alarm company gets a fault report and Casey takes back the premises. It goes on record as a false alarm.'],
    moveOn: 'neither', variants: ['A fresh damaged opening after closing', 'A sensor repeats an earlier fault', 'An automated alarm omitted observed entry damage'], truth: [true, false, true] },
  { type: 'false_intruder', title: 'The Spare Key', personId: 'taylor', name: 'Taylor Brooks', role: 'Visitor at the address',
    dispatch: 'A neighbor reported a possible intruder, and the person inside says they were invited. Check with the resident before treating anyone as a suspect.',
    opening: 'A neighbor saw Taylor Brooks let themselves in with a key and called it in. Taylor says the resident is expecting them. Having a key doesn’t prove the visit is welcome, and a neighbor not recognizing someone doesn’t prove it isn’t.',
    question: 'Can the resident confirm this visit?', factLabel: 'Resident confirms the visit',
    approaches: ['Hear Taylor’s explanation at the doorway', 'Ask the neighbor what they actually saw'],
    approachResults: ['Taylor explains the invitation in a way you can check, and is treated as a visitor, not a suspect.', 'The neighbor admits they saw an unfamiliar face, not a forced door.'],
    verify: 'Confirm the visit with the resident', claim: 'The resident confirms Taylor is expected today.',
    confirmed: 'The resident confirms the invitation and that Taylor can be there today.', disproved: 'The resident lent Taylor the key for a visit last week, not today. Both agree Taylor will wait outside until the resident gets home.',
    resolutions: ['Close the report with the resident’s confirmation', 'Walk Taylor out to wait for the resident'],
    results: ['The visit is confirmed and the intruder report is corrected. Taylor stays as the resident’s guest.', 'Taylor waits outside by agreement, and the resident will sort out the key. Nothing was taken and nobody is arrested.'],
    moveOn: 'disproved', variants: ['An expected visit unknown to the neighbor', 'An old permission mistaken for today’s invitation', 'The resident changed the visitor’s arrival time'], truth: [true, false, true] },
  { type: 'vacant_occupancy', title: 'Still Living Here', personId: 'sam', name: 'Sam Rivera', role: 'Current occupant',
    dispatch: 'A property record says this address is empty, but someone lives here. Check for anything unsafe and refer the records dispute; patrol cannot rule on tenancy.',
    opening: 'A property record lists this address as empty, but Sam Rivera says it’s their home. Patrol can’t decide who has the right to live here, and this call is not an eviction.',
    question: 'Is something unsafe that needs fixing today, or is this only a records problem?', factLabel: 'Urgent repair needed',
    approaches: ['Ask Sam what feels unsafe right now', 'Ask the property contact what the empty record means'],
    approachResults: ['Sam separates what’s unsafe today from the dispute over the record.', 'The property contact explains when the record was made, and that it is not an eviction order.'],
    verify: 'Inspect the entrance with Sam and the property contact', claim: 'The damaged entrance needs a repair arranged today.',
    confirmed: 'Sam and the property contact agree the entrance is damaged and settle who will arrange the repair.', disproved: 'The entrance is secure. What’s left is an out-of-date record, not a safety problem.',
    resolutions: ['Hand over the repair request with Sam present', 'Record that Sam lives here and refer the dispute'],
    results: ['The property contact takes the repair request with Sam’s agreement. Sam stays home; the tenancy question goes to the housing service.', 'Sam’s account and the disputed record go to the housing service. Sam stays home while it is reviewed.'],
    moveOn: 'neither', variants: ['A damaged entrance alongside the records dispute', 'An old vacancy record at an occupied home', 'A repair request lost when the address was marked empty'], truth: [true, false, true] },
  { type: 'disturbance', title: 'Across the Hall', personId: 'jamie', name: 'Jamie Patel', role: 'Resident named in a noise report',
    dispatch: 'Repeated noise complaints have soured things between neighbors. Check what is happening now and help both sides agree on something they can keep to.',
    opening: 'A neighbor reports repeated noise from Jamie Patel’s place. The complaint mixes what they heard earlier with a guess about what is going on now.',
    question: 'Is the noise still going on, and what can both sides agree to?', factLabel: 'Noise still going on',
    approaches: ['Ask Jamie about the gathering', 'Get the neighbor’s times and what bothered them'],
    approachResults: ['Jamie describes the gathering and who can turn it down.', 'The neighbor gives times and how long it lasted, not guesses about motives.'],
    verify: 'Listen for the noise with Jamie and the neighbor', claim: 'The noise is still going on, and Jamie can bring it down.',
    confirmed: 'The noise matches the complaint. Jamie agrees to turn it down, and both sides accept a check-back later.', disproved: 'The noise has already stopped. Both sides agree the complaint was about earlier.',
    resolutions: ['Check the noise is down with both sides', 'Correct the complaint time and record the agreement'],
    results: ['The team confirms the noise is down and books a check-back. It will take more than one visit to mend things between them.', 'The record shows the noise was earlier and it is quiet now. Both sides know who to contact next time.'],
    moveOn: 'neither', variants: ['A gathering still audible across the hall', 'A delayed report after the gathering ended', 'A quieter room is available for the remaining gathering'], truth: [true, false, true] },
  { type: 'business_robbery', title: 'Two Versions of the Till', personId: 'morgan', name: 'Morgan Lee', role: 'Shop witness',
    dispatch: 'Two witnesses give different accounts of a till theft. Separate the accounts and check them against the till before anything is recorded.',
    opening: 'Morgan Lee reports money taken from the till. Another witness describes an argument earlier in the day. Patrol reports no ongoing threat and no suspect at the scene.',
    question: 'Which parts of the theft report hold up, and which belong to the earlier argument?', factLabel: 'Till loss confirmed',
    approaches: ['Take Morgan’s account away from the other witness', 'Have patrol separate the two timelines'],
    approachResults: ['Morgan separates what they saw from what they heard secondhand.', 'Patrol writes up each witness’s timeline before comparing them.'],
    verify: 'Check the till record with Morgan', claim: 'The till record backs up a theft during the reported time.',
    confirmed: 'The till record shows money missing during the reported time. It does not show who took it.', disproved: 'The till record and timing don’t match the reported theft. The earlier argument is a separate matter.',
    resolutions: ['Preserve the report and witness contacts', 'Record the mismatch and close the report'],
    results: ['The loss record and both statements go to detectives for follow-up. Nobody has been identified yet.', 'Both accounts and the till record are kept on file. The report is corrected without calling either witness a liar.'],
    moveOn: 'neither', variants: ['A corroborated current loss with no suspect identification', 'An earlier disagreement conflated with a loss', 'A delayed till record supports part of the witness account'], truth: [true, false, true] },
];
export const ADDITIONAL_FRAMEWORK_BY_TYPE = Object.fromEntries(ADDITIONAL_FRAMEWORKS.map(value => [value.type, value])) as Partial<Record<IncidentType, IncidentFramework>>;
