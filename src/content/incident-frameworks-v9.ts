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
  /** Optional decision structure (content v11 and later; see docs/content-pipeline.md).
   * Absent fields compile exactly as before, so issued v9 and v10 calls are unchanged. */
  /** An early step the people on scene can take before anything is checked. The
   * resolution for `requiredFor` needs it: taking it early always costs time, while
   * leaving it costs a slower late step that can fall through when it turns out needed. */
  precaution?: { title: string; summary: string; result: string; requiredFor: 'confirmed' | 'disproved'; lateTitle: string; lateSummary: string };
  /** A third, slower way to close the call that works whatever the check found, such as
   * waiting with the person until a relative arrives. It cannot fall through, but it
   * takes longer and earns less trust than acting on what was checked. */
  waitFor?: { title: string; summary: string; result: string };
  /** The resolution for this answer needs both accounts heard first, for example before
   * handing a child to an adult. A missed account becomes a follow-up step. */
  corroborate?: { for: 'confirmed' | 'disproved'; summary: string };
  /** (content v12) Skip the check and carry out the step that fits the first report. It saves
   * the squad a step and its strain when the report is right, at a little trust. When the
   * report is wrong the team backs out (`wrong`, read only after it happens), the call loses
   * ground, and the step that fits what is true is still to do. */
  actOnReport?: { title: string; summary: string; assume: 'confirmed' | 'disproved'; wrong: string };
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
  // Content v11, first pipeline drop (docs/content-pipeline.md). These appear only in
  // SCENARIO_TYPES_V11; issued v9 and v10 catalogs never list them.
  { type: 'fall_at_home', title: 'A Fall at Home', personId: 'ruth', name: 'Ruth Okafor', role: 'Older adult who fell at home',
    dispatch: 'Ruth’s daughter called after Ruth told her on the phone that she had fallen. Find out how Ruth is and what she wants before anyone decides on an ambulance.',
    opening: 'Ruth Okafor, who is in her eighties, fell at home and can’t get up on her own. Her daughter is worried and wants an ambulance. Ruth told her she is fine. Nobody on scene has checked yet.',
    question: 'Is Ruth hurt, and what help does she want?', factLabel: 'Ruth is hurt',
    approaches: ['Hear the daughter’s account on the phone', 'Check the personal alarm company’s log'],
    approachResults: ['The daughter separates what Ruth told her from what she is afraid of.', 'The alarm company’s log shows whether Ruth called them and what she told the operator.'],
    verify: 'Ask Ruth how she is and what she wants', claim: 'Ruth is hurt and wants an ambulance crew to check her.',
    confirmed: 'Ruth admits she is in more pain than she let on and agrees an ambulance crew should check her.', disproved: 'Ruth is shaken but not hurt. She wants help getting up and someone to call her daughter.',
    resolutions: ['Stay with Ruth until the ambulance crew arrives', 'Help Ruth into her chair and call her daughter'],
    results: ['The team stays with Ruth until the ambulance crew arrives and takes over. Her daughter is told.', 'Ruth is back in her chair and talking to her daughter on the phone. Her daughter will come over this evening.'],
    moveOn: 'neither', variants: ['A slip with no injury, embarrassing but harmless', 'A sore wrist played down on the phone', 'The alarm log shows a longer time on the floor than Ruth admits'], truth: [false, true, true],
    waitFor: { title: 'Wait with Ruth until her daughter arrives',
      summary: 'Stay until Ruth’s daughter gets here, and call any help Ruth agrees to. It takes much longer, but it does not depend on the next step going right.',
      result: 'Ruth’s daughter arrives and takes over from the team, with any help Ruth agreed to already on its way.' } },
  { type: 'water_leak', title: 'Water Through the Ceiling', personId: 'owen', name: 'Owen Hale', role: 'Building manager',
    dispatch: 'A tenant reported water coming through the ceiling, and the building manager wants to enter the unit above. Check what is happening before anyone goes into a home without the tenant.',
    opening: 'Water is coming through the ceiling, and the building manager, Owen Hale, says it is from the unit above. The tenant upstairs hasn’t answered the door or the phone. Nobody has checked where the water is coming from.',
    question: 'Is the leak still running, and does someone need to enter the unit above?', factLabel: 'Leak still running',
    approaches: ['Hear Owen’s account of the leak', 'Ask the tenant who called what they saw'],
    approachResults: ['Owen explains when the water started and what the lease lets him do in an emergency.', 'The tenant who called separates what they saw dripping from what they guessed about the cause.'],
    verify: 'Check the ceiling and the upstairs door with Owen', claim: 'Water is still coming through, and it can’t wait for the tenant upstairs.',
    confirmed: 'Water is still coming through, and the tenant upstairs still can’t be reached. The lease lets Owen enter for an emergency repair.', disproved: 'The dripping has stopped. The tenant upstairs calls back and will be home within the hour to let the plumber in.',
    resolutions: ['Stand by while Owen enters to stop the leak', 'Arrange for the tenant to let the plumber in'],
    results: ['Owen goes in with the team as witnesses and stops the leak. He leaves a note for the tenant, and the repair is on record.', 'The tenant will meet the plumber when they get home. Owen records the damage downstairs, and nobody enters the unit.'],
    moveOn: 'neither', variants: ['A supply pipe still running in the empty unit above', 'An overflow that stopped when the upstairs tenant came home', 'An old stain mistaken for a new leak, with the tenant already reachable'], truth: [true, false, false],
    precaution: { title: 'Ask Owen to turn off the water to the floor above',
      summary: 'Stops any leak now, but leaves other tenants without water while you check. It takes a few minutes even if the leak has already stopped.',
      result: 'Owen turns off the water to the floor above. The other tenants are told it will be back on soon.', requiredFor: 'confirmed',
      lateTitle: 'Have Owen turn off the water above now', lateSummary: 'The leak is still running. Turning the water off now takes longer, and it may not work on the first try.' } },
  { type: 'lost_child', title: 'Lost and Found', personId: 'theo', name: 'Theo Marsh', role: 'Child separated from family',
    dispatch: 'Staff found a young child on their own, and a man at the entrance says he is the child’s uncle. Confirm who Theo came with before handing Theo to anyone.',
    opening: 'Staff found Theo Marsh, about seven years old, on their own and upset. A man at the front entrance says he is Theo’s uncle and has been looking for Theo. Nobody has checked that yet.',
    question: 'Who did Theo come with, and is the man at the entrance that person?', factLabel: 'Man at the entrance is family',
    approaches: ['Ask Theo who they came with', 'Ask staff what they saw when Theo arrived'],
    approachResults: ['Theo calms down enough to say who they came with and what that person looks like.', 'Staff describe who Theo arrived with and where they last saw that person.'],
    verify: 'Check with Theo whether they know the man', claim: 'The man at the entrance is the uncle Theo came with.',
    confirmed: 'Theo describes their uncle, and the description matches the man at the entrance. Staff confirm they came in together.', disproved: 'Theo doesn’t know the man, who explains he offered to help look for Theo’s family. Theo’s mom is on her way back inside.',
    resolutions: ['Walk Theo out to their uncle', 'Keep Theo at the desk until their mom arrives'],
    results: ['Theo is back with their uncle at the entrance. Staff note the time and the uncle’s name.', 'Theo waits at the desk with a staff member until their mom comes back inside. The man is thanked for his help.'],
    moveOn: 'confirmed', variants: ['A mom returning from the car while a helpful stranger waits at the door', 'The uncle Theo came with, waiting where staff can see him', 'A helpful stranger, with the first report missing that Theo came in with their mom'], truth: [false, true, false],
    precaution: { title: 'Ask staff to watch the doors for Theo’s family',
      summary: 'If the man is not family, Theo’s family still needs spotting. Watching the doors now ties up staff for a few minutes even if it turns out not to matter.',
      result: 'Staff take a door each and watch for anyone looking for a child.', requiredFor: 'disproved',
      lateTitle: 'Ask staff to watch the doors now', lateSummary: 'Theo’s family still needs spotting. Setting staff on the doors now takes longer, and it may not work on the first try.' },
    corroborate: { for: 'confirmed', summary: 'Before handing Theo to anyone, hear from both Theo and staff. This takes a few more minutes.' } },
];
export const ADDITIONAL_FRAMEWORK_BY_TYPE = Object.fromEntries(ADDITIONAL_FRAMEWORKS.map(value => [value.type, value])) as Partial<Record<IncidentType, IncidentFramework>>;
