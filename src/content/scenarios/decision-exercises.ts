import type { IncidentSpec } from '../../sim/scenario-types';
/** Always available practice makes the updated briefings discoverable without resetting a campaign. */
const V3_DECISION_EXERCISES: { id: string; code: string; title: string; summary: string; spec: IncidentSpec }[] = [
  { id:'exercise_welfare_v3', code:'DR-1', title:'Uncertain report', summary:'Separate a reported concern from what is confirmed, then choose a proportionate response.', spec:{ type:'welfare_check',familyId:'cedar_close',buildingSeed:0,seed:11,tier:1,contentVersion:3 } },
  { id:'exercise_assistance_v3', code:'DR-2', title:'Time-sensitive assistance', summary:'Balance preparation, access and a safe transfer while time pressure builds.', spec:{ type:'medical_complication',familyId:'harbour_court',buildingSeed:0,seed:12,tier:1,contentVersion:3 } },
  { id:'exercise_protective_v3', code:'DR-3', title:'Protective response', summary:'Verify the situation, prepare support and respond within the team’s qualifications.', spec:{ type:'business_robbery',familyId:'market_row',buildingSeed:0,seed:13,tier:1,contentVersion:3 } },
];

/** The six issued v4 exercises remain unchanged for old saves and links. */
const V4_DECISION_EXERCISES: typeof V3_DECISION_EXERCISES = [
  { id:'exercise_welfare_v4', code:'DR-4', title:'Recheck the callout', summary:'Check a changed report, agree a useful next step or close a verified false alarm.', spec:{ type:'welfare_check',familyId:'cedar_close',buildingSeed:0,seed:11,tier:1,contentVersion:4 } },
  { id:'exercise_assistance_v4', code:'DR-5', title:'Make medical help possible', summary:'Choose preparation that helps, manage a real arrival time and confirm that paramedics accept care.', spec:{ type:'medical_complication',familyId:'harbour_court',buildingSeed:0,seed:12,tier:1,contentVersion:4 } },
  { id:'exercise_protective_v4', code:'DR-6', title:'Keep the protective task', summary:'Use your team’s plan, reassess setbacks and follow through on the person’s needs.', spec:{ type:'business_robbery',familyId:'market_row',buildingSeed:0,seed:13,tier:1,contentVersion:4 } },
  { id:'exercise_active_armed_v4', code:'DR-7', title:'Respond under active threat', summary:'Choose protection, qualified equipment and how to help people while the threat changes.', spec:{ type:'active_armed_incident',familyId:'cedar_close',buildingSeed:7,seed:7,tier:2,contentVersion:4 } },
  { id:'exercise_hostage_v4', code:'DR-8', title:'Resolve a hostage crisis', summary:'Keep track of individual civilian outcomes while combining negotiation and protective decisions.', spec:{ type:'hostage_crisis',familyId:'market_row',buildingSeed:7,seed:7,tier:2,contentVersion:4 } },
  { id:'exercise_protected_rescue_v4', code:'DR-9', title:'Make a protected rescue', summary:'Compare vehicle protection, route preparation and care while keeping casualty risk in view.', spec:{ type:'protected_rescue',familyId:'cedar_close',buildingSeed:7,seed:0,tier:2,contentVersion:4 } },
];

/** All issued practice IDs stay readable with their exact original content. */
export const LEGACY_DECISION_EXERCISES = [...V3_DECISION_EXERCISES, ...V4_DECISION_EXERCISES];

/** Six authored v5 stories are available immediately, including in existing campaigns. */
export const DECISION_EXERCISES: typeof V3_DECISION_EXERCISES = [
  { id:'exercise_welfare_v5', code:'DR-10', title:'The Second Knock', summary:'Ada has already spoken to officers. Establish what the second report actually describes and what she needs now.', spec:{ type:'welfare_check',familyId:'cedar_close',buildingSeed:7,seed:0,tier:1,contentVersion:5 } },
  { id:'exercise_assistance_v5', code:'DR-11', title:'Still on the Clock', summary:'Rosa wants her dizziness checked, but she is still holding the shop keys. Find out what accepting help means to her.', spec:{ type:'medical_complication',familyId:'market_row',buildingSeed:7,seed:1,tier:1,contentVersion:5 } },
  { id:'exercise_protective_v5', code:'DR-12', title:'Leave the Camera Off', summary:'Mina offered to come outside, then stepped back. Hear the agreement she actually wants and follow through on it.', spec:{ type:'barricaded',familyId:'cedar_close',buildingSeed:7,seed:1,tier:1,contentVersion:5 } },
  { id:'exercise_active_armed_v5', code:'DR-13', title:'After the Noise', summary:'Eli is trapped in the shop. Ending the gunfire and helping him get outside are separate responsibilities.', spec:{ type:'active_armed_incident',familyId:'market_row',buildingSeed:7,seed:5,tier:2,contentVersion:5 } },
  { id:'exercise_hostage_v5', code:'DR-14', title:'One Last Signature', summary:'Ben only needed a signature. His release changes the conversation with Mara, who is still being held inside.', spec:{ type:'hostage_crisis',familyId:'market_row',buildingSeed:7,seed:5,tier:2,contentVersion:5 } },
  { id:'exercise_protected_rescue_v5', code:'DR-15', title:'My Chair Comes Too', summary:'Jun says the proposed rescue has missed something essential. Hear what must come too before choosing the move.', spec:{ type:'protected_rescue',familyId:'juniper_court_v1',buildingSeed:7,seed:0,tier:2,contentVersion:5 } },
];
