import type { SettingModule } from './setting-modules';

/** Prose an armed-incident ("After the Noise") setting module supplies. The framework's
 * decision graph, facts and endings stay the same in every setting; these are the lines
 * that say who Eli is, where he is, what he is doing and what the player weighs.
 * Names stay as authored (Eli, Eli Tran, Grant); the cast binder renames them later.
 * Eli's authored pronouns are he/him (cast-v9 SCENARIO_CAST), so modules use them too. */
export interface ArmedIncidentProse {
  /** Scenario summary on the card and briefing. */
  opening: string;
  briefing: {
    /** The first known line: Eli's call. */
    call: string;
    dispatchReason: string;
    /** Extra known lines: setting details the player weighs. */
    details: readonly string[];
  };
  people: {
    /** Eli's location fact label. */
    workerFact: string;
    /** Eli's own first report of where he is. */
    workerClaim: string;
    /** Patrol's first report of Grant's position. */
    armedClaim: string;
  };
  stagePrompts: {
    /** First sentence of the assess prompt (what Eli is doing). */
    assess: string;
    /** First sentence of the adapt prompt. */
    adapt: string;
  };
  actionText: {
    /** Eli's coping routine, heard while patrol checks the account. */
    routineOngoing: string;
    /** The dispatcher hears the routine falter. */
    routineRepeat: string;
    /** The routine resumes once the gunfire stops. */
    routineResumes: string;
    /** First sentence when the team physically reaches Eli. */
    reachArrival: string;
    /** Second sentence of the reach action's summary. */
    reachSummary: string;
    /** Eli's agreed next step when he needs no care. */
    nextStep: string;
  };
  endings: {
    /** Title of the completed-protection ending. */
    completeTitle: string;
    /** The next-step clause inside that ending's summary. */
    completeNextStep: string;
  };
}

/** The retail module is the story as authored for Market Row and played on every
 * register-holding building since v10. Its prose is the authored text verbatim: it is
 * both the retail module and the source each other module's lines replace. */
export const ARMED_RETAIL: SettingModule<ArmedIncidentProse> = {
  id: 'armed_retail_till_count', framework: 'active_armed_incident', settings: ['retail'],
  requires: { setting: 'business' }, scene: 'worker',
  roles: {
    worker: { personId: 'eli', label: 'Shop worker counting the tills', rooms: [{ objects: [{ type: 'register' }] }] },
    armed: { personId: 'grant', label: 'Armed person in the shop', rooms: 'scene' },
  },
  prose: {
    opening: 'Shop worker Eli Tran is trapped at Market Row during corroborated gunfire. The dispatcher last heard him counting the tills as if closing for the night. Grant is armed inside. Can the team stop the danger and get Eli out?',
    briefing: {
      call: 'Eli Tran called from the shop and said he could not leave. The dispatcher last heard him counting the tills.',
      dispatchReason: 'Corroborated current gunfire puts an identified shop worker at immediate risk.',
      details: [],
    },
    people: {
      workerFact: 'Eli Tran, shop worker',
      workerClaim: 'Eli says he is trapped in the shop.',
      armedClaim: 'Patrol reports Grant inside the shop with Eli.',
    },
    stagePrompts: { assess: 'Eli is counting the tills.', adapt: 'Eli is still trapped.' },
    actionText: {
      routineOngoing: 'Eli is still counting the tills over the phone.',
      routineRepeat: 'Eli counts one drawer twice.',
      routineResumes: 'On the still-open call, he begins counting the tills again.',
      reachArrival: 'The team reaches Eli through the checked doors.',
      reachSummary: 'Let Eli hear that help has actually reached him.',
      nextStep: 'Eli chooses to sit with patrol before speaking to the shop manager. He does not return to the tills.',
    },
    endings: {
      completeTitle: 'Eli leaves the tills',
      completeNextStep: 'chooses to sit with patrol before speaking to the shop manager',
    },
  },
};

/** A late worker shelters behind a door he locked himself; Grant is in another room. */
export const ARMED_OFFICE: SettingModule<ArmedIncidentProse> = {
  id: 'armed_office_late_worker', framework: 'active_armed_incident', settings: ['office'],
  requires: { setting: 'business' }, scene: 'worker',
  roles: {
    worker: { personId: 'eli', label: 'Late worker sheltering behind a locked door', rooms: [{ types: ['office'], tags: ['meeting', 'lockable'] }, { types: ['office'], tags: ['private', 'lockable'] }] },
    armed: { personId: 'grant', label: 'Armed person in the workspace', rooms: [{ types: ['office'], tags: ['open'] }, { types: ['office'], tags: ['reception'] }] },
  },
  prose: {
    opening: 'Eli Tran was working late at {place} when the gunfire started. He has locked himself in the {room}, and the dispatcher last heard him counting the ceiling tiles under his breath. Grant is armed inside. Can the team stop the danger and get Eli out?',
    briefing: {
      call: 'Eli Tran called from the {room} and said he could not leave. He locked the door after the first shots and is keeping his voice low.',
      dispatchReason: 'Corroborated current gunfire puts an identified office worker at immediate risk.',
      details: ['The office had closed for the night. Patrol reports Grant in the {armedRoom}, a different room from the one Eli has locked.'],
    },
    people: {
      workerFact: 'Eli Tran, office worker',
      workerClaim: 'Eli says he has locked himself in and cannot leave.',
      armedClaim: 'Patrol reports Grant inside, in a different room from Eli.',
    },
    stagePrompts: { assess: 'Eli is counting the ceiling tiles.', adapt: 'Eli is still locked in the {room}.' },
    actionText: {
      routineOngoing: 'Eli is still counting ceiling tiles over the phone.',
      routineRepeat: 'Eli loses his place in the ceiling tiles and starts the row again.',
      routineResumes: 'On the still-open call, he starts counting the ceiling tiles again.',
      reachArrival: 'Eli unlocks the {room} door when the team calls his name.',
      reachSummary: 'Eli will unlock the {room} door once he hears the team.',
      nextStep: 'Eli chooses to sit with patrol before calling his manager. He does not go back for his things.',
    },
    endings: {
      completeTitle: 'Eli leaves the {room}',
      completeNextStep: 'chooses to sit with patrol before calling his manager',
    },
  },
};

/** A night-shift picker shelters among the racking rows, which give cover and block
 * sightlines; Grant is somewhere on the same floor. */
export const ARMED_WAREHOUSE: SettingModule<ArmedIncidentProse> = {
  id: 'armed_warehouse_night_picker', framework: 'active_armed_incident', settings: ['warehouse'],
  requires: { setting: 'business' }, scene: 'worker',
  roles: {
    worker: { personId: 'eli', label: 'Night-shift picker sheltering in the racking', rooms: [{ types: ['storage'], tags: ['warehouse'], objects: [{ type: 'shelf', tags: ['blocks_sight'] }] }] },
    armed: { personId: 'grant', label: 'Armed person on the warehouse floor', rooms: 'scene' },
  },
  prose: {
    opening: 'Night-shift picker Eli Tran is sheltering between the racking rows at {place} during corroborated gunfire. The dispatcher last heard him counting the pallets on the rack beside him. Grant is armed on the same floor. Can the team stop the danger and get Eli out?',
    briefing: {
      call: 'Eli Tran called from the {room} and said he could not reach a door without crossing open floor. The dispatcher last heard him counting pallets.',
      dispatchReason: 'Corroborated current gunfire puts an identified night-shift worker at immediate risk.',
      details: ['Racking rows divide the {room}. They give Eli cover and block sightlines between him and Grant.'],
    },
    people: {
      workerFact: 'Eli Tran, night-shift picker',
      workerClaim: 'Eli says he is crouched between racking rows and cannot reach a door.',
      armedClaim: 'Patrol reports Grant on the same floor as Eli, with racking between them.',
    },
    stagePrompts: { assess: 'Eli is counting pallets.', adapt: 'Eli is still sheltering in the racking.' },
    actionText: {
      routineOngoing: 'Eli is still counting pallets over the phone.',
      routineRepeat: 'Eli counts one pallet twice.',
      routineResumes: 'On the still-open call, he begins counting pallets again.',
      reachArrival: 'The team reaches Eli between the racking rows.',
      reachSummary: 'Let Eli hear the team coming between the racking rows.',
      nextStep: 'Eli chooses to sit with patrol before calling his shift lead. He does not go back into the racking.',
    },
    endings: {
      completeTitle: 'Eli leaves the racking',
      completeNextStep: 'chooses to sit with patrol before calling his shift lead',
    },
  },
};

/** The night clerk is in a staff or service room (where he was working or ran to) while
 * guests stay in their units; Grant is in a public room. */
export const ARMED_MOTEL: SettingModule<ArmedIncidentProse> = {
  id: 'armed_motel_night_clerk', framework: 'active_armed_incident', settings: ['motel'],
  requires: { setting: 'business', rooms: [{ tags: ['guest'] }] }, scene: 'worker',
  roles: {
    worker: { personId: 'eli', label: 'Night clerk on the overnight desk', rooms: [{ types: ['office'], tags: ['staff', 'office'] }, { types: ['office'], tags: ['reception'] }, { tags: ['service', 'laundry'], floors: [0] }, { types: ['storage'], tags: ['service'], floors: [0] }] },
    armed: { personId: 'grant', label: 'Armed person in the public rooms', rooms: [{ types: ['office'], tags: ['reception'] }, { tags: ['dining', 'customer'] }] },
  },
  prose: {
    opening: 'Night clerk Eli Tran is trapped in the {room} at {place} during corroborated gunfire. The dispatcher last heard him counting the keys on his ring. Grant is armed in the {armedRoom}, and guests are in their rooms. Can the team stop the danger and get Eli out?',
    briefing: {
      call: 'Eli Tran called from the {room} and said he could not leave. The dispatcher last heard him counting the keys on his ring.',
      dispatchReason: 'Corroborated current gunfire puts an identified night clerk at immediate risk.',
      details: ['Eli was covering the overnight desk alone. Patrol has phoned the occupied units and asked guests to stay inside with their doors shut.'],
    },
    people: {
      workerFact: 'Eli Tran, night clerk',
      workerClaim: 'Eli says he cannot leave the {room}.',
      armedClaim: 'Patrol reports Grant inside, in a different room from Eli.',
    },
    stagePrompts: { assess: 'Eli is counting his keys.', adapt: 'Eli is still trapped in the {room}.' },
    actionText: {
      routineOngoing: 'Eli is still counting his keys over the phone.',
      routineRepeat: 'Eli counts one key twice.',
      routineResumes: 'On the still-open call, he begins counting his keys again.',
      reachArrival: 'The team reaches Eli in the {room}.',
      reachSummary: 'Let Eli hear that help has actually reached the {room}.',
      nextStep: 'Eli chooses to sit with patrol before calling the motel’s owner. He does not go back to the desk.',
    },
    endings: {
      completeTitle: 'Eli leaves the {room}',
      completeNextStep: 'chooses to sit with patrol before calling the motel’s owner',
    },
  },
};

export const ARMED_SETTING_MODULES: readonly SettingModule<ArmedIncidentProse>[] = [ARMED_RETAIL, ARMED_OFFICE, ARMED_WAREHOUSE, ARMED_MOTEL];
