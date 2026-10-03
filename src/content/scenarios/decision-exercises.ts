import type { IncidentSpec } from '../../sim/scenario-types';
/** Always available practice makes the updated briefings discoverable without resetting a campaign. */
export const DECISION_EXERCISES: { id: string; code: string; title: string; summary: string; spec: IncidentSpec }[] = [
  { id:'exercise_welfare_v3', code:'DR-1', title:'Uncertain report', summary:'Separate a reported concern from what is confirmed, then choose a proportionate response.', spec:{ type:'welfare_check',familyId:'cedar_close',buildingSeed:0,seed:11,tier:1,contentVersion:3 } },
  { id:'exercise_assistance_v3', code:'DR-2', title:'Time-sensitive assistance', summary:'Balance preparation, access and a safe transfer while time pressure builds.', spec:{ type:'medical_complication',familyId:'harbour_court',buildingSeed:0,seed:12,tier:1,contentVersion:3 } },
  { id:'exercise_protective_v3', code:'DR-3', title:'Protective response', summary:'Verify the situation, prepare support and respond within the team’s qualifications.', spec:{ type:'business_robbery',familyId:'market_row',buildingSeed:0,seed:13,tier:1,contentVersion:3 } },
];
