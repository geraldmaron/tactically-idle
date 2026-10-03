import type { IncidentSpec } from '../../sim/scenario-types';
import { hashSeed } from '../../sim/rng';

export type V4Family = 'welfare' | 'assistance' | 'protective';
export interface V4Premise {
  id: string;
  family: V4Family;
  label: string;
  report: string;
  dispatchReason: string;
  responsibilities: string[];
  objective: string;
  preparation: { title: string; summary: string; success: string; flag: string };
  pressure: { start: number; perMinute: number; threshold: number; civilianPerMinute: number };
  arrivalMinutes: number;
  communicationDifficulty: number;
  aftermath?: boolean;
  clinician?: boolean;
  delayedReceiver?: boolean;
  aidFirst?: boolean;
}

/** Public premises use a separate stream from hidden scene facts and service capacity. */
export const V4_PREMISES: V4Premise[] = [
  {
    id: 'conflicting_intruder', family: 'welfare', label: 'Conflicting intruder report',
    report: 'An initial report of a threatened occupant brought the team here. A later caller says the reported intrusion may be a misunderstanding.',
    dispatchReason: 'SWAT was requested after a caller described a specific threat of serious violence and an occupant who could not be reached. That account now conflicts with a second report.',
    responsibilities: ['Recheck the original threat and the occupant’s welfare', 'Close a disproved report or carry out the help actually needed'],
    objective: 'Reconcile the original call with an independent account',
    preparation: { title: 'Compare the two call timelines', summary: 'Separate direct observations from old or second-hand information.', success: 'The two timelines are reconciled; a final correction can cite independent information.', flag: 'v4_timeline_compared' },
    pressure: { start: 10, perMinute: 0.35, threshold: 82, civilianPerMinute: 0.5 }, arrivalMinutes: 8, communicationDifficulty: -4,
  },
  {
    id: 'welfare_after_threat', family: 'welfare', label: 'Welfare after a threat report',
    report: 'During a response to a reported serious threat, an occupant asks for space and says they may want someone they trust involved.',
    dispatchReason: 'The team is already deployed for a reported threat of serious violence. It must reassess that report and this occupant’s welfare separately.',
    responsibilities: ['Check the current threat without assuming distress means danger', 'Ask what support the person accepts and confirm any agreed next step'],
    objective: 'Identify an acceptable way to communicate and follow through',
    preparation: { title: 'Agree how the person wants to talk', summary: 'Offer a quieter conversation or a trusted contact, without treating refusal as proof of danger.', success: 'The person’s communication preference is recorded and available for a revised conversation.', flag: 'v4_communication_preference' },
    pressure: { start: 15, perMinute: 0.45, threshold: 78, civilianPerMinute: 0.6 }, arrivalMinutes: 10, communicationDifficulty: 5, clinician: true,
  },
  {
    id: 'alarm_call_recheck', family: 'welfare', label: 'Alarm account in doubt',
    report: 'An alarm-related call included a claim that someone was being threatened inside. A verified contact now disputes part of the account.',
    dispatchReason: 'The earlier report of a person held under a specific violent threat prompted the SWAT callout. An ordinary alarm alone would not justify it.',
    responsibilities: ['Verify the reported person and the original threat', 'Confirm the caller’s correction before closing the high-risk response'],
    objective: 'Check an independent callback before downgrading the alarm report',
    preparation: { title: 'Verify the independent callback', summary: 'Check that the callback concerns this address and today’s alarm, not a different incident.', success: 'The callback is tied to the correct address and event; the alarm account can now be corrected reliably.', flag: 'v4_callback_verified' },
    pressure: { start: 12, perMinute: 0.5, threshold: 80, civilianPerMinute: 0.6 }, arrivalMinutes: 6, communicationDifficulty: 0,
  },
  {
    id: 'care_during_response', family: 'assistance', label: 'Medical concern during a response',
    report: 'During an ongoing high-risk response, a caller describes an injury and asks for medical help. The team has not yet checked access or the person’s condition.',
    dispatchReason: 'SWAT is already at a scene involving a reported serious violent threat. Paramedics need the team to establish safe access; the medical complaint did not itself trigger this callout.',
    responsibilities: ['Check current safety and establish access for paramedics', 'Provide only qualified first aid, then confirm that paramedics accept care'],
    objective: 'Prepare immediate first aid and an accepted paramedic assessment',
    preparation: { title: 'Prepare qualified first aid', summary: 'Use one trauma kit and the team’s first-aid training while arranging paramedic access.', success: 'Qualified first aid has been provided within the team’s training; it buys time but does not replace paramedic assessment.', flag: 'v4_first_aid' },
    pressure: { start: 30, perMinute: 1.3, threshold: 65, civilianPerMinute: 1.1 }, arrivalMinutes: 5, communicationDifficulty: 0, aidFirst: true,
  },
  {
    id: 'care_conversation', family: 'assistance', label: 'Medical help after interrupted contact',
    report: 'An occupant reported feeling unwell during a high-risk call. Contact has been interrupted, and it is unclear what help they will accept.',
    dispatchReason: 'The team was deployed for an independently reported serious threat. Its current task is to recheck safety and make medical help accessible without making a diagnosis.',
    responsibilities: ['Recheck what the person says they need', 'Agree an assessment or a voluntary next step, then confirm it happened'],
    objective: 'Restore a usable conversation before choosing care or follow-up',
    preparation: { title: 'Restore an accessible conversation', summary: 'Ask whether a quieter exchange, plain questions or a trusted contact would make communication easier.', success: 'A workable communication arrangement is ready; a revised care conversation can use it.', flag: 'v4_accessible_conversation' },
    pressure: { start: 20, perMinute: 0.75, threshold: 76, civilianPerMinute: 0.8 }, arrivalMinutes: 9, communicationDifficulty: 7,
  },
  {
    id: 'aftercare_delay', family: 'assistance', label: 'Care after the protective phase',
    report: 'The immediate protective phase has ended and the person is located. A reported medical concern still needs checking; the nearest ambulance crew is committed elsewhere.',
    dispatchReason: 'This is the aftermath of an authorised SWAT response to a credible serious threat. The team’s remaining responsibility is safe, accepted medical care or an honest record of what remains unfinished.',
    responsibilities: ['Confirm the current medical concern without assuming a diagnosis', 'Arrange an available paramedic receiver and preserve responsibility until care is accepted'],
    objective: 'Arrange an alternative receiving crew and confirm its acceptance',
    preparation: { title: 'Confirm the receiving arrangements', summary: 'Check the district crew’s meeting point and its ability to assess the person when it arrives.', success: 'The district crew’s receiving arrangements are confirmed; requesting them still does not count as accepted care.', flag: 'v4_receiver_arranged' },
    pressure: { start: 12, perMinute: 0.6, threshold: 78, civilianPerMinute: 0.7 }, arrivalMinutes: 14, communicationDifficulty: -3, aftermath: true, delayedReceiver: true,
  },
  {
    id: 'barricade_dialogue', family: 'protective', label: 'Dialogue during a barricade report',
    report: 'A person has refused to come out after a reported serious assault. Refusal alone does not settle whether anyone now faces immediate danger.',
    dispatchReason: 'SWAT was requested for the reported serious assault and unresolved threat to people at the scene, not for the person’s refusal or state of mind alone.',
    responsibilities: ['Check the current danger and preserve a usable line of communication', 'Complete an agreed protective plan or record the unresolved duty'],
    objective: 'Agree on and complete a protective plan through the team’s own negotiators',
    preparation: { title: 'Prepare a clear negotiated plan', summary: 'Use the team’s communication training to make the proposed next step understandable and checkable.', success: 'The negotiated plan has clear steps the person understands; the team must still complete it.', flag: 'v4_negotiated_plan' },
    pressure: { start: 22, perMinute: 0.7, threshold: 78, civilianPerMinute: 0.9 }, arrivalMinutes: 8, communicationDifficulty: 2,
  },
  {
    id: 'protective_movement', family: 'protective', label: 'An agreed move needs a usable route',
    report: 'A person wants to leave a scene involving a reported violent threat, but the suggested exit and current danger have not been checked.',
    dispatchReason: 'A specific report of threatened serious violence justified this SWAT callout. The team is checking how to help the person leave without assuming the proposed exit is usable.',
    responsibilities: ['Check immediate danger separately from exit suitability', 'Prepare and complete an agreed move, then address any medical need'],
    objective: 'Find a genuinely usable route for the person’s agreed move',
    preparation: { title: 'Check the proposed route outside', summary: 'Check exit suitability separately from the current threat; a usable exit is not proof that people are safe.', success: 'A usable route has been confirmed for the agreed move.', flag: 'v4_route_ready' },
    pressure: { start: 27, perMinute: 1, threshold: 72, civilianPerMinute: 1 }, arrivalMinutes: 6, communicationDifficulty: -2,
  },
  {
    id: 'threat_account_changes', family: 'protective', label: 'The threat account has changed',
    report: 'The first caller reported immediate serious danger. A new account changes the timing and suggests the threat may already have ended.',
    dispatchReason: 'SWAT responded to a specific, initially credible report of threatened serious violence. The changed account now requires a fresh assessment before continuing the response.',
    responsibilities: ['Check which observations are current and whether danger remains', 'Close a disproved threat or complete the necessary protective plan'],
    objective: 'Use a fresh independent account before continuing or closing the response',
    preparation: { title: 'Reconcile the changed threat account', summary: 'Check the new account against the first call and the person’s current situation.', success: 'The changed account is reconciled with current observations; preparations remain available if a response is still needed.', flag: 'v4_threat_reconciled' },
    pressure: { start: 18, perMinute: 0.55, threshold: 80, civilianPerMinute: 0.7 }, arrivalMinutes: 11, communicationDifficulty: 4,
  },
];

export function v4Family(spec: IncidentSpec): V4Family {
  return spec.type === 'medical_complication' ? 'assistance' : ['barricaded', 'business_robbery', 'disturbance'].includes(spec.type) ? 'protective' : 'welfare';
}
export function premiseForV4(spec: IncidentSpec): V4Premise {
  const family = v4Family(spec);
  const premises = V4_PREMISES.filter(p => p.family === family);
  return premises[hashSeed(`${spec.seed}:v4:public-premise:${family}`) % premises.length];
}
