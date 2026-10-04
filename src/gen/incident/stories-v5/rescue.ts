import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation, StageId } from '../../../sim/types';
import { hashSeed } from '../../../sim/rng';
import { withHighRiskVersionFourChoices } from '../high-risk-v4';
import { actionHR, enterCareHR, partialHR, previewHR, reqFact, reqFlag, sameHR, visibleHR, injuryHR, type HighRiskContext } from '../high-risk-common-v4';
import { finishPersonalStory, personalCare, personalFact, personalOfficerCare, storyDoorRoute, storyOpenings } from './armed';

// Each bundle describes the whole access situation, not independently sampled motives.
const EPISODES = [
  { id: 'chair_fits_both', vehicleFits: true, care: false },
  { id: 'chair_needs_assistance', vehicleFits: false, care: false },
  { id: 'long_wait_at_home', vehicleFits: true, care: true },
] as const;
const FAMILIES = ['juniper_court_v1', 'willow_terrace_v1', 'harbour_court'];

export function withRescueStory(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  if (input.incident?.type !== 'protected_rescue' || !FAMILIES.includes(built.location.familyId)) throw new Error('My Chair Comes Too needs a supported ground-floor home');
  const s = withHighRiskVersionFourChoices(structuredClone(input), built);
  const episode = EPISODES[hashSeed(`${input.incident.seed}:chair-v5`) % EPISODES.length];
  // Jun is deliberately in the existing ground-floor living room. A randomly
  // selected bedroom is not permission to invent a chair-compatible route.
  const target = built.location.rooms.find(r => r.id === 'living' && (r.floor ?? 0) === 0)!;
  if (!target) throw new Error('This Jun episode needs the existing ground-floor living room');
  const ctx: HighRiskContext = { scenario: s, built, targetId: target.id, exteriorId: built.location.entries[0], difficulty: 31 + input.incident.tier * 3 };
  const route = storyDoorRoute(built, target.id, ctx.exteriorId, true);
  const footRoute = storyDoorRoute(built, target.id, ctx.exteriorId);
  const doors = storyOpenings(route ?? []);
  const reachDoors = storyOpenings(footRoute ?? []);
  const zone = built.location.zones.find(z => z.id === ctx.exteriorId)!;
  const exteriorFits = !zone.tags.some(tag => ['vehicle_inaccessible', 'narrow'].includes(tag));
  const routeLabel = `${target.label.toLowerCase()} to the ${zone.label.toLowerCase()}`;
  const make = (id: string, stage: StageId, title: string, summary: string, preview: string | ActionDefinition['outcomePreview'], extra: Partial<ActionDefinition> = {}) => actionHR(ctx, id, stage, title, summary, 'radio', typeof preview === 'string' ? previewHR(preview) : preview!, extra);
  const vehicleRequirements: Partial<ActionDefinition> = {
    targetId: ctx.exteriorId,
    capabilities: { rules: ['vehicle_exterior'], required: ['vehicle_exterior'], vehicleAccessible: exteriorFits },
    requires: { certs: ['vehicle_operations'] },
  };
  s.version = 5; s.title = s.variantLabel = 'My Chair Comes Too';
  s.summary = 'A neighbour says adult resident Jun Park “won’t leave” while an independently confirmed armed threat affects the area. Jun is waiting in the living room. What has the proposed rescue missed?';
  s.pressureLabel = 'Jun’s move is unfinished';
  s.briefing = {
    known: ['A neighbour told dispatch Jun Park “won’t leave.” That is the neighbour’s description, not Jun’s account.', 'Patrol independently confirms an armed threat in the surrounding area. Routine transport cannot safely reach Jun without the protected move.', `Jun is reported in the ground-floor ${target.label.toLowerCase()}. Dispatch has a working phone connection to Jun.`],
    unknown: ['What Jun needs in order to leave', 'Whether the actual route and proposed transport can meet that need'],
    dispatchReason: 'An identified adult resident needs help leaving an area affected by a corroborated armed threat.',
    teamResponsibilities: ['Hear Jun’s own account', 'Complete a move that meets Jun’s stated need', 'Arrange any needed accepted care; the wider armed incident remains separate'],
  };
  s.facts = [
    personalFact(ctx, 'f_jun', 'Jun Park, adult resident', true, `Jun is reported in the ${target.label.toLowerCase()}.`, 'Jun is individually accounted for at home.', 'Jun is elsewhere.', false),
    personalFact(ctx, 'f_threat', 'Patrol’s area-threat report', true, 'Patrol independently reports an armed threat affecting Jun’s area.', 'Patrol confirmed the armed threat when the rescue began. The wider incident remains separate.', 'The initial threat report is unconfirmed.', false),
    personalFact(ctx, 'f_chair', 'What Jun asked for', true, 'The caller’s description has not been checked with Jun.', 'Jun says: “I said I can’t leave it.” The wheelchair must come with Jun.', 'Jun’s needs remain unknown.'),
    personalFact(ctx, 'f_chair_route', 'Jun’s checked doorway route', route !== null, 'The actual doorway route must be checked with Jun’s chair.', `Jun and the team check the existing route from the ${routeLabel}. The chair fits the actual doors without widening an opening.`, 'No connected ground-floor route wide enough for this chair has been established. A walking route alone does not meet Jun’s need.'),
    personalFact(ctx, 'f_vehicle_fit', 'Initial check of the reserved vehicle’s chair provision', episode.vehicleFits && exteriorFits, 'The actual pickup and chair provision have not been checked.', 'At the initial check, the qualified driver confirmed an accessible pickup and a working loading and chair-securement arrangement for Jun’s chair.', 'The proposed pickup cannot provide a usable loading and securement arrangement for Jun’s chair. Vehicle armor does not fix that mismatch.'),
    personalFact(ctx, 'f_care_needed', 'Jun’s additional reported complaint', episode.care, 'Ask about current needs once the move is complete.', 'Jun reports pain after the long wait and asks for medical assessment.', 'Jun reported no additional complaint. Any recorded injury still needs assessment.'),
  ];
  s.civilianOutcomes = [{ id: 'jun', label: 'Jun Park', factId: 'f_jun', safeFlag: 'hr_jun_safe', injuredFlag: 'hr_jun_injured', careFlag: 'hr_jun_care' }];
  s.objectives = [{ id: 'reach', label: 'Reach Jun and hear the actual need' }, { id: 'chair', label: 'Complete the move with Jun’s chair' }, { id: 'care', label: 'Complete any needed care' }];
  s.stages = {
    assess: { id: 'assess', label: 'Whose account?', prompt: 'The neighbour says Jun “won’t leave.” Hear Jun before deciding what that means.', actions: [] },
    adapt: { id: 'adapt', label: 'The chair is part of the move', prompt: 'Jun needs the wheelchair to come too. Reach Jun and check what the proposed route actually allows.', actions: [], contextPrompts: [
      { when: { flags: ['hr_route_rejected'] }, prompt: 'The existing route has not been established as usable with Jun’s chair. A vehicle outside cannot solve that interior gap.' },
      { when: { flags: ['hr_vehicle_rejected'] }, prompt: 'The reserved vehicle cannot provide the checked chair-loading arrangement. Jun can still use a suitable slower assistance plan.' },
      { when: { flags: ['hr_route_checked'], notFlags: ['hr_assistance_ready', 'hr_vehicle_ready'] }, prompt: 'The existing door route fits Jun and the chair. Arrange suitable slower help or check the actual reserved vehicle before moving to pickup.' },
      { when: { flags: ['hr_assistance_ready'] }, prompt: 'Jun and the chair have a checked assistance plan. The move to exterior staging is still unfinished.' },
      { when: { flags: ['hr_jun_reached'], notFlags: ['hr_route_checked', 'hr_route_rejected'] }, prompt: 'The team has reached Jun and heard why the wheelchair must come too. Check the actual door route together before choosing how to make the move.' },
    { when: { flags: ['hr_vehicle_ready'] }, prompt: 'The actual reserved vehicle can receive Jun and the chair. First complete the separate move through the checked doors.' },
    ] },
    resolve: { id: 'resolve', label: 'Jun chooses what comes next', prompt: 'Jun and the wheelchair are at exterior staging. The final protected move remains unfinished.', actions: [], contextPrompts: [
      { when: { flags: ['hr_injury_pause', 'hr_jun_safe'] }, prompt: 'An officer is hurt and out of action. Jun and the chair reached safety; the officer now needs a receiving crew.' },
      { when: { flags: ['hr_injury_pause'] }, prompt: 'An officer is hurt and out of action. Jun and the chair remain at staging; their protected move is unfinished.' },
      { when: { flags: ['hr_care_mode', 'hr_care_required'] }, prompt: 'Jun and the chair reached safety. Jun’s current need or recorded injury still requires accepted medical care.' },
      { when: { flags: ['hr_care_mode'], notFlags: ['hr_care_required'] }, prompt: 'Jun and the chair reached safety, with no current medical need reported. Jun wants to wait at the community room next.' },
      { when: { flags: ['hr_vehicle_setback'], notFlags: ['hr_jun_safe'] }, prompt: 'The vehicle’s chair-securing latch failed its final check. Jun remains at staging with the chair; prepare the different slower assistance arrangement.' },
      { when: { flags: ['hr_assistance_setback'], notFlags: ['hr_jun_safe'] }, prompt: 'Fresh gunfire interrupted the assistance move. Jun is injured at staging with the chair; no current protected movement window is established.' },
    ] },
  };
  const hear: OutcomeEffect[] = [{ reveal: ['f_jun', 'f_threat', 'f_chair'], setFlags: ['hr_jun_heard'], stage: 'adapt', text: 'Jun corrects the caller: “I said I can’t leave it.” Jun means the wheelchair. “It comes with me.” Patrol separately confirms the area threat; Jun agrees to help that keeps the chair with them.' }];
  const reached: OutcomeEffect = { setFlags: ['hr_jun_reached'], text: `The team reaches Jun in the ${target.label.toLowerCase()}. Jun points to the chair: “You’ve found a way for people to walk out. Have you checked this can go with me?” Jun has not yet left the room.` };
  const phone = sameHR(make('hear_jun', 'assess', 'Hear Jun on the dispatch line', 'Use the working phone connection and ask what is keeping Jun inside. Cross-check the area danger with patrol.', 'Hear Jun’s own request. A phone conversation does not physically reach or rescue Jun.', { workload: { base: 3, perSqFt: 0 } }), hear);
  const direct = sameHR(make('reach_and_hear', 'assess', 'Reach Jun and ask in person', 'Use the actual available building route, hear Jun directly and cross-check the area threat with patrol.', 'Physically reach Jun and hear what the proposed rescue missed. Jun remains inside.', { icon: 'search', approach: 'path', requires: { openings: reachDoors }, workload: { base: 6, perSqFt: 0.01 } }), [...hear, reached]);
  s.stages.assess.actions = [phone, direct, partialHR(ctx, 'assess')];
  const reach = sameHR(make('reach_jun', 'adapt', 'Reach Jun in the living room', 'Follow an actual building route to Jun. Hear which part of the proposed move still ignores the chair.', 'Reach Jun without claiming that Jun or the chair has reached pickup.', { icon: 'search', approach: 'path', visibleWhen: visibleHR(['hr_jun_heard'], ['hr_jun_reached']), requires: { facts: [reqFact('f_jun', 'Account for Jun first')], openings: reachDoors }, workload: { base: 4, perSqFt: 0.01 } }), [reached]);
  const checkRoute = sameHR(make('check_chair_route', 'adapt', 'Check the actual route with Jun’s chair', `Check the existing doors from the ${routeLabel}, using Jun’s account of how the chair fits. A route for walking is insufficient.`, 'Confirm a real chair-compatible door route, or preserve the exact access limitation. No opening is widened.', { icon: 'door', visibleWhen: visibleHR(['hr_jun_reached'], ['hr_route_checked', 'hr_route_rejected']), requires: { flags: [reqFlag('hr_jun_reached', 'Reach Jun and hear the chair requirement first')], openings: doors }, workload: { base: 5, perSqFt: 0 } }), [
    { reveal: ['f_chair_route'] },
    { truth: [{ factId: 'f_chair_route', is: true }], setFlags: ['hr_route_checked'], text: `Jun and the team check the existing doors from the ${routeLabel}. Jun confirms the chair fits the route they use at home. No opening needs to be widened; the exposed move beyond the door still needs an arrangement.` },
    { truth: [{ factId: 'f_chair_route', is: false }], setFlags: ['hr_route_rejected'], text: 'The checked layout does not establish a connected ground-floor route for Jun’s chair. The walking route is not sufficient. An armored vehicle outside cannot solve this interior access problem.' },
  ]);
  const prepare = sameHR(make('prepare_assistance', 'adapt', 'Agree slower assistance with Jun', 'Use the actual remaining team and Jun’s guidance to arrange a slower move with the chair kept alongside Jun throughout.', 'Prepare the chair-preserving assistance arrangement. The physical move has not happened yet.', { icon: 'perimeter', visibleWhen: visibleHR(['hr_route_checked'], ['hr_assistance_ready', 'hr_vehicle_ready']), requires: { facts: [reqFact('f_chair_route', 'Check a real route that fits Jun’s chair')], flags: [reqFlag('hr_jun_reached', 'Reach Jun first')] }, workload: { base: 8, perSqFt: 0 } }), [{ setFlags: ['hr_assistance_ready'], text: 'Jun agrees the slower assistance arrangement with the deployed team: the wheelchair stays with Jun for the whole move. No extra vehicle or unassigned helper is assumed.' }]);
  const vehicleCheck = sameHR(make('check_reserved_vehicle', 'adapt', 'Check the reserved vehicle with its driver', 'A qualified deployed driver checks the actual reserved vehicle, the pickup and the provision for Jun’s chair.', 'Only a working, accessible loading and chair-securement arrangement can support a vehicle move.', { ...vehicleRequirements, icon: 'shield', visibleWhen: visibleHR(['hr_route_checked'], ['hr_assistance_ready', 'hr_vehicle_ready', 'hr_vehicle_rejected']), requires: { ...vehicleRequirements.requires, facts: [reqFact('f_chair_route', 'First check the interior route with Jun’s chair')] }, workload: { base: 3, perSqFt: 0 } }), [
    { reveal: ['f_vehicle_fit'] },
    { truth: [{ factId: 'f_vehicle_fit', is: true }], setFlags: ['hr_vehicle_ready'], text: 'The qualified driver checks the accessible exterior pickup and confirms a usable loading and chair-securement arrangement on the actual reserved vehicle. Jun agrees to this chair-preserving move.' },
    { truth: [{ factId: 'f_vehicle_fit', is: false }], setFlags: ['hr_vehicle_rejected'], text: 'The driver cannot provide a usable chair-loading and securement arrangement at this pickup. Jun says, “Then we need the other plan.” The vehicle’s armor does not settle this access problem.' },
  ]);
  const pickupEffects: OutcomeEffect[] = [{ setFlags: ['hr_at_pickup'], stage: 'resolve', text: `Jun and the wheelchair reach the ${zone.label.toLowerCase()} through the checked doors. Jun is at exterior staging, not yet beyond the affected area. The final protected move is still needed.` }];
  const pickup = (method: 'assistance' | 'vehicle') => sameHR(make(`reach_pickup_${method}`, 'adapt', 'Bring Jun and the chair to pickup', 'Follow the checked doorway route with Jun and the wheelchair together. Keep the agreed final arrangement ready.', 'Reach exterior staging with Jun and the chair. This does not complete the final protected move.', { icon: 'door', targetId: ctx.exteriorId, approach: 'path', visibleWhen: visibleHR([`hr_${method}_ready`], ['hr_at_pickup']), requires: { flags: [reqFlag('hr_jun_reached', 'Physically reach Jun first'), reqFlag(`hr_${method}_ready`, 'Arrange the final move before leaving the room')], facts: [reqFact('f_chair_route', 'The chair needs a positively checked route')], openings: doors }, workload: { base: 5, perSqFt: 0.01 } }), pickupEffects);
  s.stages.adapt.actions = [reach, checkRoute, prepare, vehicleCheck, pickup('assistance'), pickup('vehicle'), partialHR(ctx, 'adapt')];
  const rescued: OutcomeEffect[] = [
    { setFlags: ['hr_jun_safe', 'hr_chair_safe', 'hr_people_safe', 'hr_primary_complete', 'hr_care_checked'], reveal: ['f_care_needed'], text: 'Jun and the wheelchair complete the protected move together and reach the receiving area. Jun asks about the community room for afterward: “There’s space for my chair by the window.” The next destination is still to be agreed.' },
    { truth: [{ factId: 'f_care_needed', is: true }], setFlags: ['hr_care_required'], text: 'Jun reports pain after the long wait and asks for medical assessment before going anywhere else.' },
    { truth: [{ factId: 'f_care_needed', is: false }], when: { notFlags: ['hr_jun_injured'] }, text: 'Jun reports no current medical need.' },
    { when: { flags: ['hr_jun_injured'] }, text: 'Jun’s recorded injury still needs assessment before the chosen next journey.' }, ...enterCareHR(),
  ];
  const vehicle = make('vehicle_move', 'resolve', 'Complete Jun’s vehicle move', 'Use the qualified driver and actual reserved vehicle with the checked chair provision. Jun’s wheelchair comes too.', { favorable: 'Jun and the chair reach the receiving area together.', mixed: 'The chair-preserving vehicle move takes longer, but Jun reaches safety without a new injury.', adverse: 'The final chair-loading check fails. Jun and the chair remain at staging; a different assistance plan is needed.' }, { ...vehicleRequirements, icon: 'shield', visibleWhen: visibleHR(['hr_at_pickup', 'hr_vehicle_ready'], ['hr_jun_safe', 'hr_vehicle_setback']), requires: { ...vehicleRequirements.requires, flags: [reqFlag('hr_at_pickup', 'Jun and the chair must actually reach pickup')], facts: [reqFact('f_vehicle_fit', 'Confirm a working chair-compatible vehicle arrangement'), reqFact('f_chair_route', 'The interior chair route must be checked')] }, workload: { base: 3, perSqFt: 0 } });
  vehicle.outcomes = { favorable: structuredClone(rescued), mixed: [...structuredClone(rescued), { extraMinutes: 4, text: 'The driver needs extra time to complete the checked chair-preserving move. Jun reaches the receiving area without a new injury.' }], adverse: [{ setFlags: ['hr_vehicle_setback'], clearFlags: ['hr_vehicle_ready'], text: 'At the final check, the latch that secures the chair will not close. The driver stops the move before loading Jun. Jun and the chair stay at exterior staging; neither is recorded as safely moved.' }] };
  const assistance = make('assisted_move', 'resolve', 'Complete the slower move with Jun', 'Use the prepared assistance arrangement and actual team. Keep Jun’s wheelchair with them through the longer exposed move.', { favorable: 'Jun and the chair reach the receiving area together.', mixed: 'Jun and the chair reach safety, but an officer is wounded and needs care.', adverse: 'Fresh gunfire interrupts the move. Jun and an officer are injured; Jun and the chair remain at staging.' }, { icon: 'shield', targetId: ctx.exteriorId, visibleWhen: visibleHR(['hr_at_pickup', 'hr_assistance_ready'], ['hr_jun_safe', 'hr_assistance_setback']), requires: { flags: [reqFlag('hr_assistance_ready', 'Prepare the chair-preserving assistance arrangement')], facts: [reqFact('f_chair_route', 'A real chair-compatible route is required')] }, workload: { base: 9, perSqFt: 0 }, consequenceLevel: 'high' });
  assistance.outcomes = { favorable: structuredClone(rescued), mixed: [...structuredClone(rescued), injuryHR('wounded', 'Wounded while accompanying Jun and the wheelchair')], adverse: [{ setFlags: ['hr_assistance_setback', 'hr_jun_injured', 'hr_care_required'], civilian: -10, text: 'Fresh gunfire interrupts the exposed move. Jun is injured and remains with the wheelchair at staging. The team has no current protected movement window; no completed rescue is claimed.' }, injuryHR('serious', 'Seriously wounded during Jun’s interrupted move')] };
  const slower = sameHR(make('prepare_different_assistance', 'resolve', 'Agree the slower plan at staging', 'The vehicle’s failed loading provision cannot be used. Agree a chair-preserving move with Jun using the actual team and the independently checked route.', 'Prepare a genuinely different assistance arrangement. Jun remains at staging until that move succeeds.', { icon: 'perimeter', visibleWhen: visibleHR(['hr_at_pickup', 'hr_vehicle_setback'], ['hr_assistance_ready', 'hr_jun_safe']), requires: { facts: [reqFact('f_chair_route', 'The retained checked route must still fit the chair')] }, workload: { base: 9, perSqFt: 0 } }), [{ setFlags: ['hr_assistance_ready'], text: 'Jun agrees the slower assistance plan at staging. The team uses its actual remaining personnel; the broken vehicle-loading provision is no part of this move. The wheelchair stays with Jun.' }]);
  const care = personalCare(ctx, 'Jun', 'hr_jun_safe', 'hr_jun_care', 'Jun chooses the community room as the next destination, with the wheelchair and a place by the window. Jun is safe at the receiving area; the onward journey has not happened.');
  for (const action of care) if (['hr_civilian_next_step', 'hr_civilian_transfer'].includes(action.id)) for (const effects of Object.values(action.outcomes)) effects.push({ setFlags: ['hr_destination_chosen'], ...(action.id === 'hr_civilian_transfer' ? { text: 'With care accepted, Jun chooses the community room for afterward, with the wheelchair and a place by the window. That onward journey has not happened.' } : {}) });
  // A failed exposed move is not repaired by an unexplained guaranteed retry.
  s.stages.resolve.actions = [vehicle, assistance, slower, partialHR(ctx, 'resolve'), ...personalOfficerCare(ctx), ...care];
  s.endings.protection_complete.completion!.flags!.push('hr_destination_chosen');
  s.endings.care_accepted.completion!.flags!.push('hr_destination_chosen');
  s.endings.protection_complete.title = 'Jun’s chair comes too';
  s.endings.protection_complete.summary = 'Jun Park and the wheelchair reached the receiving area together. Jun reports no current medical need and chooses the community room next, with space by the window. Any injured officer has reached a medical receiver. The wider armed incident remains separate.';
  s.endings.care_accepted.title = 'Jun and the chair, with care accepted';
  s.endings.care_accepted.summary = 'Jun Park and the wheelchair reached safety together, and the ambulance crew accepted Jun’s care. Jun chose the community room for afterward; that journey has not happened. Any injured officer has reached a separate medical receiver. The wider armed incident remains separate.';
  s.endings.partial.remainingTasks = ['Complete Jun’s unfinished chair-preserving move', 'Complete any needed care for Jun and injured officers'];
  return finishPersonalStory(s, 'v5_chair', [
    { id: 'jun_unreached', when: { notFlags: ['hr_jun_reached'] }, title: 'Jun is still waiting at home', text: 'Jun Park remains in the living room and has not been physically reached. The wheelchair remains there too.', remainingTasks: ['Reach Jun and complete the move with the wheelchair', 'Complete any needed civilian care', 'Complete any outstanding officer care'] },
    { id: 'jun_reached', when: { flags: ['hr_jun_reached'], notFlags: ['hr_at_pickup'] }, title: 'Jun is reached, but still at home', text: 'The team reached Jun Park in the living room. Jun and the wheelchair have not reached exterior staging.', remainingTasks: ['Complete Jun’s move with the wheelchair to staging and safety', 'Complete any needed civilian care', 'Complete any outstanding officer care'] },
    { id: 'jun_pickup', when: { flags: ['hr_at_pickup'], notFlags: ['hr_jun_safe'] }, title: 'Jun is at staging; the move is unfinished', text: 'Jun Park and the wheelchair reached exterior staging. The final protected move remains unfinished.', remainingTasks: ['Complete Jun’s protected move with the wheelchair from staging', 'Complete any needed civilian care', 'Complete any outstanding officer care'] },
    { id: 'jun_care_pending', when: { flags: ['hr_jun_safe', 'hr_care_required'] }, title: 'Jun is safe; care is pending', text: 'Jun Park and the wheelchair reached safety. A receiving crew has not yet accepted Jun’s needed care.', remainingTasks: ['Arrange accepted medical care for Jun', 'Complete any outstanding officer care'] },
    { id: 'jun_next_pending', when: { flags: ['hr_jun_safe'], notFlags: ['hr_care_required'] }, title: 'Jun is safe; next steps remain open', text: 'Jun Park and the wheelchair reached safety, with no current medical need reported. The next step or recorded officer care remains unfinished.', remainingTasks: ['Agree Jun’s next step', 'Complete any outstanding officer care'] },
  ], [
    { when: { flags: ['hr_jun_injured'], notFlags: ['hr_jun_care'] }, text: 'Jun’s recorded injury still needs accepted care.' },
    { text: 'The wider armed incident remains a separate responsibility.' },
  ]);
}
