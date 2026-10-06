import type { IncidentType } from '../sim/scenario-types';
import { ADDITIONAL_FRAMEWORK_BY_TYPE } from './incident-frameworks-v9';
import type { IncidentFramework } from './incident-frameworks-v9';

/** First content version whose calls compile with the decision depth below. */
export const FRAMEWORK_DEPTH_CONTENT_VERSION = 12;

type Depth = Pick<IncidentFramework, 'actOnReport' | 'waitFor' | 'precaution' | 'corroborate'>;

/** Decision depth for every typed framework from content v12 (docs/content-pipeline.md).
 *
 * Issued packages are never edited in place, so v12 adds structure here and calls before v12
 * compile exactly as issued. In v11 the eight v9 frameworks played as six identical decision
 * shapes, and most calls had one live button in two of their three stages: the check, then
 * the one step that fit its answer. From v12 every typed framework:
 * - can act on the first report instead of checking it (`actOnReport`), a real gamble whose
 *   odds depend on the situation;
 * - can close slowly but surely (`waitFor`) beside the step that fits the answer;
 * - and the v9 eight differ in which report they act on and which steps the answer needs.
 *
 * Only fields a package does not already define are added. */
export const FRAMEWORK_DEPTH_V12: Partial<Record<IncidentType, Depth>> = {
  missing_vulnerable: {
    actOnReport: { assume: 'disproved', title: 'Message the friend without asking Alex',
      summary: 'Assume Alex just missed the check-in, and message the friend without asking Alex. It spares the squad a step. If Alex wanted to meet the friend, the team has to put it right.',
      wrong: 'Alex wants to go out and meet the friend, and nobody had asked. The team stops the message and goes back to what Alex wants.' },
    precaution: { title: 'Ask the friend to wait by the phone',
      summary: 'If Alex would rather stay home, the friend needs to be reachable for a message. Asking now takes a few minutes, even if Alex does want to go out.',
      result: 'The friend agrees to wait by the phone for news of Alex.', requiredFor: 'disproved',
      lateTitle: 'Get hold of the friend for a message now',
      lateSummary: 'The friend needs to hear what Alex wants. Reaching them now takes longer, and it may not work on the first try.' },
    corroborate: { for: 'disproved', summary: 'Before telling the friend Alex is staying home, hear the friend and the neighbor. This takes a few more minutes.' },
    waitFor: { title: 'Stay until Alex and the friend have talked',
      summary: 'Stay while Alex and the friend talk it through, and go with whatever they agree. It takes much longer, but it does not depend on the next step going right.',
      result: 'Alex and the friend talk it through with the team nearby. The missing-person report closes with Alex found safe.' },
  },
  person_in_crisis: {
    actOnReport: { assume: 'disproved', title: 'Set up a call with the friend without asking Robin',
      summary: 'Keep Robin at home with the friend on the phone, without asking Robin. It spares the squad a step. If Robin wanted to go and stay with the friend, the team has to start again.',
      wrong: 'Robin wants to go and stay with the friend tonight, not talk on the phone. The team stops and goes back to what Robin asked for.' },
    corroborate: { for: 'disproved', summary: 'Before leaving Robin at home, hear Robin and check what Robin asked for on the call. This takes a few more minutes.' },
    precaution: { title: 'Ask the friend to wait right outside the door',
      summary: 'If Robin decides to go, the friend needs to be close. Asking now takes a few minutes, even if Robin would rather stay home.',
      result: 'The friend moves to wait just outside the door.', requiredFor: 'confirmed',
      lateTitle: 'Ask the friend to come to the door now',
      lateSummary: 'The friend needs to be close before Robin goes out. Getting them here now takes longer, and it may not work on the first try.' },
    waitFor: { title: 'Stay with Robin until the friend comes in',
      summary: 'Wait with Robin until the friend can come in and sit with them, then leave the plan to the two of them. It takes much longer, but it does not depend on the next step going right.',
      result: 'The friend comes in and sits with Robin. They make their own plan for tonight, and the team leaves them to it.' },
  },
  domestic: {
    actOnReport: { assume: 'disproved', title: 'Settle them in separate rooms without asking',
      summary: 'Take the quiet at face value and set up separate rooms without hearing what each adult wants. It spares the squad a step. If one of them wanted to leave, the team has to start again.',
      wrong: 'Jordan wants to leave for the night, not share the house. The team stops and goes back to what both adults will accept.' },
    corroborate: { for: 'disproved', summary: 'Before recording that both adults will stay home, hear Jordan and compare both accounts with patrol. This takes a few more minutes.' },
    waitFor: { title: 'Stay until both adults have calmed down',
      summary: 'Stay with patrol until both adults are calm enough to agree on tonight themselves. It takes much longer, but it does not depend on the next step going right.',
      result: 'Both adults calm down with the team there and agree how tonight will go. Who owns the disputed items is left for later.' },
  },
  burglary: {
    actOnReport: { assume: 'disproved', title: 'Log a sensor fault on Casey’s word',
      summary: 'Casey thinks it’s a sensor fault. Logging it now spares the squad a check. If someone did get in, the call has to be reopened, and marks at the door may be disturbed.',
      wrong: 'There is fresh damage at the entry point after all. The team stops the fault report and goes back to recording the damage with Casey.' },
    precaution: { title: 'Ask Casey to keep everyone clear of the doors',
      summary: 'If someone did force a way in, any marks need to stay untouched. Keeping everyone back slows the check by a few minutes, even if it turns out to be a fault.',
      result: 'Casey keeps staff and passersby away from the doors until the team has looked.', requiredFor: 'confirmed',
      lateTitle: 'Clear people away from the entry point now',
      lateSummary: 'The damage needs to stay untouched. Clearing people away now takes longer, and it may not work on the first try.' },
    waitFor: { title: 'Wait for the alarm engineer with Casey',
      summary: 'Stay with Casey until the alarm company’s engineer arrives and takes over the building. It takes much longer, but it does not depend on the next step going right.',
      result: 'The alarm engineer arrives and goes over the doors and sensors with Casey. Anything they find is passed on for follow-up.' },
  },
  business_robbery: {
    actOnReport: { assume: 'confirmed', title: 'File the report on Morgan’s account alone',
      summary: 'Take Morgan’s account as it stands and send the report to detectives without checking the till. It spares the squad a step. If the till doesn’t back it up, the report has to be pulled back.',
      wrong: 'The till record doesn’t match the reported time. The team pulls the report back before it goes to detectives and keeps both accounts on file.' },
    corroborate: { for: 'confirmed', summary: 'Before the report goes to detectives, take both witness accounts. This takes a few more minutes.' },
    waitFor: { title: 'Wait for the manager to bring the till records',
      summary: 'Hold everything until the shop manager brings the full till records, then file what they show. It takes much longer, but it does not depend on the next step going right.',
      result: 'The manager brings the full till records. Both statements and the records are filed together for follow-up.' },
  },
  vacant_occupancy: {
    actOnReport: { assume: 'disproved', title: 'Refer the record dispute without an inspection',
      summary: 'Treat this as a records problem and pass it to the housing service now. It spares the squad a step. If something is unsafe, it waits until someone comes back.',
      wrong: 'Sam shows the team a damaged entrance that needs a repair today. The referral waits while the team goes back to the repair.' },
    corroborate: { for: 'confirmed', summary: 'Before handing over the repair request, hear Sam and the property contact. This takes a few more minutes.' },
    precaution: { title: 'Ask the property contact to hold the record',
      summary: 'If this is only a records problem, the record must not change while it is reviewed. Asking now takes a few minutes, even if a repair turns out to be needed.',
      result: 'The property contact agrees to hold the record as it is until the housing service has looked at it.', requiredFor: 'disproved',
      lateTitle: 'Have the property contact hold the record now',
      lateSummary: 'The record must stay as it is while it is reviewed. Arranging that now takes longer, and it may not work on the first try.' },
    waitFor: { title: 'Wait for the housing officer to arrive',
      summary: 'Stay until a housing officer arrives to deal with the record, and anything unsafe, in person. It takes much longer, but it does not depend on the next step going right.',
      result: 'The housing officer arrives, looks over the entrance with Sam and takes on the record. Sam stays home while it is reviewed.' },
  },
  disturbance: {
    actOnReport: { assume: 'confirmed', title: 'Ask Jamie to turn it down without listening first',
      summary: 'Go straight to Jamie and ask for quiet, taking the complaint as it stands. It spares the squad a step. If the noise was earlier, Jamie may feel blamed for nothing.',
      wrong: 'It is already quiet, and Jamie says the gathering ended a while ago. The team stops, apologizes and goes back to setting the record straight.' },
    corroborate: { for: 'disproved', summary: 'Before correcting the complaint time, hear both Jamie and the neighbor. This takes a few more minutes.' },
    waitFor: { title: 'Stay until both neighbors agree on quiet hours',
      summary: 'Stay while Jamie and the neighbor work out quiet hours they can both keep. It takes much longer, but it does not depend on the next step going right.',
      result: 'Jamie and the neighbor agree on quiet hours with the team there. Both know who to contact next time.' },
  },
  false_intruder: {
    actOnReport: { assume: 'confirmed', title: 'Take Taylor at their word and close the report',
      summary: 'Taylor has a key and an explanation. Closing the report now spares the squad a call to the resident. If Taylor wasn’t expected today, the report has to be reopened.',
      wrong: 'The resident calls back: the key was for another day. The team reopens the report and works out with Taylor what happens now.' },
    precaution: { title: 'Ask Taylor to get their things together',
      summary: 'If Taylor does have to wait outside, it helps to be ready to go. Asking now takes a few minutes, even if the visit turns out to be expected.',
      result: 'Taylor gathers their bag and coat and waits by the door.', requiredFor: 'disproved',
      lateTitle: 'Ask Taylor to get their things now',
      lateSummary: 'Taylor has to wait outside and isn’t ready to go. Getting ready now takes longer, and it may not work on the first try.' },
    waitFor: { title: 'Wait with Taylor until the resident gets home',
      summary: 'Stay with Taylor until the resident is back and can speak for the visit in person. It takes much longer, but it does not depend on the next step going right.',
      result: 'The resident gets home and talks it through with Taylor. The report is corrected, and nothing was taken.' },
  },
  fall_at_home: {
    actOnReport: { assume: 'disproved', title: 'Help Ruth up on her word that she’s fine',
      summary: 'Ruth says she is fine. Helping her straight into her chair spares the squad a check. If she is hurt, the team has to stop partway and call an ambulance crew.',
      wrong: 'Ruth winces as the team starts to help her up and admits it hurts more than she said. The team stops and settles her where she is.' },
  },
  water_leak: {
    actOnReport: { assume: 'confirmed', title: 'Let Owen go in upstairs straight away',
      summary: 'Owen wants to enter now. Going in with him without checking spares the squad a step. If the leak has stopped, the team has entered a home it didn’t need to and has to explain why.',
      wrong: 'The dripping has already stopped, and the tenant upstairs calls back. The team stops Owen at the door before anyone goes in.' },
    waitFor: { title: 'Wait with Owen for the emergency plumber',
      summary: 'Stay with Owen until the plumber arrives and can deal with the leak and the tenant upstairs. It takes much longer, but it does not depend on the next step going right.',
      result: 'The plumber arrives and works it out with Owen and the tenant upstairs. The damage downstairs is on record.' },
  },
  lost_child: {
    actOnReport: { assume: 'confirmed', title: 'Walk Theo out to the man at the entrance now',
      summary: 'The man says he is Theo’s uncle. Handing Theo over now saves time for everyone. If he isn’t who he says, the team has to stop at the door.',
      wrong: 'Theo pulls back and says they don’t know the man. The team stops before anyone leaves, and the man says he was only helping look for Theo’s family.' },
    waitFor: { title: 'Wait at the desk until Theo’s family is found',
      summary: 'Keep Theo at the desk with staff while the building pages Theo’s family. It takes much longer, but it does not depend on the next step going right.',
      result: 'Staff page Theo’s family, and Theo waits at the desk until the person they came with collects them.' },
  },
};

/** The framework package a call compiles from at its content version. */
export function frameworkAt(type: IncidentType, contentVersion: number): IncidentFramework | undefined {
  const base = ADDITIONAL_FRAMEWORK_BY_TYPE[type];
  if (!base || contentVersion < FRAMEWORK_DEPTH_CONTENT_VERSION) return base;
  const depth = FRAMEWORK_DEPTH_V12[type];
  if (!depth) return base;
  const added = Object.fromEntries(Object.entries(depth).filter(([key]) => base[key as keyof Depth] === undefined));
  return { ...base, ...added };
}
